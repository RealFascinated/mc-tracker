#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "error: .env not found"
  echo "  cp .env.example .env"
  echo "  then set MAXMIND_LICENSE_KEY in .env"
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "error: bun is required for the www dev server"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${MAXMIND_LICENSE_KEY:-}" ]]; then
  echo "error: MAXMIND_LICENSE_KEY is required in .env"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL is required in .env"
  exit 1
fi

API_PID=""
WWW_PID=""

cleanup() {
  local status=$?
  if [[ -n "$WWW_PID" ]] && kill -0 "$WWW_PID" 2>/dev/null; then
    kill "$WWW_PID" 2>/dev/null || true
    wait "$WWW_PID" 2>/dev/null || true
  fi
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  exit "$status"
}

trap cleanup EXIT INT TERM

mkdir -p databases

echo "Starting docker compose services..."
docker compose up -d --wait

if [[ ! -d www/node_modules ]]; then
  echo "Installing www dependencies..."
  (cd www && bun install)
fi

WWW_ENV="$ROOT/www/.env"
if [[ ! -f "$WWW_ENV" ]]; then
  cp www/.env.example "$WWW_ENV"
fi

API_URL="${VITE_MC_TRACKER_API_URL:-http://localhost:3000}"
if ! grep -q '^VITE_MC_TRACKER_API_URL=' "$WWW_ENV"; then
  echo "VITE_MC_TRACKER_API_URL=$API_URL" >>"$WWW_ENV"
fi

echo "Starting mc-tracker API..."
export ENVIRONMENT="${ENVIRONMENT:-development}"
cargo run -p mc-tracker &
API_PID=$!

echo "Waiting for API health check at ${API_URL}/health..."
for _ in $(seq 1 60); do
  if curl -sf "${API_URL}/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "error: mc-tracker exited before becoming healthy"
    wait "$API_PID" || true
    exit 1
  fi
  sleep 1
done

if ! curl -sf "${API_URL}/health" >/dev/null 2>&1; then
  echo "warning: API health check timed out; starting www anyway"
fi

echo "Starting www dev server on http://localhost:5173 ..."
(cd www && bun run dev) &
WWW_PID=$!

echo "API: ${API_URL}"
echo "UI:  http://localhost:5173"
echo "Press Ctrl+C to stop both."

wait "$WWW_PID"

# syntax=docker/dockerfile:1

FROM rust:1-bookworm AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends libpq-dev pkg-config \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Avoid intermittent crates.io HTTP/2 framing errors in CI/Docker builders.
ENV CARGO_HTTP_MULTIPLEXING=false \
  CARGO_NET_RETRY=10

WORKDIR /app

COPY www/package.json www/bun.lock ./www/
RUN cd www && bun install --frozen-lockfile

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY tests/integration ./tests/integration
COPY www ./www

ENV MC_TRACKER_EMBED_BUILD=1 \
  VITE_MC_TRACKER_API_URL= \
  VITE_MC_TRACKER_UI_BASEPATH=/ui

RUN cd www && bun run build
RUN --mount=type=cache,target=/usr/local/cargo/registry \
  --mount=type=cache,target=/usr/local/cargo/git \
  --mount=type=cache,target=/app/target \
  for i in 1 2 3 4 5; do \
    cargo build --release --locked -p mc-tracker && break; \
    echo "cargo build attempt $i failed, retrying..."; \
    sleep $((i * 5)); \
  done \
  && cp /app/target/release/mc-tracker /mc-tracker

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libpq5 wget \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --create-home --home-dir /nonexistent --shell /usr/sbin/nologin mctracker \
  && mkdir -p /data/databases \
  && chown -R mctracker:mctracker /data

COPY --from=builder /mc-tracker /usr/local/bin/mc-tracker

ENV MAXMIND_DATABASE_DIR="/data/databases"
EXPOSE 3000
VOLUME ["/data"]
USER mctracker:mctracker
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD ["wget", "-q", "--spider", "http://127.0.0.1:3000/health"]

ENTRYPOINT ["mc-tracker"]

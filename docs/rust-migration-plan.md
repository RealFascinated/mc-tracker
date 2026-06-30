# Rust Migration Plan — mc-tracker

> **Status:** Draft — partial decisions recorded (see [Design Decisions](#design-decisions))
> **Last updated:** 2026-06-30 (testing strategy + per-phase test matrix)

## Executive Summary

Convert mc-tracker from a Bun/TypeScript Prometheus exporter into a **Rust backend** that:

1. Implements **native Java (Server List Ping)** and **Bedrock (RakNet unconnected ping)** protocols — no `mcping-js`, `mcpe-ping-fixed`, or other external pinger binaries.
2. Embeds a **MaxMind GeoIP/ASN lookup service** — replacing the external McUtils API (`mcutils-js-api` → `GET /api/ips/{ip}`).
3. Persists **tracked servers** and **runtime configuration** in **PostgreSQL** via **Diesel**; **servers loaded into memory on startup only** (pattern from [`maxio`](/data/Projects/maxio/)).
4. **Pushes** player-count metrics to **VictoriaMetrics** on a schedule — **no `/metrics` HTTP endpoint**; **queries VM** via typed PromQL builder (`mc-metrics`) for the dashboard.
5. **Web UI** in **`www/`** (TanStack Start + React) — replaces Grafana; account + admin panels; Rust serves API only.
6. **Accounts** with **roles** (`admin` | `user`) — username/password auth, session cookies. **Sign-up** for normal users (planned); admins bootstrap from env on first boot.
7. **RBAC** — admins use `/admin` (settings + server CRUD); users get a limited account surface (server **suggestions** in a later phase).

The migration should be **behavior-compatible** with production today unless explicitly changed during design review.

**Pinger implementations will be ported from the existing Mc Utils Backend** (Java/Spring), not written from wiki docs alone. That codebase already ships production-tested Java and Bedrock pingers with custom packet framing.

---

## Current State (TypeScript)

| Concern | Implementation |
|---------|----------------|
| Runtime | Bun 1.3, compiled to `tracker` binary |
| Java ping | `mcping-js` — TCP Server List Ping, protocol version **765** hardcoded |
| Bedrock ping | `mcpe-ping-fixed` — UDP RakNet-style ping |
| DNS | Node `dns.resolveSrv` for `_minecraft._tcp.<host>` (Java only); fallback port 25565 |
| ASN enrichment | McUtils HTTP API — fields used: `asn`, `asnOrg`, `cidr` |
| Metrics | `prom-client` gauge — **pull** via `GET /metrics` on scrape |
| Config | `data/servers.json` + env vars (timeout, retries, environment) — **replaced by Postgres** in Rust |
| Frontend | **Grafana** dashboard (`dashboard.yml`) queries VictoriaMetrics |
| CLI | `add-server` command — **removed**; Admin panel in web UI in Rust |
| Deploy | Docker/Dokku — **out of scope** for this plan |

### Current data flow (today)

```
servers.json → ServerManager → parallel ping (on scrape)
                                    ↓
                              McUtils API (ASN)
                                    ↓
                         GET /metrics ← Prometheus/VictoriaMetrics scrape
                                    ↓
                         Grafana queries VictoriaMetrics (dashboard.yml)
```

### Known gaps in current TS code (opportunities)

- `PINGER_DNS_INVALIDAION_CRON` is validated but never used — **Rust replaces with TTL cache** (see design decision #12).
- Bedrock has no SRV records — hostname + port only (Java uses `_minecraft._tcp` SRV only).
- Java protocol version is fixed at 765.
- `dotenv` is a dependency but never loaded.
- Geo fields from McUtils (`country`, `city`, etc.) are available but unused.

---

## Target Architecture (Rust)

### Proposed crate layout

```
mc-tracker/
├── Cargo.toml                 # workspace root
├── crates/
│   ├── mc-tracker/            # binary: REST API + VM push loop (axum)
│   ├── mc-db/                 # Diesel: migrations, schema.rs, repos
│   ├── mc-ping/               # Java + Bedrock pingers
│   ├── mc-geo/                # MaxMind ASN lookup
│   ├── mc-metrics/            # push registry + VM PromQL query builder + client
│   ├── mc-api-types/          # HTTP JSON DTOs (request + response) — shared by axum + www
├── www/                       # TanStack Start + React UI (see opnsense-router/www)
├── dashboard.yml              # reference spec for dashboard parity (retire in Phase 7)
└── docs/
    └── rust-migration-plan.md
```

**Split stack** (same pattern as [`opnsense-router`](/data/Projects/opnsense-router/)): Rust serves **`/api/*`** only; the **`www/`** app serves all UI routes via TanStack Start (Vite build + SSR in prod).

No CLI crate. No `servers.json`. Servers persisted in Postgres, **held in memory** after startup load.

### Target data flow

```
Startup: Postgres → load settings + servers into memory (ServerManager)
                ↓
         Push loop (interval): ping in-memory servers → POST VictoriaMetrics
                ↓
         Rust HTTP (settings.api_port): /api/* + /health  (axum — no UI)
                ↓
         www/ TanStack Start: /, /login, /account, /admin  (separate dev port)
                ↓
         www → fetch Rust API (VITE_MC_TRACKER_API_URL, credentials: include)
```

Admin mutations write Postgres **and** update in-memory state immediately (no DB re-fetch per push). The dashboard reads **live counts from `ServerManager`** and **historical series from VictoriaMetrics** via the **`mc-metrics` query builder** — same data Grafana used, different frontend.

---

## Reference Implementation — Mc Utils Backend

The Rust `mc-ping` and `mc-geo` crates should be **direct ports** of the Mc Utils Backend code at:

`/data/Projects/Mc Utils/Backend/src/main/java/xyz/mcutils/backend/`

### Key source files

| Concern | Mc Utils path |
|---------|---------------|
| Pinger trait | `service/pinger/MinecraftServerPinger.java` |
| Java pinger | `service/pinger/impl/JavaMinecraftServerPinger.java` |
| Bedrock pinger | `service/pinger/impl/BedrockMinecraftServerPinger.java` |
| Java VarInt + packet base | `common/packet/MinecraftJavaPacket.java` |
| Java handshake | `common/packet/impl/java/JavaPacketHandshakingInSetProtocol.java` |
| Java status request/response | `common/packet/impl/java/JavaPacketStatusInStart.java` |
| Bedrock unconnected ping | `common/packet/impl/bedrock/BedrockPacketUnconnectedPing.java` |
| Bedrock unconnected pong | `common/packet/impl/bedrock/BedrockPacketUnconnectedPong.java` |
| Protocol version enum | `common/JavaMinecraftVersion.java` |
| Bedrock token parser | `model/domain/server/bedrock/BedrockMinecraftServer.java` (`create()`) |
| Java status JSON | `model/token/server/JavaServerStatusToken.java` |
| DNS (SRV + A + cache) | `service/DNSService.java` |
| Ping orchestration | `service/ServerService.java` (`getServer()`) |
| MaxMind download + lookup | `service/MaxMindService.java` |
| Metric registry | `service/MetricService.java` |
| Prometheus text encode | `controller/IndexController.java` (`getMetrics()`) |

### What mc-tracker needs vs what Mc Utils returns

Mc Utils pingers return rich server objects. mc-tracker **parses and types** the extra fields but **only uses `player_count` for now** (metrics unchanged):

```rust
pub struct Ping {
    pub timestamp: i64,
    pub ip: String,
    pub players: Players,
    pub motd: Option<Motd>,
    pub version: Option<ServerVersion>,
}

pub struct Players {
    pub online: u32,
    pub max: Option<u32>,
}

pub struct Motd {
    pub raw: String,
}

pub struct ServerVersion {
    pub name: String,
    pub protocol: Option<u32>, // Java protocol number; Bedrock uses string name primarily
}
```

Port the **full packet/DNS logic** from Mc Utils; populate all fields when parsing. **Do not** expose MOTD/max players/version in Prometheus or admin UI until explicitly requested later.

---

## Reference Implementation — Mc Utils Metrics (encode pattern)

Mc Utils Backend exposes **`GET /metrics`** (pull). mc-tracker uses the same **registry + text encoding** internally but **never serves `/metrics`** — encoded bytes are POSTed to VictoriaMetrics only.

### Key source files

| Concern | Mc Utils path |
|---------|---------------|
| Metric registry | `service/MetricService.java` — `PrometheusRegistry`, register gauges/counters |
| Scrape + encode | `controller/IndexController.java` — `REGISTRY.scrape()` → `PrometheusTextFormatWriter` |
| Gauge definition | `metric/GaugeWithCallbackMetric.java` + domain metrics (e.g. `ServerLookupMetric`) |

### mc-tracker push flow (adapt from Mc Utils)

```
1. On interval (settings.metrics_push_interval_seconds):
2. Ping all servers concurrently (ServerManager)
3. Set gauge values on in-process Prometheus registry
4. registry.gather() → Prometheus text exposition format
5. POST body to VictoriaMetrics import URL
```

**VictoriaMetrics endpoint:** `POST {victoriametrics_url}` — typically `/api/v1/import/prometheus` with `Content-Type: text/plain` (Prometheus exposition format, same bytes Mc Utils writes to HTTP responses).

### Pull vs push

| | mc-tracker TS (today) | Mc Utils Backend | mc-tracker Rust (**decided**) |
|--|----------------------|------------------|-------------------------------|
| Trigger | VictoriaMetrics/Prometheus **scrapes** `/metrics` | External scrape of `/metrics` | App **pushes** on timer |
| Ping timing | On each scrape | N/A (different metrics) | On each push interval |
| HTTP `/metrics` | Yes | Yes | **No — endpoint does not exist** |
| Grafana | Queries VictoriaMetrics | Queries VictoriaMetrics | **Built-in dashboard** queries VM (Grafana retired) |

### DNS resolution (follow Mc Utils, not current TS)

Mc Utils `ServerService.getServer()` resolves DNS before pinging:

1. **Java only:** SRV lookup `_minecraft._tcp.<hostname>` → rewrite hostname + port from SRV target
2. **Both platforms:** A record lookup on hostname → require resolved IPv4 for ASN lookup
3. **Bedrock:** no SRV — Bedrock has no SRV records; use configured hostname + port (default 19132)
4. **DNS TTL cache** (**decided**): in-memory cache with `expireAfterWrite` for SRV and A lookups — port Mc Utils `DNSService` (`DNS_CACHE_ENABLED`, `DNS_CACHE_TTL` minutes; default **5**, matches Mc Utils)

Current mc-tracker TS only does Java SRV and uses the SRV target hostname directly without a separate A lookup. **Rust should follow Mc Utils** for consistency with the reference pingers.

---

## Reference Implementation — Maxio (Postgres + Diesel)

Persistence and DB patterns follow [`/data/Projects/maxio/`](/data/Projects/maxio/) — embedded migrations at boot, hand-maintained `schema.rs`, async pool via `diesel-async` + `deadpool`, functional repos.

### Key maxio source files

| Concern | Maxio path |
|---------|------------|
| Pool + embedded migrations | `src/db/mod.rs` |
| Schema (`diesel::table!`) | `src/db/schema.rs` |
| Migrations | `src/db/migrations/{timestamp}_{name}/up.sql` + `down.sql` |
| Repo helpers | `src/db/repos/mod.rs` (`get_conn`, `db_err`) |
| Example repo | `src/db/repos/buckets.rs` |
| DbContext | `src/db/context.rs` |
| Bootstrap env (secrets + DB URL only) | `src/config.rs` |
| Console login + session cookies | `src/api/console/auth.rs`, `session.rs` |
| Login rate limiting | `src/api/console/session.rs` (`LoginRateLimiter`) |
| Auth middleware | `src/api/console/auth.rs` (`console_auth_middleware`) |
| App startup wiring | `src/app.rs` |
| Integration test DB | `tests/integration/common.rs` |
| Unit + integration tests | `tests/unit/`, `tests/integration/` (maxio pattern) |

### mc-tracker adaptations

| Maxio pattern | mc-tracker equivalent |
|---------------|----------------------|
| `embed_migrations!` + run on boot | Same in `mc-db` |
| `DbPool` = `deadpool` + `AsyncPgConnection` | Same |
| Domain models outside Diesel | `Server`, `AppSettings` in `mc-db` or small `mc-domain` types |
| Repos as free functions | `repos/servers.rs`, `repos/settings.rs` |
| Env: `MAXIO_DATABASE_URL` | `DATABASE_URL` (or `MC_TRACKER_DATABASE_URL`) |
| Env: bootstrap only | `DATABASE_URL`, pool size, `MAXMIND_LICENSE_KEY`, `SESSION_SECRET`, admin bootstrap creds — no auto-import |
| Postgres stores entities | **`servers`**, **`users`** (with `role`), **`server_suggestions`** (future) |
| Postgres stores tunables | **`settings` table** (replaces most env vars) |
| Console session auth | HMAC-signed HttpOnly cookie — port maxio `session.rs` pattern |

### Config split: env vs Postgres

**Environment only** (bootstrap + secrets — cannot live in DB):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection (required to boot) |
| `MC_TRACKER_DB_POOL_SIZE` | Connection pool size (optional, default from maxio-style) |
| `MAXMIND_LICENSE_KEY` | MaxMind download secret |
| `VICTORIAMETRICS_AUTH_TOKEN` | Optional Bearer token for VictoriaMetrics **push and query** |
| `SESSION_SECRET` | HMAC key for signing session cookies (required to boot) |
| `MC_TRACKER_ADMIN_USERNAME` | Bootstrap only — creates first admin if `users` table is empty |
| `MC_TRACKER_ADMIN_PASSWORD` | Bootstrap only — paired with `MC_TRACKER_ADMIN_USERNAME` |
| `RUST_LOG` / log level | Early boot logging before settings load (optional override) |

**Postgres `settings` table** (key → value, seeded with defaults on first migration):

| Key | Former source | Default |
|-----|---------------|---------|
| `api_port` | `API_PORT` | `3000` |
| `api_address` | new | `0.0.0.0` |
| `environment` | `ENVIRONMENT` | `development` |
| `pinger_timeout_ms` | `PINGER_TIMEOUT` | `5000` |
| `pinger_retry_attempts` | `PINGER_RETRY_ATTEMPTS` | `3` |
| `pinger_retry_delay_ms` | `PINGER_RETRY_DELAY` | `1000` |
| `dns_cache_enabled` | new | `true` |
| `dns_cache_ttl_minutes` | Mc Utils | `5` |
| `maxmind_database_dir` | `MAXMIND_DATABASE_DIR` | `databases` |
| `victoriametrics_url` | new | `http://localhost:8428/api/v1/import/prometheus` |
| `victoriametrics_query_url` | new | `http://localhost:8428` (VM base URL for PromQL `/api/v1/query` + `/api/v1/query_range`) |
| `metrics_push_interval_seconds` | new | `10` (match current Grafana dashboard refresh) |
| `sign_up_enabled` | new | `false` (enable public registration when ready) |

Settings loaded at startup into `AppSettings`. **Admin panel** updates settings in Postgres and refreshes in-memory `AppSettings` immediately on save where possible (see [Settings hot-reload](#settings-hot-reload)).

### Initial schema (migration `20250630000000_initial`)

```sql
-- servers (replaces servers.json)
CREATE TABLE servers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    host        TEXT NOT NULL,
    port        INTEGER,
    platform    TEXT NOT NULL CHECK (platform IN ('PC', 'PE')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX servers_host_port_platform_idx ON servers (host, COALESCE(port, -1), platform);

-- settings (replaces most env vars)
CREATE TABLE settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- users (username/password auth + role)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        TEXT NOT NULL,
    password_hash   TEXT NOT NULL,   -- argon2id PHC string
    role            TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX users_username_idx ON users (username);

-- server suggestions (v2 — users propose, admins approve)
CREATE TABLE server_suggestions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggested_by        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    host                TEXT NOT NULL,
    port                INTEGER,
    platform            TEXT NOT NULL CHECK (platform IN ('PC', 'PE')),
    status              TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    reviewer_note       TEXT,
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX server_suggestions_status_idx ON server_suggestions (status);
CREATE INDEX server_suggestions_suggested_by_idx ON server_suggestions (suggested_by);
```

**Uniqueness:** `(host, port, platform)` — not `name` alone. Production `servers.json` has duplicate names (e.g. Cubecraft PC + PE on the same host).

Seed `settings` rows in the same migration (or `20250630000001_seed_settings`) with defaults above. **Do not** seed a default password in SQL — bootstrap via env (see [Authentication](#authentication)).

**Field naming:** DB column `platform` (`PC` \| `PE`); JSON API + Prometheus label use **`type`** (same values). Admin forms use `platform`; public list responses expose `type`.

### Cutover: `servers.json` → Postgres

One-time script at deploy (Phase 7 — not a runtime CLI). Source: legacy `data/servers.json` (see `old code/data/servers.json` in repo during migration).

| JSON field | Postgres column | Notes |
|------------|-----------------|-------|
| `id` | `id` | Preserve existing UUIDs |
| `name` | `name` | Display name (not unique) |
| `ip` | `host` | Hostname only — no `host:port` split in legacy file |
| `type` | `platform` | `PC` / `PE` |
| — | `port` | `NULL` → pinger defaults (25565 Java, 19132 Bedrock) |

Validate no duplicate `(host, port, platform)` before insert. Optional `scripts/import-servers-json.rs` one-shot binary (dev-only, not shipped).

### Settings hot-reload

| Setting | Hot-reload | Notes |
|---------|------------|-------|
| `pinger_*`, `dns_cache_*`, `metrics_push_interval_seconds` | **Yes** | Next push cycle picks up values |
| `environment`, VM URLs, `maxmind_database_dir` | **Yes** | VM queries/push use new values immediately |
| `victoriametrics_*` | **Yes** | |
| `sign_up_enabled` | **Yes** | |
| `api_port`, `api_address` | **No** | Requires process restart (HTTP bind) |

### Startup sequence (maxio-style)

```
1. Read DATABASE_URL, SESSION_SECRET from env
2. db::run_migrations(&database_url)
3. pool = db::create_pool(...)
4. If users table empty → create **admin** from MC_TRACKER_ADMIN_USERNAME/PASSWORD with `role = 'admin'` (fail fast if missing)
5. settings = repos::settings::load_all(&pool) → AppSettings (in memory)
6. servers = repos::servers::list(&pool) → ServerManager in-memory vec
7. Wire mc-ping, mc-geo; start VM push loop + HTTP server (dashboard + admin + auth)
```

**ServerManager:** in-memory list loaded **once at startup**. Push loop iterates memory only. Admin panel server CRUD updates DB + in-memory list (and ASN cache lives on in-memory `TrackedServer` structs, like TS today).

---

## Web UI — Dashboard & Admin

The web UI has **three surfaces**. **Production:** reverse proxy serves `www/` and `/api` on one origin. **Dev:** Rust API on `api_port` (default 3000), Vite on 5173 — CORS + `credentials: include`.

| Surface | Route prefix | Auth | Purpose |
|---------|--------------|------|---------|
| **Dashboard** | `/` | **Public** | Replaces Grafana — live stats + historical charts |
| **Account** | `/account` | **Session** (`user` or `admin`) | Profile, change password; **server suggestions** (v2) |
| **Admin panel** | `/admin` | **Session + `admin` role** | Settings, server CRUD, review suggestions (v2) |

Grafana is **retired** after cutover. `dashboard.yml` remains in-repo as the **functional spec** for dashboard parity until Phase 7 removes it.

### Dashboard (Grafana replacement)

Port the panels and variables from `dashboard.yml` into a native web UI. Historical charts use **`mc-metrics` query builder** on the backend (VM URL never exposed to browser).

**Overview stats:**

| Panel | Source |
|-------|--------|
| Players online (PC / PE) | **In-memory** — sum `playersOnline` by `type` on `ServerManager` |
| Players online (total) | **In-memory** — sum `playersOnline` across `ServerManager` |
| Tracked servers | **In-memory** — `ServerManager` count |
| Last updated | `summary.lastUpdated` — Unix epoch **ms** (see below) |
| Peak players (24h) | VM instant — `max_over_time(sum(...)[24h:])` |
| Peak players (30d) | VM instant — `max_over_time(sum(...)[30d:])` |

Grafana `dashboard.yml` PromQL for the live totals is **parity reference only** — the API does not re-query VM for current counts.

**Time-series charts** (range queries — all via `GET /api/servers/{uuid}/timeseries`):

| Panel | `www/` approach |
|-------|-----------------|
| Overall player count | Fetch timeseries for each tracked server (parallel); **sum** aligned `playersOnline` client-side (same `from`/`to` → same `step`) |
| Per ASN (log + linear) | Group servers by `asnOrg` from `GET /api/servers`; sum per-group timeseries client-side |
| Per server (log + linear) | One `{uuid}/timeseries` request per server line (ASN filter applied client-side over server list) |
| Single-server detail | Selected server → `GET /api/servers/{uuid}/timeseries` |

No separate aggregate timeseries route — **two public endpoints only:** `GET /api/servers` and `GET /api/servers/{uuid}/timeseries`.

**Dashboard variables** (UI filters, same as Grafana):

- **ASN** (`asn_org`) — dropdown; filters per-server charts
- **Server** — dropdown built from `name (type) asn_org` label join pattern in `dashboard.yml`

**Refresh:** poll dashboard API on `metrics_push_interval_seconds` (default 10s) — same cadence as Grafana auto-refresh.

#### `GET /api/servers`

Returns tracked servers and live summary from in-memory **`ServerManager`** (latest push-cycle ping results). **No VM query** for current counts — only historical peaks hit VictoriaMetrics.

Each `TrackedServer` holds config plus runtime state updated every push cycle: `playersOnline`, `lastPingAt` (epoch ms). Offline / failed pings omit the server from player sums (same as push: gauge not set).

```json
{
  "summary": {
    "totalPlayers": 1234,
    "playersPc": 900,
    "playersPe": 334,
    "trackedServers": 42,
    "lastUpdated": 1748735992000,
    "peakPlayers24h": 1500,
    "peakPlayers30d": 2100
  },
  "servers": [
    {
      "id": "uuid",
      "name": "Hypixel",
      "type": "PC",
      "host": "mc.hypixel.net",
      "port": 25565,
      "asn": "AS13335",
      "asnOrg": "Cloudflare",
      "playersOnline": 45000
    }
  ]
}
```

`summary.totalPlayers`, `summary.playersPc`, `summary.playersPe`, and `summary.trackedServers` — aggregated from **`ServerManager`** (not VictoriaMetrics).

`summary.peakPlayers24h` / `summary.peakPlayers30d` — VM instant queries via query builder.

`summary.lastUpdated` — Unix epoch **milliseconds** (max `lastPingAt` across servers with a successful ping). UI formats relative time client-side (e.g. "8s ago").

ASN / server dropdown filters in the UI are **client-side** over this list (no separate variables endpoint).

#### `GET /api/servers/{uuid}/timeseries?from={epoch}&to={epoch}`

Historical player count for one server. Response shape mirrors Server Monitor `ServerMetricsResponse` / `MetricsResponse`:

```json
{
  "id": "uuid",
  "from": 1748736000,
  "to": 1749340800,
  "step": 900,
  "timestamps": [1748736000, 1748736900, "..."],
  "playersOnline": [120, 135, null, 140]
}
```

- `from` / `to` — echoed from request (after validation; `to` clamped to now if future)
- `step` — **server-computed** seconds (see step policy below)
- `timestamps` + `playersOnline` — aligned series (max **400** points)

Invalid UUID → `404`. Unknown server id → `404`. Bad window → `400`.

**Environment filter:** all VM queries inject `environment` from Postgres `settings.environment` (must match pushed metric label).

### Admin panel

**`admin` role only.** Operators manage the tracker:

- Settings forms (`api_port`, pinger, DNS, MaxMind, VM URLs, push interval, `environment`, `sign_up_enabled`)
- Server list + add/edit/remove (direct CRUD — not via suggestions)
- Review / approve / reject **server suggestions** (v2)
- User management (promote/demote role — v2+; out of scope for initial admin UI)

### Account (authenticated users)

**Any logged-in user** (`user` or `admin`):

- Change password, logout
- View own profile (`username`, `role`)

**v2 — `user` role only** (admins use admin panel for direct server CRUD):

- Submit **server suggestions** (`name`, `host`, `port`, `platform`) → `server_suggestions` row with `status = pending`
- List own pending/approved/rejected suggestions

Admins approve suggestions in `/admin` → creates `servers` row + updates in-memory `ServerManager` (same path as manual add).

### Metrics API (public)

Dashboard data uses a **typed VictoriaMetrics query builder** in `mc-metrics` — reference: [`Server Monitor/API`](/data/Projects/Server%20Monitor/API/) (`VictoriaMetricsQuery`, `MetricQueryWindow`, `MetricStepPolicy`).

**Primary endpoints** (public — no auth):

| Route | Purpose |
|-------|---------|
| `GET /api/servers` | All tracked servers + live `summary` from **`ServerManager`**; peaks from VM |
| `GET /api/servers/{uuid}/timeseries?from=&to=` | Historical player count for one server |

**Admin CRUD** uses a separate path to avoid collision: `GET/POST/PUT/DELETE /api/admin/servers` (admin role).

Clients pass **`from` and `to` as Unix epoch seconds** only. **`step` is never a query param** — the server computes it from the window span with a **max of 400 points** (Server Monitor `MetricStepPolicy`).

See [VictoriaMetrics query builder](#victoriametrics-query-builder).

Optional `VICTORIAMETRICS_AUTH_TOKEN` forwarded on VM HTTP requests (push + query).

### UI tech (**decided** — TanStack Start + React)

Follow [`opnsense-router/www`](/data/Projects/opnsense-router/www/) conventions:

| Layer | Choice | Reference (opnsense-router) |
|-------|--------|----------------------------|
| Framework | **TanStack Start** + **React 19** | `vite.config.ts` — `tanstackStart()` plugin |
| Routing | **TanStack Router** (file routes) | `src/routes/`, `routeTree.gen.ts` |
| Data fetching | **TanStack Query** | `src/lib/api/*`, `queryOptions()` helpers |
| Charts | **uPlot** | `src/components/metrics/metric-chart*.tsx` |
| Styling | **Tailwind CSS 4** + **shadcn/radix** | `src/styles.css`, `components/ui/` |
| Env validation | **`@t3-oss/env-core`** + zod | `src/env.ts` — `VITE_MC_TRACKER_API_URL` |
| Package manager | **Bun** (match mc-tracker TS legacy) | `www/package.json`, `bun.lock` |
| Dev | `bun run dev` (Vite, port 3000) | `vite dev --port 3000` |
| Prod | `bun run build` + `srvx` SSR server | `vite build`; `srvx --prod dist/server/server.js` |

**mc-tracker adaptation vs opnsense-router:** opnsense uses **Bearer token** auth (`Authorization` header); mc-tracker uses **HttpOnly session cookies** — all `fetch` calls use `credentials: "include"` (no token in localStorage).

See [Frontend (`www/`)](#frontend-www) for route layout and API client patterns.

---

## Frontend (`www/`)

TanStack Start + React app — **reference implementation:** [`opnsense-router/www`](/data/Projects/opnsense-router/www/).

### Scaffold (mirror opnsense-router)

- [ ] `www/package.json` — TanStack Start, Router, Query, React 19, uPlot, Tailwind 4, shadcn, **Vitest**
- [ ] `www/vite.config.ts` — `tanstackStart()`, `@vitejs/plugin-react`, `@tailwindcss/vite`
- [ ] `www/src/router.tsx` — `QueryClient` + `setupRouterSsrQueryIntegration`
- [ ] `www/src/env.ts` — `VITE_MC_TRACKER_API_URL` (Rust API base, includes `/api` prefix)
- [ ] `www/src/lib/api/url.ts` — `apiUrl(path)` helper (port from opnsense `lib/api/url.ts`)
- [ ] `www/src/lib/api/client.ts` — `apiFetch()` with **`credentials: "include"`** for session cookies

### Route layout (TanStack Router file routes)

```
www/src/routes/
  __root.tsx              # AuthProvider, ThemeProvider, Toaster (like opnsense __root.tsx)
  index.tsx               # public dashboard (Grafana replacement)
  login.tsx               # shared login
  register.tsx            # v2 — sign-up when enabled
  _authenticated.tsx      # session gate → redirect /login
  _authenticated/account.tsx
  _authenticated/account.suggestions.tsx   # v2
  _admin.tsx              # admin role gate → redirect /account or 403
  _admin/admin/
    index.tsx             # admin home / redirect to settings
    settings.tsx
    servers.tsx
    suggestions.tsx       # v2
```

Use `beforeLoad` + `GET /api/auth/me` for role checks (admin layout verifies `role === "admin"`).

### API modules (`www/src/lib/api/`)

Mirror opnsense `lib/api/*` — one file per domain with `fetchX()` + `xQueryOptions()`:

| Module | Rust endpoints |
|--------|----------------|
| `auth.ts` | `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/password`, `/auth/signup` (v2) |
| `servers.ts` | `GET /api/servers`, `GET /api/servers/{id}/timeseries` |
| `admin/servers.ts` | `/admin/servers` CRUD (admin) |
| `settings.ts` | `/settings` (admin) |
| `suggestions.ts` | `/suggestions` (v2) |

TypeScript types in each module **mirror** [`mc-api-types`](#mc-api-types-crate) (opnsense pattern — Rust is canonical; `www` hand-maintains matching TS).

Dashboard charts: port opnsense metric chart stack — `metric-chart.tsx`, `build-chart-config.ts`, uPlot theme helpers — adapted for timeseries response shapes from `mc-api-types`.

### Auth context (`www/src/lib/auth/`)

- `AuthProvider` + `useAuth()` — wraps `/api/auth/me`, login/logout mutations
- **Cookie sessions** — no Bearer token / localStorage (unlike opnsense `lib/auth/token.ts`)
- On `401`, clear session state and redirect to `/login`
- Expose `{ user: { username, role }, isAuthenticated, login, logout }`

### Dev workflow

```bash
# Terminal 1 — Rust API (Postgres required)
cargo run -p mc-tracker

# Terminal 2 — frontend HMR
cd www && VITE_MC_TRACKER_API_URL=http://localhost:3000/api bun run dev
```

Rust `api_port` default `3000` matches opnsense API port; run Vite on **5173** or configure Vite `server.port` to avoid clash (opnsense uses Vite on 3000 because API is separate `BIND_ADDR`). **Recommend:** Rust API on `3000`, Vite dev on `5173`, `VITE_MC_TRACKER_API_URL=http://localhost:3000/api`.

### Production build

```bash
cd www && bun run build
cd www && bun run start   # srvx SSR — port from PORT env
```

Reverse proxy (deployment out of scope) routes `/api` → Rust, `/` → www SSR server — or same host with path-based routing.

### mc-api-types crate (**decided**)

Like opnsense [`demarc-api-types`](/data/Projects/opnsense-router/crates/demarc-api-types/) — **all HTTP JSON DTOs** live in `crates/mc-api-types/`. Axum handlers serialize/deserialize these types only; **`www/` TypeScript types mirror them** (same pattern as opnsense: Rust is source of truth, TS hand-maintained per `lib/api/*` module).

```
crates/mc-api-types/
├── src/
│   ├── lib.rs
│   ├── request/          # inbound query params + JSON bodies (Deserialize, camelCase)
│   └── response/         # outbound JSON bodies (Serialize, camelCase)
```

| Module | DTOs |
|--------|------|
| `response/servers.rs` | `ServersListResponse`, `ServerSummary`, `ServerRow`, `ServerTimeSeriesResponse` |
| `response/settings.rs` | `SettingsResponse`, … |
| `request/settings.rs` | `PatchSettingsRequest` (partial update) |
| `response/auth.rs` | `MeResponse`, `LoginResponse`, … |
| `request/auth.rs` | `LoginRequest`, `ChangePasswordRequest`, … |
| `request/servers.rs` | `CreateServerRequest`, `UpdateServerRequest`, … |

Use `#[serde(rename_all = "camelCase")]` on all public API types. VM-internal parse types stay in `mc-metrics` — only **REST API** shapes belong here.

Contract tests: handler JSON round-trips against `mc-api-types` structs; CI or integration tests assert `www` TS types stay aligned (or add a JSON fixture snapshot per endpoint).

Shared error body (all `/api/*`): `{ "error": "Human-readable message" }` — define `ErrorResponse` in `mc-api-types`.

**Tests:** `#[test]` per DTO — serialize/deserialize golden JSON in `crates/mc-api-types/tests/`; reject unknown enum values; camelCase enforcement.

---

## VictoriaMetrics query builder

Rust **`mc-metrics`** crate — typed PromQL + VM client. **Primary reference:** [`Server Monitor/API`](/data/Projects/Server%20Monitor/API/) (production VM query stack). Metric name/label constants also follow maxio [`src/metrics/prometheus.rs`](/data/Projects/maxio/src/metrics/prometheus.rs) style.

### Server Monitor reference files

| Concern | Server Monitor path |
|---------|---------------------|
| Fluent query builder | `metrics/vm/query/VictoriaMetricsQuery.java` |
| PromQL helpers | `metrics/vm/query/Promql.java` |
| VM HTTP client | `metrics/vm/query/VictoriaMetricsQueryClient.java` |
| Range window + step | `model/domain/metric/MetricQueryWindow.java` |
| **Max 400 points step** | `model/domain/metric/MetricStepPolicy.java` |
| VM response parse | `metrics/vm/query/VmQueryResponse.java`, `VmTimeSeries.java` |
| List + timeseries API | `controller/v1/UserController.java` — `GET /servers`, `GET /servers/{id}/metrics` |
| Step policy tests | `test/.../MetricStepPolicyTest.java` |

mc-tracker renames `{id}/metrics` → `{uuid}/timeseries` and uses UUID server ids.

### Crate layout (`mc-metrics`)

```
crates/mc-metrics/
├── src/
│   ├── lib.rs
│   ├── schema.rs              # METRIC_PLAYER_COUNT + label name constants
│   ├── push/                  # registry + text encode (Mc Utils MetricService port)
│   ├── query/
│   │   ├── mod.rs
│   │   ├── promql.rs          # vector selectors, label escaping (port Promql.java)
│   │   ├── vm_query.rs        # VictoriaMetricsQuery builder (port VictoriaMetricsQuery.java)
│   │   ├── step_policy.rs     # MAX_POINTS=400, nice intervals (port MetricStepPolicy.java)
│   │   ├── query_window.rs    # parse from/to epochs (port MetricQueryWindow.java)
│   │   └── server_queries.rs  # per-server + aggregate PromQL for /servers endpoints
│   ├── client.rs              # VmQueryClient (port VictoriaMetricsQueryClient.java)
│   ├── time_grid.rs           # align VM samples to step grid (optional; see Server Monitor MetricTimeGrid)
│   └── response.rs            # VM JSON parse types (internal — not public API DTOs)
```

### Step policy (**decided** — max 400 points)

Port Server Monitor `MetricStepPolicy` verbatim:

| Constant | Value |
|----------|-------|
| `MAX_POINTS` | **400** |
| `MIN_STEP` | 15 seconds |
| `MIN_SPAN` | 5 minutes |
| `MAX_SPAN` | 730 days (2 years) |
| Nice steps | 15s, 30s, 1m, 2m, 5m, 15m, 30m, 1h, 2h, 6h, 1d, 2d |

```rust
// step = max(MIN_STEP, span / MAX_POINTS), snapped to next nice interval
pub fn step_for(span: Duration) -> Duration;
```

`MetricQueryWindow::parse(from_epoch, to_epoch)`:

1. Clamp `to` to `now` if future
2. Reject `from >= to`, span `< 5 min`, span `> 2 years`
3. Compute `step = step_for(span)` — **never accept step from client**

### Query builder API (port `VictoriaMetricsQuery.Builder`)

```rust
VmQuery::builder()
    .metric(METRIC_PLAYER_COUNT)
    .label(labels::ENVIRONMENT, env)
    .label(labels::ID, server_uuid)
    .from(window.from())
    .to(window.to())
    .step(window.step())          // from MetricQueryWindow, not client
    .build();

// or raw PromQL for aggregates (peak 24h, etc.)
VmQuery::builder()
    .query(server_queries::peak_players_24h(env))
    .at(Instant::now())
    .build();
```

### Server query helpers (`server_queries.rs`)

| Function | Used by |
|----------|---------|
| `player_count_series(env, server_id, window)` | `GET /api/servers/{uuid}/timeseries` |
| `peak_players_24h(env)`, `peak_players_30d(env)` | `GET /api/servers` — `summary.peakPlayers*` only |

### VM client

```rust
pub struct VmQueryClient { /* base_url, auth_token, reqwest */ }

impl VmQueryClient {
    pub async fn execute(&self, query: &VmQuery) -> Result<VmQueryResponse, VmError>;
}
```

Range URI: `/api/v1/query_range?query=…&start=…&end=…&step=15s` (step formatted like Server Monitor `formatStep`).

### HTTP handler flow

```
GET /api/servers
  → ServerManager::list() — config + playersOnline + lastPingAt per server
  → ServerManager::summary() — totalPlayers, playersPc, playersPe, trackedServers, lastUpdated (in-memory)
  → server_queries::peak_players_24h + peak_players_30d (VM instant, parallel)
  → ServersListResponse JSON

GET /api/servers/{uuid}/timeseries?from=&to=
  → MetricQueryWindow::parse(from, to)  // step computed, max 400 points
  → verify uuid in ServerManager
  → server_queries::player_count_series(uuid, window)
  → VmQueryClient::execute
  → align to grid → ServerTimeSeriesResponse JSON
```

`www/` calls **`/api/servers`** and **`/api/servers/{uuid}/timeseries`** only — never PromQL, never `step`. Aggregate dashboard charts sum aligned per-server series in the browser (TanStack Query parallel fetches).

### Tests

- [ ] Unit: `step_for` matches `MetricStepPolicyTest` cases (1h→15s, 7d→30m, 365d→1d)
- [ ] Unit: `MetricQueryWindow::parse` rejects short/long spans, clamps future `to`
- [ ] Unit: point count for any valid window ≤ 400
- [ ] Unit: PromQL label escaping; builder fluent API (port Server Monitor builder tests)
- [ ] Golden: PromQL strings for peak + per-server queries vs `dashboard.yml`
- [ ] Integration: wiremock VM — parse real `query_range` JSON → aligned timestamps + values
- [ ] Contract: handler JSON matches `mc-api-types` + `tests/fixtures/api/*.json` snapshots
- [ ] Contract: `www` TS types manually aligned — add Vitest fixture parse tests in Phase 6

See [Testing strategy](#testing-strategy) for full matrix.

## Authentication & roles

Accounts use **username + password** in Postgres with a **`role`** column. Sessions are **signed HttpOnly cookies** — same approach as [maxio console auth](/data/Projects/maxio/src/api/console/auth.rs).

The **public dashboard** (`/`, `GET /api/servers`, `GET /api/servers/{uuid}/timeseries`) does **not** require login.

### Roles

| Role | DB value | Capabilities |
|------|----------|--------------|
| **Admin** | `admin` | Full `/admin` access: settings, direct server CRUD, review suggestions (v2), toggle `sign_up_enabled` |
| **User** | `user` | Dashboard (public) + `/account`: change password, **submit server suggestions** (v2) — no settings or direct server edits |

New self-registrations always get `role = 'user'`. **Only bootstrap** and explicit admin promotion create `admin` users (v1: bootstrap env only; v2+: admin UI or SQL).

Rust enum: `UserRole { Admin, User }` mapped to DB text via Diesel.

### Threat model

- Multi-user accounts with **two-tier RBAC** — not full IAM
- **Protect admin settings and server CRUD** to `admin` role
- **Users** can only mutate their own suggestions (v2), not tracked servers
- **Public dashboard** exposes aggregated player counts (same as Grafana today)
- Resist credential stuffing on login and sign-up
- No SSO/OAuth in v1 (can add later)

### Data model

| Column | Purpose |
|--------|---------|
| `users.username` | Unique login name (case-sensitive) |
| `users.password_hash` | **argon2id** PHC string (`argon2` crate; params: OWASP defaults) |
| `users.role` | `admin` or `user` — checked on every privileged request |

Passwords are **never** stored in `settings`, env (except one-time bootstrap), or logs.

### Bootstrap (first boot)

After migrations, if `SELECT COUNT(*) FROM users = 0`:

1. Require `MC_TRACKER_ADMIN_USERNAME` and `MC_TRACKER_ADMIN_PASSWORD` in env
2. Hash password with argon2id → insert row with **`role = 'admin'`**
3. Log info: bootstrap admin created (username only — never log password)
4. On subsequent boots, bootstrap env vars are **ignored** (change password via account UI)

If users exist but bootstrap env is set, ignore env — avoids accidental overwrite.

### Sign-up (v2 — schema ready in v1)

When `settings.sign_up_enabled = true`:

1. `POST /api/auth/signup` — `{ "username", "password" }` → create user with `role = 'user'`
2. Rate-limited like login; generic errors (no username enumeration)
3. Optional: auto-login after sign-up (set session cookie) or redirect to `/login`
4. Disabled when `sign_up_enabled = false` → `403 Registration disabled`

**v1:** sign-up endpoint returns `403` or is not registered; only bootstrap admin exists until sign-up is enabled.

### Session model (maxio-style)

| Item | Value |
|------|-------|
| Cookie name | `mc_tracker_session` |
| Signing | HMAC-SHA256 over `{user_id}:{username}:{role}:{issued_at}` using `SESSION_SECRET` |
| Cookie flags | `HttpOnly`, `SameSite=Strict`, `Path=/`; `Secure` when not in dev |
| Max age | **7 days** (match maxio `TOKEN_MAX_AGE_SECS`) |
| Storage | Stateless signed cookie — no `sessions` table in v1 |
| Logout | Set cookie max-age 0 + in-memory revocation set (maxio `RevokedSessions`) |

Validate on each request: signature, expiry, not revoked, user still exists in DB. **Re-load `role` from DB** if token predates a role change (or embed role in token and reject if DB role differs — prefer DB lookup on admin routes).

### HTTP routes

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/auth/login` | Public | `{ "username", "password" }` → `Set-Cookie` + `{ ok, username, role }` |
| `POST /api/auth/signup` | Public (v2) | `{ "username", "password" }` → new `user`; gated by `sign_up_enabled` |
| `POST /api/auth/logout` | Session | Clear cookie + revoke token |
| `GET /api/auth/me` | Session | `{ username, role }` — UI bootstraps auth state |
| `PATCH /api/auth/password` | Session | `{ currentPassword, newPassword }` — any authenticated user |
| `GET /api/servers` | **Public** | Server list + live summary from `ServerManager` (peaks from VM) |
| `GET /api/servers/{uuid}/timeseries` | **Public** | Per-server player count history (`from`, `to` epoch seconds) |
| `GET/POST/PUT/PATCH/DELETE /api/admin/servers` | **Admin** | Operator CRUD |
| `GET/POST/PUT/PATCH/DELETE /api/settings` | **Admin** | Settings |
| `GET/POST /api/suggestions`, `PATCH /api/suggestions/{id}` | Session (v2) | Users POST own suggestions; admins PATCH approve/reject |
| Dashboard UI (`www/` routes) | **Public** | Stats + charts (TanStack Start) |
| Account UI (`/account`, `/login`, `/register`) | Mixed | Login/register public; account requires session |
| Admin UI (`/admin/*`) | **Admin** | Settings + server management |
| `GET /health` | **Public** | Liveness — `{ "status": "ok", "db": true, "maxmind": true }` (no secrets) |

Login/sign-up failures return generic `401` / `403` (no username enumeration).

### Middleware (axum)

```
Router (Rust axum — API only)
  ├── /health
  ├── /api/servers, /api/servers/{uuid}/timeseries  → no auth
  ├── /api/auth/login, /api/auth/signup → no auth (+ rate limit)
  ├── nest /api/auth/logout|me|password + /api/suggestions (user)
  │     └── auth_middleware
  └── nest /api/admin/servers + /api/settings + /api/suggestions (admin review)
        └── auth_middleware + require_role(Admin)

UI auth gates live in www/ TanStack Router (_authenticated, _admin layouts)
```

Port from maxio:

- `auth_middleware` — reject unauthenticated with `401` JSON; attach `UserSession`
- `require_role(Admin)` — reject non-admins with `403 Forbidden`
- `LoginRateLimiter` — **10 attempts / 5 min / IP** on login **and sign-up**; `429` + `Retry-After`
- Constant-time password verify via argon2
- Optional `csrf_middleware` for mutating cookie-auth routes (maxio pattern)

### UI flows

**Login (any role):**

1. Visit `/login` → POST `/api/auth/login`
2. Redirect: `admin` → `/admin` (or last page); `user` → `/account` or `/`
3. Nav shows Account; Admin link only if `role === admin`

**Account:**

1. `/account` — profile + change password
2. v2: `/account/suggestions` — submit and track server suggestions

**Admin:**

1. Visit `/admin` without session → `/login?next=/admin`
2. Non-admin with session → `403` or redirect to `/account`
3. Admin manages settings, servers, and (v2) pending suggestions

**Sign-up (v2):**

1. `/register` visible when `sign_up_enabled`; POST `/api/auth/signup` → login or `/login`

### Server suggestions (v2)

Flow for normal users to propose tracked servers without direct CRUD:

```
User POST /api/suggestions { name, host, port, platform }
  → server_suggestions row (status=pending, suggested_by=user.id)
Admin GET /api/suggestions?status=pending
Admin PATCH /api/suggestions/{id} { status: approved, reviewer_note? }
  → insert servers row + ServerManager.append (reuse POST /api/admin/servers logic)
  → or status=rejected with optional note
User GET /api/suggestions (own rows only)
```

Optional v2: admin ping-test before approve (reuse mc-ping from Phase 2).

### Implementation crates

| Concern | Location |
|---------|----------|
| `users`, `server_suggestions` migration + schema | `mc-db` |
| `repos/users.rs` — lookup, create (signup/bootstrap), update password, update role | `mc-db` |
| `repos/suggestions.rs` — CRUD + list pending (v2) | `mc-db` |
| `UserRole` enum + RBAC helpers | `mc-db` or `mc-tracker/src/auth/roles.rs` |
| Password hash/verify | `mc-tracker/src/auth/password.rs` |
| Session token + cookie + rate limiter | `mc-tracker/src/auth/session.rs` (port maxio) |
| Handlers + middleware | `mc-tracker/src/auth/mod.rs`, wired in `mc-tracker/src/api/mod.rs` |

### Dependencies

| Crate | Use |
|-------|-----|
| `argon2` | Password hashing (argon2id) |
| `hmac`, `sha2` | Session token signing |
| `subtle` or argon2 verify | Constant-time comparisons where needed |

### Tests

**Unit (`mc-tracker/src/auth/`)**

- [ ] argon2 hash/verify round-trip; wrong password fails
- [ ] Session token sign/verify; tampered cookie rejected
- [ ] Expired token rejected (mock clock)
- [ ] Revoked token after logout rejected
- [ ] `require_role(Admin)` — admin ok, user → 403
- [ ] Rate limiter — 11th attempt in window → 429 + `Retry-After`
- [ ] Password change — wrong current password → 401

**Integration (testcontainers + TestClient)**

- [ ] Bootstrap: empty DB + env → admin user with `role=admin`
- [ ] Login → `Set-Cookie` → `GET /api/auth/me` returns username + role
- [ ] Logout → cookie cleared → `GET /api/auth/me` → 401
- [ ] Admin: login → `GET/PATCH /api/settings` ok; `POST /api/admin/servers` ok
- [ ] User role (seed user): login → `GET /api/settings` → 403; `POST /api/admin/servers` → 403
- [ ] Public: `GET /api/servers` + timeseries without cookie
- [ ] `GET /api/servers/{uuid}/timeseries` — point count ≤ 400; invalid window → 400
- [ ] Sign-up v2: enabled → creates `user`; disabled → 403
- [ ] Duplicate username on signup → generic 401/409 (no enumeration)
- [ ] CORS preflight from `http://localhost:5173` with credentials

**Security**

- [ ] Session cookie flags: HttpOnly, SameSite=Strict (inspect Set-Cookie header)
- [ ] Role change in DB invalidates admin access on next admin request (DB role re-check)

---

## Design Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | McUtils / MaxMind scope | **ASN-only in-process lookup** — no HTTP API; parity with today |
| 2 | Crate layout | **Multi-crate workspace** (`mc-db`, `mc-ping`, `mc-geo`, `mc-metrics`, **`mc-api-types`**, `mc-tracker`) — **no CLI crate** |
| 3 | Java protocol version | **Follow Mc Utils** — use latest protocol from `JavaMinecraftVersion.getLatestVersion()` (currently **774**, 1.21.11). *Supersedes earlier decision to pin 765 (mc-tracker TS / `mcping-js`).* |
| 4 | MaxMind DB delivery | **Auto-update inside the app** (license key in env; refresh on startup/schedule) |
| 5 | Production cutover | **Big bang** — replace TS in one deploy |
| 6 | Bedrock SRV | **Skip** — Bedrock has no SRV records; hostname + port only (matches Mc Utils) |
| 7 | Offline servers | **Omit from metrics** — failed pings excluded from gauge (reset then set successes only; no `up` label) |
| 8 | MaxMind tier | **GeoLite2 (free)** — not paid GeoIP2 |
| 9 | Prometheus geo labels | **ASN only** (`asn`, `asn_org`) — no `country`/`city` labels |
| 10 | API port | **`settings.api_port` in Postgres** — default `3000` on seed (not env) |
| 11 | Web UI scope | **Dashboard** (public) + **Account** (authenticated) + **Admin** (`admin` role); **no CLI** |
| 12 | DNS cache | **TTL-based cache** (port Mc Utils Guava-style `expireAfterWrite`) — `dns_cache_*` in Postgres settings |
| 13 | Extra ping fields | **Define types and parse from responses** — MOTD, max players, version populated but **unused** for now (metrics still `players.online` only) |
| 14 | Persistence | **PostgreSQL + Diesel** — servers and settings in DB; pattern from **maxio** (`mc-db` crate) |
| 15 | Server runtime model | **In-memory after startup** — load from DB once at boot; admin panel keeps DB + memory in sync |
| 16 | Metrics delivery | **Push to VictoriaMetrics** — interval POST; **no `/metrics` endpoint**; dashboard **queries VM** for history |
| 17 | Deployment docs | **Out of scope** — Postgres/VM provisioning and Dokku/Docker not covered in this plan |
| 18 | Authentication | **Username + password**, **roles** (`admin` \| `user`), HMAC session cookies; RBAC on routes |
| 19 | Grafana | **Retired** — built-in dashboard is the frontend; `dashboard.yml` is parity reference until Phase 7 |
| 20 | User sign-up | **Planned (v2)** — public registration when `sign_up_enabled`; new users get `user` role |
| 21 | Server suggestions | **Planned (v2)** — users propose servers; admins approve → `servers` table + memory |
| 22 | Frontend stack | **TanStack Start + React** in `www/` — pattern from **opnsense-router**; uPlot charts; TanStack Query; cookie auth |
| 23 | VM queries | **PromQL query builder** + **`GET /api/servers`**, **`GET /api/servers/{uuid}/timeseries?from=&to=`** only; step auto-computed, **max 400 points** |
| 24 | API DTOs | **`mc-api-types` crate** — canonical request/response types for all `/api/*` endpoints; axum + `www` mirror |
| 25 | Testing | **Test-heavy migration** — unit tests per crate; integration via testcontainers + wiremock; JSON golden fixtures; CI gates on every PR |

### Still open
- Settings hot-reload interval after admin panel edits?
- Server uniqueness constraints (`name` vs `host`+`port`)?
- MSRV / Rust edition policy?
- Sign-up UX details (email verification, username rules)?
- Admin promotion/demotion UI vs SQL-only?

---

## Testing strategy

**Goal:** High confidence before big-bang cutover — port Mc Utils behavior with **lots of automated tests**, not manual-only verification.

### Test pyramid

| Layer | Scope | Tools | Runs in CI |
|-------|-------|-------|------------|
| **Unit** | Pure logic — VarInt, step policy, PromQL builder, session tokens, serde DTOs, chart aggregation | `#[test]`, `tokio::test` (in-memory only) | Every PR |
| **Integration** | DB repos, HTTP handlers, VM client, push encode | **testcontainers** (Postgres), **wiremock** (VM), axum `TestClient` | Every PR |
| **Contract / golden** | JSON response shapes, PromQL strings, Prometheus text bodies | `insta` snapshots or checked-in fixtures under `tests/fixtures/` | Every PR |
| **Cross-validation** | Player counts vs Mc Utils Backend | Manual/staging script (`scripts/cross-validate-ping.rs`) | Nightly or pre-release |
| **UI** | Components, chart math, API client types | **Vitest** + Testing Library in `www/` | Every PR |
| **E2E (optional v1)** | Login → admin CRUD → dashboard | Playwright against local stack | Nightly |

### Repository layout

```
tests/
├── fixtures/
│   ├── java/           # handshake bytes, status JSON samples
│   ├── bedrock/        # pong payloads
│   ├── vm/             # query_range JSON responses
│   ├── prometheus/     # expected push bodies
│   └── api/            # expected GET /api/servers JSON snapshots
├── integration/        # full-stack: axum + testcontainers + wiremock
└── common/             # shared test helpers (maxio pattern)

crates/mc-ping/tests/
crates/mc-metrics/tests/
crates/mc-db/tests/
mc-tracker/tests/       # binary-level integration
www/src/**/*.test.ts    # Vitest co-located or __tests__/
```

### CI gates (`.gitea/workflows/ci.yml` or GitHub Actions)

- [ ] `cargo fmt --check`
- [ ] `cargo clippy -- -D warnings`
- [ ] `cargo test --workspace` (unit + integration; testcontainers requires Docker on runner)
- [ ] `cd www && bun run typecheck && bun run lint && bun run test`
- [ ] Optional: `cargo llvm-cov` report (informational threshold, e.g. 70%+ on `mc-ping`, `mc-metrics`, `mc-db`)

### Principles

- **No live Minecraft servers in CI** — use fixtures; staging cross-validation is separate.
- **Deterministic time** — inject clock for `MetricQueryWindow`, session expiry, DNS cache TTL tests.
- **Fail on schema drift** — `mc-api-types` JSON snapshots break CI if handler output changes without review.
- **Port Server Monitor tests** — `MetricStepPolicyTest` cases are mandatory golden tests in `mc-metrics`.

Per-phase test checklists are below under each phase **and** summarized in [Success criteria](#success-criteria).

---

## Phase 1 — Project Scaffolding + Database (`mc-db`)

### Goals

- Initialize Rust workspace with CI-friendly tooling.
- Stand up Postgres persistence using maxio conventions before feature crates depend on it.

### Tasks

- [ ] Create `Cargo.toml` workspace (edition 2021 or 2024).
- [ ] Add **`mc-db`** crate with maxio-style layout:
  - `src/db/mod.rs` — `embed_migrations!`, `create_pool`, `run_migrations`, `health_check`
  - `src/db/schema.rs` — hand-maintained `diesel::table!` for `servers`, `settings`, `users`, `server_suggestions`
  - `src/db/migrations/` — initial DDL + settings seed
  - `src/db/repos/mod.rs` — `get_conn`, `db_err`
  - `src/db/repos/servers.rs` — list, get, insert, update, delete
  - `src/db/repos/settings.rs` — get, set, load_all → `AppSettings`
  - `src/db/repos/users.rs` — get by username, create (bootstrap/signup), update password, update role
  - `src/db/repos/suggestions.rs` — stub for v2 (create, list by user, list pending, update status)
  - `src/db/context.rs` — `DbContext { pool: Arc<DbPool> }`
- [ ] Diesel deps (match maxio): `diesel`, `diesel-async`, `diesel_migrations`, `deadpool-diesel`; features: `postgres`, `chrono`, `uuid`
- [ ] Bootstrap env only (`clap` + env): `DATABASE_URL`, `MC_TRACKER_DB_POOL_SIZE`, `MAXMIND_LICENSE_KEY`, `SESSION_SECRET`, `MC_TRACKER_ADMIN_USERNAME`, `MC_TRACKER_ADMIN_PASSWORD`, `VICTORIAMETRICS_AUTH_TOKEN` (optional)
- [ ] Domain types: `Server`, `AppSettings`, `User` + `UserRole`, `ServerSuggestion` (v2)
- [ ] Startup bootstrap: if no users, create admin with `role=admin` from env (fail fast if creds missing)
- [ ] Other crates stubbed: `mc-ping`, `mc-geo`, `mc-metrics`, **`mc-api-types`**, `mc-tracker`
- [ ] Add **`mc-api-types`** crate (opnsense `demarc-api-types` layout):
  - `src/request/`, `src/response/` modules with `serde` + `camelCase`
  - Initial types: `HealthResponse`, auth request/response stubs
  - `mc-tracker` depends on `mc-api-types` for all handler JSON
- [ ] `rustfmt`, `clippy`, CI: `cargo test`, `cargo clippy`, `cargo build --release`
- [ ] CI workflow scaffold (see [Testing strategy](#testing-strategy))

### Testing (Phase 1)

- [ ] **Migrations:** apply `up` on empty DB; idempotent second run; `down` + `up` round-trip (testcontainers)
- [ ] **`repos/servers`:** insert, list, get by id, update, delete; unique `(host, port, platform)` violation → error
- [ ] **`repos/settings`:** seed defaults present; get/set single key; `load_all` → typed `AppSettings` with invalid value rejection
- [ ] **`repos/users`:** create, get by username, update password, duplicate username fails
- [ ] **Bootstrap:** empty users + env creds → admin row; existing users → env ignored
- [ ] **`mc-api-types`:** serde round-trip for `HealthResponse`, `ErrorResponse`, auth DTOs; camelCase field names in JSON snapshots
- [ ] **`AppSettings`:** parse all seeded keys; missing required key fails load
- [ ] **Pool:** `health_check` returns ok against testcontainers Postgres

### Deliverable

`mc-db` crate: migrations run, repos tested via testcontainers. Stub `mc-tracker` binary connects to Postgres, runs migrations, loads settings + servers — **no push loop or full HTTP API yet** (Phase 5).

---

## Phase 2 — Java Pinger (`mc-ping`) — port from Mc Utils

### Reference

Port `JavaMinecraftServerPinger` and its packet classes. Secondary reference: [wiki.vg Protocol](https://wiki.vg/Protocol).

### Mc Utils flow (to replicate in Rust)

```
TCP connect(hostname, port)          // socket uses hostname, not ip
  → JavaPacketHandshakingInSetProtocol(hostname, port, latest_protocol)
  → JavaPacketStatusInStart          // send 0x01 0x00, read JSON response
  → parse JavaServerStatusToken      // players.online
```

### Packet details (from Mc Utils)

**VarInt** — port `MinecraftJavaPacket.readVarInt` / `writeVarInt` verbatim.

**Handshake** (`JavaPacketHandshakingInSetProtocol`):

- Packet ID: `0x00`
- Fields: `protocol_version` (VarInt), `hostname` (VarInt length + UTF-8 bytes), `port` (unsigned short), `next_state` (VarInt `1` = status)
- Framing: prepend VarInt packet length, then payload

**Status request** (`JavaPacketStatusInStart`):

- Send: `[0x01, 0x00]` (1-byte length + packet ID)
- Read: VarInt length → VarInt packet ID (expect `0x00`) → VarInt JSON length → JSON bytes
- Parse JSON → `players.online` (Mc Utils: `JavaServerStatusToken.Players.online`)

**Protocol version:**

- Mc Utils uses `JavaMinecraftVersion.getLatestVersion().getProtocol()` — enum ordered newest-first, currently **774**
- Port the protocol enum to Rust (`crates/mc-ping/src/java/version.rs`) for maintainability; mc-tracker only needs `get_latest().protocol()` at ping time

**Connection details** (from `JavaMinecraftServerPinger`):

- `TCP_NODELAY` enabled
- Connect timeout + read timeout = `AppSettings.pinger_timeout_ms` from Postgres
- Connect to **hostname** (after SRV rewrite), not raw IP

### mc-tracker output mapping

```rust
Ping {
    timestamp: now_ms(),
    ip: resolved_ipv4,
    players: Players {
        online: token.players.online,
        max: Some(token.players.max),
    },
    motd: Some(Motd { raw: description_from_json }),
    version: Some(ServerVersion { name: token.version.name, protocol: Some(token.version.protocol) }),
}
// mc-tracker metrics use players.online only
```

### Tasks

- [ ] Port `MinecraftJavaPacket` VarInt helpers → `crates/mc-ping/src/java/varint.rs`
- [ ] Port `JavaPacketHandshakingInSetProtocol` → `crates/mc-ping/src/java/handshake.rs`
- [ ] Port `JavaPacketStatusInStart` → `crates/mc-ping/src/java/status.rs`
- [ ] Port `JavaMinecraftVersion` enum (latest-only usage initially) → `crates/mc-ping/src/java/version.rs`
- [ ] Port `JavaMinecraftServerPinger.ping()` → `crates/mc-ping/src/java/pinger.rs` (async via `tokio::net::TcpStream`)
- [ ] Define shared ping types in `crates/mc-ping/src/types.rs` (`Ping`, `Players`, `Motd`, `ServerVersion`) — populate from JSON; **decided:** unused outside parsing for now
- [ ] Port DNS pre-resolution from `ServerService` + `DNSService` → `crates/mc-ping/src/dns.rs`
- [ ] Port TTL DNS cache: keyed by `(hostname, record_type)`; `expireAfterWrite(DNS_CACHE_TTL)`; cache SRV + A separately (Mc Utils `DnsCacheKey`)
- [ ] Retry logic from settings (`pinger_retry_attempts`, `pinger_retry_delay_ms`) wraps the Mc Utils ping call
- [ ] Byte-for-byte fixture tests copied from Mc Utils packet output (generate fixtures by running Java unit tests or capturing wire bytes)

### Testing (Phase 2)

- [ ] **VarInt:** encode/decode edge cases (0, 127, 128, max); malformed input errors
- [ ] **Handshake:** byte-for-byte match Mc Utils fixtures for known hostname/port/protocol
- [ ] **Status parse:** real JSON samples (plain + chat component MOTD); `players.online` / `players.max` / version fields
- [ ] **DNS mock:** SRV rewrite changes host+port; A record resolution; cache hit/miss/TTL expiry (mock clock)
- [ ] **Retry:** fails N-1 times then succeeds; exhaust attempts → error
- [ ] **Timeout:** slow mock server → timeout within `pinger_timeout_ms`
- [ ] **Pinger integration (mock TCP):** local listener returns canned status JSON → correct `Ping` struct
- [ ] **Regression:** fixture per Mc Utils Java unit test output (check in `tests/fixtures/java/`)
- [ ] Cross-validation script (staging): document in README; not CI

---

## Phase 3 — Bedrock Pinger (`mc-ping`) — port from Mc Utils

### Reference

Port `BedrockMinecraftServerPinger`, `BedrockPacketUnconnectedPing`, `BedrockPacketUnconnectedPong`, and token parsing from `BedrockMinecraftServer.create()`.

### Mc Utils flow (to replicate in Rust)

```
UDP connect(hostname, port)
  → BedrockPacketUnconnectedPing.send()
  → BedrockPacketUnconnectedPong.receive()
  → BedrockMinecraftServer.create(token)   // split ";"
  → players.online  (token field index 4)
```

### Packet details (from Mc Utils)

**Unconnected Ping** (`BedrockPacketUnconnectedPing`):

- Packet ID: `0x01`
- Buffer: 33 bytes, **little-endian**
- Layout: `[ID: u8][timestamp: u64][magic: 16 bytes][client_guid: u64]`
- Magic bytes (signed → use as `i8` in Java, port as exact byte sequence):

  ```
  00 FF FF 00 FE FE FE FE FD FD FD FD 12 34 56 78
  ```

- Timestamp: `System.currentTimeMillis()` → use `std::time` equivalent
- Client GUID: `0`

**Unconnected Pong** (`BedrockPacketUnconnectedPong`):

- Expect packet ID: `0x1C`
- Receive up to 2048 bytes
- Extract UTF-8 string from buffer; trim
- Strip leading binary prefix by finding start of edition name (`MCPE`, `MCEE`, etc. — port `BedrockEdition` enum)
- Result is semicolon-delimited MOTD token

**Token parsing** (`BedrockMinecraftServer.create()`):

| Index | Field | mc-tracker use |
|-------|-------|----------------|
| 0 | Edition (`MCPE`, …) | — |
| 1 | MOTD line 1 | — |
| 2 | Protocol version | — |
| 3 | Version name | — |
| **4** | **Online players** | **`player_count`** |
| 5 | Max players | — |
| 6 | Server GUID | — |
| 7 | MOTD line 2 | — |
| 8+ | Gamemode, etc. | — |

Port the full parser; populate `players.online`, `players.max`, `motd`, and `version` on `Ping` — **metrics use `players.online` only**.

### Tasks

- [ ] Port `BedrockPacketUnconnectedPing` → `crates/mc-ping/src/bedrock/ping.rs`
- [ ] Port `BedrockPacketUnconnectedPong` → `crates/mc-ping/src/bedrock/pong.rs`
- [ ] Port `BedrockMinecraftServer.create()` token split → `crates/mc-ping/src/bedrock/token.rs`
- [ ] Port `BedrockMinecraftServerPinger.ping()` → `crates/mc-ping/src/bedrock/pinger.rs` (async via `tokio::net::UdpSocket`)
- [ ] Default port 19132; per-server override from `servers.port` column
- [ ] No Bedrock SRV (**decided**) — hostname + port only
- [ ] Retry + timeout parity with Java path

### Testing (Phase 3)

- [ ] **Ping packet:** exact 33-byte layout + magic bytes
- [ ] **Pong parse:** strip binary prefix; edition detection (`MCPE`, `MCEE`, …)
- [ ] **Token split:** field index 4 = online players; short/malformed tokens → error
- [ ] **Default port 19132** when `port` is NULL
- [ ] **UDP mock:** canned pong → correct `Ping.players.online`
- [ ] **Retry/timeout:** parity with Java test patterns
- [ ] Fixtures: `tests/fixtures/bedrock/*.bin` from Mc Utils captures

---

## Phase 4 — MaxMind Service (`mc-geo`) — port from Mc Utils

### Purpose

Replace `mcUtils.fetchIpLookup(ip)` with an in-process port of Mc Utils `MaxMindService`. mc-tracker only needs the ASN subset at runtime.

### Reference

Port `/data/Projects/Mc Utils/Backend/src/main/java/xyz/mcutils/backend/service/MaxMindService.java`.

Mc Utils behavior to replicate:

| Behavior | Mc Utils implementation |
|----------|-------------------------|
| Databases | **GeoLite2-ASN** only (free tier; **decided:** ASN labels only — no GeoLite2-City) |
| Download URL | `https://download.maxmind.com/app/geoip_download?edition_id={edition}&license_key={key}&suffix=tar.gz` |
| Extract | Download `.tar.gz` → extract → move `{edition}.mmdb` to database dir |
| Startup | Download missing DBs; load existing without staleness check |
| Scheduled refresh | Cron `0 0 2 * * *` — re-download if file age > **3 days** |
| Rate limit | On HTTP 429, keep existing DB and log warning |
| ASN format | `"AS{number}"`, org name, network CIDR string |
| Lookup cache | Spring `@Cacheable` on `lookupIp` — mc-tracker: per-server IP cache (TS parity) |

### mc-tracker output (subset)

```rust
pub struct AsnLookup {
    pub asn: String,       // "AS13335"
    pub asn_org: String,
    pub cidr: Option<String>,
}
```

Port `lookupAsn()` logic only; **do not** port `lookupCity()` or geo Prometheus labels.

**Private/reserved IPs:** label `asn` / `asn_org` as empty strings (match current TS when McUtils returns nothing). Do not fail ping.

### Tasks

- [ ] Port download/extract/load loop from `MaxMindService.loadDatabases()` for **GeoLite2-ASN** only (**decided: free GeoLite2 tier**; requires MaxMind account + license key)
- [ ] Use `maxminddb` crate for MMDB reads (maps to MaxMind `DatabaseReader`)
- [ ] Port scheduled 3-day staleness check + 2 AM cron
- [ ] Env: `MAXMIND_LICENSE_KEY` only; `maxmind_database_dir` from Postgres settings
- [ ] Per-server in-memory cache (skip lookup if IP unchanged — from mc-tracker TS)
- [ ] Domain → A record resolution before lookup (from Mc Utils `ServerService`)
- [ ] Fail startup if ASN DB missing and initial download fails

### Testing (Phase 4)

- [ ] **Lookup:** known public IPs → expected `AS…` + org (use small checked-in MMDB slice or mock reader)
- [ ] **Private/reserved IPs:** empty `asn` / `asn_org` strings; ping still succeeds
- [ ] **Cache:** same IP twice → single MMDB read (mock counter)
- [ ] **Download mock:** wiremock MaxMind URL → extract tar.gz fixture → `.mmdb` loaded
- [ ] **429 rate limit:** keeps existing DB, logs warning, does not crash
- [ ] **Staleness:** file age > 3 days triggers refresh (mock clock + filesystem mtimes)
- [ ] **Startup failure:** missing DB + download fails → process exits non-zero

---

### ServerManager + push loop

Port mc-tracker TS **orchestration** + Mc Utils **DNS/lookup ordering**:

- [ ] **`ServerManager`** — `Vec<TrackedServer>` loaded from `repos::servers::list()` **at startup only**.
- [ ] Each `TrackedServer` holds config + **runtime state** (`playersOnline`, `lastPingAt`) updated each push cycle + **in-memory ASN cache** (like TS `Server.asnData` / `lastAsnIp`).
- [ ] **`AppSettings`** in `Arc<RwLock<AppSettings>>` — loaded at startup; admin panel refreshes on save.
- [ ] **Push loop** iterates in-memory servers only (no DB read per cycle).
- [ ] Per server: DNS → ping → ASN lookup on success.
- [ ] **Background push task** (tokio interval from `metrics_push_interval_seconds`): ping → encode → POST
- [ ] Skip overlapping push cycles if prior cycle still running
- [ ] Prometheus label **`type`** = `PC`/`PE` (from `platform` column)

### Metrics registry + query builder (`mc-metrics`)

Port Mc Utils push encoding + Server Monitor VM query stack (see [VictoriaMetrics query builder](#victoriametrics-query-builder)):

- [ ] `schema.rs` — shared metric + label constants
- [ ] Push: gauge registry, reset/set, Prometheus text encode, POST to VM
- [ ] Query: `VmQuery` builder, `Promql`, `MetricQueryWindow`, `MetricStepPolicy` (400 max points)
- [ ] `server_queries.rs` — per-server range + peak-player VM queries (no live-count instant queries)
- [ ] `VmQueryClient` — execute instant/range against VM
- [ ] Golden tests: step policy + window validation (port `MetricStepPolicyTest`)

### HTTP server (REST API only — no `/metrics`, no UI assets)

- [ ] **No `/metrics` endpoint** — not exposed under any path, auth, or debug flag (**decided**)
- [ ] Bind from `AppSettings.api_address` + `AppSettings.api_port` (Postgres settings)
- [ ] Routes: **`/api/*`** + `/health` only — UI served by `www/` TanStack Start (**decided**)
- [ ] CORS: allow `http://localhost:5173` (Vite dev) + configurable prod `www` origin; `credentials: true`
- [ ] Graceful shutdown: `tokio::signal` → drain in-flight push cycle → stop HTTP accept
- [ ] `GET /health` — DB pool ping + MaxMind DB file present
- [ ] `404` for unknown paths (including `/metrics`, static paths)

- [ ] Before each push: reset gauge, set values for successful pings only (**decided:** offline servers omitted)
- [ ] `POST` encoded body to `settings.victoriametrics_url`; optional `VICTORIAMETRICS_AUTH_TOKEN`
- [ ] Log push failures; retry next interval (do not crash process on single failed POST)

### Dashboard metrics API (`mc-tracker` handlers)

- [ ] DTOs in **`mc-api-types`** (`response/servers.rs`, etc.) — handlers return these types only
- [ ] `GET /api/servers` — list + summary from `ServerManager`; VM only for peak stats
- [ ] `GET /api/servers/{uuid}/timeseries?from=&to=` — `MetricQueryWindow::parse`, max 400 points
- [ ] Admin CRUD at `/api/admin/servers` (not `/api/servers`)
- [ ] `GET /api/settings`, `PATCH /api/settings` — admin; partial update DTO in `mc-api-types`
- [ ] Inject `environment` from `AppSettings` into all VM queries

### Logging

- [ ] `tracing` with structured fields matching current Winston messages where useful.

### Testing (Phase 5)

**`mc-metrics` (unit + golden)**

- [ ] `step_for`: full port of Server Monitor `MetricStepPolicyTest` table (1h, 6h, 24h, 7d, 30d, 365d, …)
- [ ] `MetricQueryWindow::parse`: clamp future `to`; reject span < 5m, > 2y; `from >= to`
- [ ] Point count ≤ 400 for every valid window in property-style table test
- [ ] **PromQL builder:** label escaping (`"`, `\`, newline); `environment` injection on every query
- [ ] **Golden PromQL:** `peak_players_24h`, `peak_players_30d`, `player_count_series` match `dashboard.yml` expr shapes
- [ ] **Push encode:** reset + set gauges → Prometheus text matches fixture (labels: `id`, `name`, `type`, `asn`, `asn_org`, `environment`)
- [ ] **Offline servers omitted** after failed ping in same cycle
- [ ] **VmQueryClient:** wiremock instant + range; auth header when token set; error mapping (4xx/5xx/timeout)

**`ServerManager` + push loop**

- [ ] Load N servers from mock repo → vec length N
- [ ] Push cycle updates `playersOnline` + `lastPingAt` on success; clears on failure
- [ ] `summary()` totals: PC/PE/total/trackedServers/lastUpdated from memory
- [ ] Overlapping cycle skipped when prior still running
- [ ] Settings hot-reload: change `metrics_push_interval_seconds` → next tick uses new value

**HTTP handlers (axum `TestClient` + testcontainers + wiremock)**

- [ ] `GET /health` — db ok, maxmind ok
- [ ] `GET /api/servers` — no cookie; JSON matches `tests/fixtures/api/servers-list.json`
- [ ] `GET /api/servers` — summary peaks from wiremock VM instant queries
- [ ] `GET /api/servers/{uuid}/timeseries` — ≤400 points; 404 bad uuid; 400 bad window
- [ ] `GET /metrics` → **404**
- [ ] Admin CRUD servers: create → in-memory + DB; update; delete removes from memory
- [ ] `PATCH /api/settings` — hot-reload + persist
- [ ] Push loop POST body received by wiremock VM (integration)

**Auth (see also [Authentication tests](#authentication--roles))**

- [ ] Covered in auth integration block; re-run in full-stack test suite

---

## Phase 6 — Web UI (`www/`) + API wiring

### Scope (**decided**)

- **`www/`** TanStack Start + React app (opnsense-router pattern)
- **Dashboard** at `/` — public Grafana replacement
- **Account** at `/account` — authenticated users
- **Admin** at `/admin/*` — `admin` role only
- Rust **`mc-tracker`** exposes REST API only; Phase 6 wires all `/api/*` handlers
- **`dashboard.yml`** parity checklist for dashboard panels

### Frontend scaffold (`www/`)

- [ ] Initialize TanStack Start project (copy structure from opnsense-router `www/`)
- [ ] `env.ts`, `router.tsx`, `lib/api/url.ts`, `lib/api/client.ts` (`credentials: "include"`)
- [ ] `AuthProvider`, login page, role-aware nav
- [ ] Route groups: public dashboard, `_authenticated`, `_admin`
- [ ] Tailwind + shadcn base components (button, card, table, form inputs)

### Dashboard UI (public)

- [ ] Overview stat cards + server list from `GET /api/servers`
- [ ] Aggregate uPlot charts — parallel `GET /api/servers/{uuid}/timeseries` per server (or per ASN group); sum aligned series client-side (`www/src/lib/metrics/aggregate.ts`)
- [ ] Per-server uPlot chart from `GET /api/servers/{uuid}/timeseries` when server selected (Grafana `$server` panel)
- [ ] ASN + server filters client-side over servers list
- [ ] Default chart time range **`now-30d` → `now`** (match `dashboard.yml` `"time"`)
- [ ] Auto-refresh via TanStack Query `refetchInterval` (`metrics_push_interval_seconds`)

### Account UI (v1)

- [ ] `/account` — profile, change password, logout
- [ ] `/login` — shared login form

### Admin UI

- [ ] Settings + server CRUD forms (TanStack Query mutations)
- [ ] `@tanstack/react-table` for server list (like opnsense data tables)
- [ ] Admin role gate in `_admin` layout

### API handlers (Rust — `mc-tracker`)

- [ ] Wire `mc-metrics` into `GET /api/servers` + `GET /api/servers/{uuid}/timeseries`
- [ ] Admin server CRUD at `/api/admin/servers`
- [ ] Auth: login/logout/me/password; `auth_middleware` + `require_role(Admin)`; v2 signup stub
- [ ] Settings + servers CRUD (admin); CORS for Vite dev with credentials

### Runtime reload

- [ ] Settings: persist → refresh in-memory `AppSettings` (immediate on PATCH)
- [ ] Servers: persist → update in-memory vec (immediate; **no** full DB reload)
- [ ] Document settings that require process restart (`api_port`, `api_address`) — see [Settings hot-reload](#settings-hot-reload)
- [ ] Dashboard Query `refetchInterval` follows `metrics_push_interval_seconds`

### Tasks

- [ ] Rust: HTTP handlers in `mc-tracker` (`api/`, `auth/`, `metrics/`)
- [ ] Rust: wire repos + `ServerManager` + shared auth state (rate limiter, RBAC)
- [ ] `www/`: full TanStack Start app per [Frontend (`www/`)](#frontend-www)
- [ ] CI: `cargo test`, `cd www && bun run typecheck && bun run lint`

### Testing (Phase 6)

**`www/` (Vitest + Testing Library)**

- [ ] `lib/metrics/aggregate.ts` — sum aligned series; handle null gaps; empty server list
- [ ] `lib/metrics/aggregate.ts` — per-ASN grouping matches manual sum
- [ ] `lib/api/servers.ts` — mock fetch parses fixture JSON into typed responses
- [ ] `AuthProvider` — login/logout state; 401 clears session
- [ ] `_admin` layout — redirects non-admin; allows admin
- [ ] Chart config builders — uPlot options from timeseries DTO (smoke tests)
- [ ] `env.ts` — rejects missing `VITE_MC_TRACKER_API_URL`

**Full-stack (optional nightly)**

- [ ] Playwright: login as admin → add server → appears on dashboard list
- [ ] Playwright: public dashboard loads stat cards without auth

**Rust API (continued from Phase 5)**

- [ ] All handlers wired — extend integration suite to 100% route coverage
- [ ] Error responses: `{ "error": "…" }` shape on 400/401/403/404/409/429/500

---

## Phase 7 — Decommission TypeScript & Grafana

- [ ] Remove legacy Bun `src/`, `cli/`, root `package.json` (UI moves to `www/`)
- [ ] Remove `dashboard.yml` (parity verified against built-in dashboard)
- [ ] Update README — `cargo run` for API, `cd www && bun run dev` for UI; remove Grafana setup
- [ ] Verify built-in dashboard matches former Grafana panels (manual checklist from `dashboard.yml`)
- [ ] One-time import from legacy `servers.json` — see [Cutover](#cutover-serversjson--postgres)

### Testing (Phase 7)

- [ ] **Import script:** `servers.json` → SQL — row count matches; UUIDs preserved; `(host, port, platform)` unique
- [ ] **Parity checklist:** automated where possible — stat card values vs VM; chart default range 30d
- [ ] **Smoke:** full stack docker-compose (Postgres + VM + mc-tracker + www) — health + `/api/servers` 200
- [ ] **Regression:** compare push body labels to legacy TS `metrics.ts` output for same mock ping results

---

## Phase 8 — Sign-up & server suggestions (v2)

*Depends on Phase 6 auth + `server_suggestions` schema from Phase 1.*

### Sign-up

- [ ] `POST /api/auth/signup` — create `user` when `sign_up_enabled=true`
- [ ] `/register` page — hidden/disabled when sign-up off
- [ ] Rate limit sign-up same as login
- [ ] Admin toggles `sign_up_enabled` in settings UI

### Server suggestions (users)

- [ ] `POST /api/suggestions` — authenticated `user` submits `{ name, host, port, platform }`
- [ ] `GET /api/suggestions` — users see own suggestions; admins see all (filter by `status`)
- [ ] `/account/suggestions` — submit form + status list

### Admin review

- [ ] `GET /api/suggestions?status=pending` — admin queue
- [ ] `PATCH /api/suggestions/{id}` — `approved` (→ create server + memory) or `rejected` + optional `reviewer_note`
- [ ] `/admin/suggestions` — review UI
- [ ] Optional ping test on approve (reuse mc-ping)

### Tasks

- [ ] Implement `repos/suggestions.rs` (stubbed in Phase 1)
- [ ] Approve path reuses server insert + `ServerManager` sync from admin CRUD
- [ ] Notify user of outcome (in-app status only for v2 — no email)

### Testing (Phase 8)

- [ ] User POST suggestion → pending row; list own only
- [ ] Admin list pending; approve → `servers` row + `ServerManager` entry
- [ ] Admin reject → status + optional note; no server created
- [ ] Duplicate host+port pending → 409
- [ ] Sign-up rate limit; `sign_up_enabled=false` → 403
- [ ] Optional: approve runs ping test mock before insert

---

## Out of scope (this plan)

- **Deployment** — Postgres provisioning, VictoriaMetrics connectivity, Docker/Dokku/CI (decision #17)
- **CLI** — no binary subcommands
- **GET /metrics** — no scrape endpoint
- **Grafana** — no longer deployed; built-in dashboard replaces it

---

## Dependency Map (TS → Rust)

| TypeScript | Rust (proposed) |
|------------|-----------------|
| `mcping-js` | Port of Mc Utils `JavaMinecraftServerPinger` |
| `mcpe-ping-fixed` | Port of Mc Utils `BedrockMinecraftServerPinger` |
| `mcutils-js-api` | Port of Mc Utils `MaxMindService` (ASN subset) |
| `prom-client` | `mc-metrics` push registry + `prometheus` crate encode + VM query builder |
| `Bun.serve` | Rust **`axum`** API + **`www/`** TanStack Start SSR |
| `winston` | `tracing` |
| `commander` / CLI | **Removed** — admin in `www/` |
| Grafana `dashboard.yml` | `GET /api/servers` + `GET /api/servers/{uuid}/timeseries` + client-side chart aggregation in `www/` |
| Node `dns` | `hickory-resolver` |
| `data/servers.json` | Postgres `servers` table + `mc-db` repos |
| `@t3-oss/env-core` + `zod` | Postgres `settings` (Rust) + `www/src/env.ts` (Vite) |
| — | `diesel`, `diesel-async`, `diesel_migrations`, `deadpool-diesel` (maxio) |
| — | `argon2`, `hmac`, `sha2` (password + session auth) |
| — | `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-query`, `uplot` |
| `uuid` | `uuid` crate |

---

## Non-Goals (unless decided otherwise)

- CLI (admin panel in web UI — **decided**)
- **Grafana** (replaced by built-in dashboard — **decided**)
- **`/metrics` HTTP endpoint** (metrics go to VictoriaMetrics via push only — **decided**)
- Player name tracking or historical storage (Prometheus retains time series)
- RCON or full server query beyond list ping

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Protocol implementation bugs | Port faithfully from Mc Utils; **extensive unit fixtures**; cross-validate player counts against Mc Utils API |
| MaxMind DB stale/missing | Health check at startup; alert if DB age > N days |
| Bedrock/RakNet edge cases | Capture real pong samples from diverse servers |
| Alpine musl DNS quirks | Test SRV resolution in Docker CI |
| Increased binary size vs Bun | Acceptable; Rust static binary ~5–15 MB typical |
| Push interval too slow vs dashboard refresh | Default `metrics_push_interval_seconds=10`; tunable via admin panel |
| VictoriaMetrics push failures | Log + retry next interval; optional alert on consecutive failures |
| VictoriaMetrics query failures | Dashboard shows stale/empty state; log proxy errors; do not crash HTTP server |
| Dashboard/Grafana parity drift | Use `dashboard.yml` as checklist; remove file only after manual parity sign-off |
| Overlapping push cycles | Skip if prior cycle in flight |
| Postgres unavailable at boot | Fail fast; health check includes `db::health_check` |
| Settings schema drift | Migrations seed defaults; typed `AppSettings` validates on load |
| Legacy servers.json | One-time SQL/seed script at cutover (not runtime CLI) |
| Weak/default admin password | No SQL seed; require env bootstrap creds on first boot; force change via UI encouraged |
| Session fixation / theft | HttpOnly + SameSite=Strict cookies; HMAC-signed tokens; logout revocation |
| Brute-force login / sign-up | Per-IP rate limit on `/api/auth/login` and `/api/auth/signup` |
| Privilege escalation | `require_role(Admin)` on all admin routes; re-check role from DB on sensitive ops |
| Spam server suggestions (v2) | Rate limit submissions per user; admin review queue |

---

## Success Criteria

- [ ] Player counts match Mc Utils Backend for all production servers (±0)
- [ ] Prometheus metric name and labels unchanged — built-in dashboard uses same series as Grafana did
- [ ] Metrics visible in VictoriaMetrics within one push interval of deploy
- [ ] ASN labels populated via MaxMind, matching McUtils for sampled IPs
- [ ] **Public dashboard** shows equivalent panels to `dashboard.yml` (stats, charts, ASN/server filters)
- [ ] **Admin panel** (`admin` role) manages settings and servers (CRUD + in-memory sync)
- [ ] **`user` role cannot access `/api/settings` or `/api/admin/servers`**; bootstrap admin has `role=admin`
- [ ] Account UI: login, profile, change password (any authenticated user)
- [ ] Settings changes apply without restart where possible
- [ ] No external HTTP dependency at runtime (McUtils removed)
- [ ] Grafana no longer required in production
- [ ] **`cargo test --workspace` passes** — all unit + integration tests green in CI
- [ ] **`cd www && bun run test` passes** — Vitest unit tests green in CI
- [ ] **Golden fixtures** for PromQL, push bodies, and API JSON reviewed and checked in
- [ ] **testcontainers** Postgres integration covers all repos + auth + public API routes
- [ ] **wiremock** VM tests cover push POST + query instant/range + peak queries

---

## Plan Audit — Gaps & Missing Items

*Audit date: 2026-06-30 (second pass — API types, in-memory live stats, aggregate timeseries)*

### Resolved by recent decisions

- ~~Server list hot-reload from DB~~ → **in-memory at startup**; UI syncs DB + memory
- ~~CLI / import-servers~~ → **removed**; dashboard + admin panel
- ~~Postgres/VM deployment~~ → **out of scope**
- ~~ASN persistence~~ → in-memory on `TrackedServer` (same as TS)
- ~~Web UI auth~~ → **roles + RBAC** (`admin` \| `user`); session cookies (decisions #18–21)
- ~~Frontend stack~~ → **TanStack Start + React** in `www/` (decision #22)
- ~~VM query approach~~ → **`GET /api/servers` + `GET /api/servers/{uuid}/timeseries`** only (decision #23)
- ~~Optional API DTO crate~~ → **`mc-api-types` required** (decision #24)
- ~~Live stats from VM~~ → **`ServerManager`** for current counts; VM for history + peaks only
- ~~Unique server name~~ → unique **`(host, port, platform)`** — production has duplicate names
- ~~Separate `/api/timeseries`~~ → removed; aggregate charts use parallel per-server timeseries + client-side sum
- ~~servers.json cutover~~ → [documented field mapping](#cutover-serversjson--postgres)
- ~~Settings hot-reload~~ → [matrix documented](#settings-hot-reload)
- ~~Phase 1 scope creep~~ → deliverable is **`mc-db` only**; push + HTTP in Phase 5
- ~~Testing underspecified~~ → [Testing strategy](#testing-strategy) + per-phase test sections (decision #25)

### Still open (needs decision or v2)

| Area | Gap | Recommendation |
|------|-----|----------------|
| **Stale VM series** | Deleted servers leave historic series in VM | Accept until VM retention; gauge stops updating on delete (no tombstone push) |
| **Mc Utils parity** | `host:port` in hostname string; split Java/Bedrock timeouts; blacklisted subnets | Port `ServerService` host parsing; defer blacklist unless seen in prod |
| **Web UI** | Dashboard layout / responsive grid; dark mode; prod CORS allowlist env | Mirror `dashboard.yml` grid in Phase 6; add `www_allowed_origins` setting if needed |
| **Users & RBAC** | Username validation rules; admin promotion UI | Min length 3, `[a-zA-Z0-9_-]`; SQL-only promotion in v1 |
| **Duplicate suggestions (v2)** | Same host already tracked or pending | Reject with `409 Conflict` |
| **Ops** | Push failure alerting | Log consecutive failures; optional webhook v2 |
| **Chart aggregation** | N parallel `{uuid}/timeseries` calls for overall/ASN panels | TanStack Query `useQueries`; Vitest tests on `aggregate.ts` |
| **CSRF** | Cookie auth on mutating routes | Enable `csrf_middleware` for admin mutations (maxio pattern) |
| **Error JSON shape** | Consistent API errors | `{ "error": "..." }` + HTTP status; define in `mc-api-types` |
| **MSRV / edition** | Rust version policy | Pin in workspace `rust-version`; edition 2021 initially |

### Doc housekeeping

- Set `environment=production` in admin settings before cutover so VM queries match pushed metrics (today's Grafana uses `environment="production"`)
- Remove `old code/` after Phase 7 or keep as reference until cutover verified
- Update plan header **Last updated** when implementing

---

## Open Questions

### Architecture

1. **Stale VM series:** Accept historic data after server delete, or push explicit delete/tombstone to VM?
2. **Server uniqueness edge cases:** Same host, different ports — covered by `(host, port, platform)`; confirm admin UX for duplicates.

### Implementation

3. **MSRV & edition:** Minimum Rust version policy? Edition 2021 vs 2024?
4. **Testing against live servers:** Allowed in CI or manual/staging only?
5. **Mc Utils blacklist subnets:** Port or skip?

### Users & auth

6. **Username rules:** Min length, allowed characters — propose `[a-zA-Z0-9_-]`, min 3.
7. **Admin promotion:** UI in v2+ or SQL-only for promoting `user` → `admin`?

---

## Estimated Effort (rough)

| Phase | Effort |
|-------|--------|
| 1 — Scaffolding + `mc-db` | 2–3 days |
| 2 — Java ping (Mc Utils port) | 2–3 days |
| 3 — Bedrock ping (Mc Utils port) | 1–2 days |
| 4 — MaxMind (Mc Utils port) | 1–2 days |
| 5 — Orchestration + VM push + query builder | 3–4 days |
| 6 — Web UI (`www/`) + API wiring | 5–8 days |
| 7 — Decommission TS & Grafana | 0.5 day |
| 8 — Sign-up & suggestions (v2) | 2–4 days |
| **Total (v1 through Phase 7)** | **~4–5 weeks** |
| **Total (incl. Phase 8)** | **~5–6 weeks** |

---

## References

### mc-tracker (current)

- TS ping wrappers: `src/common/minecraft-ping.ts`
- TS ASN flow: `src/server/server.ts`
- Metrics: `src/metrics/metrics.ts`

### Mc Utils Backend (pinger + metrics encode)

- Java pinger: `Mc Utils/Backend/.../service/pinger/impl/JavaMinecraftServerPinger.java`
- Bedrock pinger: `Mc Utils/Backend/.../service/pinger/impl/BedrockMinecraftServerPinger.java`
- Metric registry: `Mc Utils/Backend/.../service/MetricService.java`
- Text encode (adapt for push body): `Mc Utils/Backend/.../controller/IndexController.java` (`getMetrics()`)
- Java packets: `Mc Utils/Backend/.../common/packet/impl/java/`
- Bedrock packets: `Mc Utils/Backend/.../common/packet/impl/bedrock/`
- Protocol versions: `Mc Utils/Backend/.../common/JavaMinecraftVersion.java`
- DNS: `Mc Utils/Backend/.../service/DNSService.java`
- Ping orchestration: `Mc Utils/Backend/.../service/ServerService.java`
- MaxMind: `Mc Utils/Backend/.../service/MaxMindService.java`

### Server Monitor (VictoriaMetrics query builder + API shape)

- Query builder: `metrics/vm/query/VictoriaMetricsQuery.java`
- PromQL helpers: `metrics/vm/query/Promql.java`
- VM client: `metrics/vm/query/VictoriaMetricsQueryClient.java`
- Step policy (400 max): `model/domain/metric/MetricStepPolicy.java`
- Query window: `model/domain/metric/MetricQueryWindow.java`
- List + metrics API: `controller/v1/UserController.java`
- Timeseries response: `model/dto/response/metrics/MetricsResponse.java`

### Maxio (Postgres + Diesel + push metrics)

- DB module: `/data/Projects/maxio/src/db/mod.rs`
- Schema: `/data/Projects/maxio/src/db/schema.rs`
- Repos: `/data/Projects/maxio/src/db/repos/`
- Config bootstrap: `/data/Projects/maxio/src/config.rs`
- App wiring: `/data/Projects/maxio/src/app.rs`
- **Typed push metrics:** `/data/Projects/maxio/src/metrics/prometheus.rs` — metric names, label sets, registry
- **Metrics facade:** `/data/Projects/maxio/src/metrics/mod.rs`
- **Grafana query catalog:** `/data/Projects/maxio/grafana/maxio-dashboard.json` — panel `expr` → `server_queries.rs` aggregate helpers

### opnsense-router (TanStack Start frontend)

- Frontend app: `/data/Projects/opnsense-router/www/`
- Vite + TanStack Start: `www/vite.config.ts`
- Router + Query setup: `www/src/router.tsx`
- File routes: `www/src/routes/`
- API client: `www/src/lib/auth/api.ts`, `www/src/lib/api/url.ts`
- Dashboard queries: `www/src/lib/api/dashboard.ts`
- uPlot charts: `www/src/components/metrics/metric-chart*.tsx`
- Auth layout gate: `www/src/routes/_authenticated.tsx`
- Env validation: `www/src/env.ts`
- Shared API DTOs: `crates/demarc-api-types/` → mc-tracker `crates/mc-api-types/`

### External docs

- [Minecraft Server List Ping](https://minecraft.wiki/w/Minecraft_Wiki:Projects/wiki.vg_merge/Server_List_Ping)
- [RakNet Unconnected Ping/Pong](https://wiki.vg/Raknet_Protocol#Unconnected_Ping)
- [MaxMind GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)
- [maxminddb Rust crate](https://docs.rs/maxminddb/)

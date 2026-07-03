# Rust Workspace Cleanup Plan

Internal refactor plan for the `crates/` workspace. Breaking changes to internal APIs are acceptable; behavior and the public HTTP surface must stay the same. Run `cargo check` (or `cargo test` for touched crates) after each phase.

## Progress

| Phase | Status | Commit message |
|-------|--------|----------------|
| 0 | — | Baseline (not recorded) |
| 1 | **Done** | add shared time and list limit constants to mc-common |
| 2 | **Done** | dedupe day-length literals in mc-metrics and mc-insights |
| 3 | **Done** | extract mc-geo and mc-ping constants modules |
| 4 | **Done** | mc-db settings constants and wire DEFAULT_LIST_LIMIT |
| 5 | **Done** | mc-chat constants + helpers extracted |
| 5b | **Done** | split mc-chat tools_impl into per-tool modules |
| 6 | **Done** | split mc-tracker manager into submodules |
| 6b | **Done** | wire players_sort_key; dedupe fixture_geo in unit tests |
| 7 | **Done** | dedupe fixture_geo in mc-tracker unit tests |

### Phase 1 (done)

- Added `crates/mc-common/src/constants.rs` with `constants::time::{SECONDS_PER_DAY, SECONDS_PER_DAY_U64}` and `constants::limits::DEFAULT_LIST_LIMIT` (25).
- Re-exported via `pub mod constants` in `lib.rs`.
- No callers updated yet — constants available for Phase 2+.

### Phase 2 (done)

- Added `mc-common` dependency to `mc-metrics` and `mc-insights`.
- Replaced `86_400` / `86400` day literals in `step_policy.rs`, `query_window.rs`, `series_align.rs`.
- Replaced `DAY_SECONDS` in `mc-insights/range.rs` and `THREE_DAYS_SECONDS` base in `analyze.rs`.
- `vm_query.rs` test left with literal `86400` (format_step human suffix test — not a domain constant).
- All `mc-metrics` (35) and `mc-insights` (7) unit tests pass.

### Phase 3 (done)

- **`mc-geo`:** Added `constants.rs` (`ASN_EDITION`, `ASN_REFRESH_CRON`, `DOWNLOAD_URL`, `STALE_AFTER`); removed duplicates from `types.rs`, `download.rs`, `service.rs`.
- **`mc-dns`:** Added `constants.rs` (`SRV_QUERY_PREFIX`, port defaults); `types.rs` re-exports ports from constants.
- **`mc-ping`:** Removed `mc-dns` re-exports from `lib.rs` and `bedrock/mod.rs`.
- **`mc-tracker`:** Added direct `mc-dns` dependency; `manager.rs` imports DNS types from `mc_dns`.
- Workspace `cargo check` clean.

### Phase 4 (done)

- **`mc-db`:** Added `model/settings_constants.rs` with default values, DB key names, and `VITE_DEV_ORIGIN`.
- `AppSettings::default()` and `repos/settings.rs` `save()` use named constants.
- **`mc-common::limits::DEFAULT_LIST_LIMIT`** wired in `mc-tracker` (`manager.rs`, `insights.rs`) and `mc-chat` (`tools_impl.rs`).
- `mc-api-types` unchanged (timeseries keys already centralized).
- `mc-db`, `mc-tracker`, `mc-chat` lib tests pass.

### Phase 5 (done)

- **`mc-chat/tools/constants.rs`:** Tool limits (`LIST_CAP`, rank caps, compare max, etc.).
- **`mc-chat/tools/helpers.rs`:** `tool_def`, `truncate`, `resolve_server_id`, `compare_peer_ids`, `compact_asn_query`, `parse_uuid`, `require_str`.
- **Deferred (5b):** One file per `ChatTool` implementer (~14 modules).
- `mc-search` unchanged (230 lines — fine as single file).

### Phase 5b (done)

- Split `tools_impl.rs` (~612 lines) into 14 per-tool modules under `crates/mc-chat/src/tools/`.
- `tools/mod.rs` + `tools/registry.rs` updated; `tools_impl.rs` deleted.
- All 11 `mc-chat` lib tests pass.

### Phase 6 (done)

- Split `manager.rs` (~1,850 lines) using sibling pattern: `manager.rs` + `manager/*.rs`.
- Submodules: `tracked`, `search`, `mappers`, `push`, `ping`, `metrics`, `timeseries`.
- `ServerManager` struct fields set `pub(crate)` for submodule access.
- `settings_response` / `admin_server_response` re-exported from `manager` for `admin.rs`.
- `DEFAULT_LIST_LIMIT` wired in list/search paths.
- 28 `mc-tracker` lib tests pass (tests remain in `manager.rs` `#[cfg(test)]` block).
- **Deferred (6b):** Move tests to `manager/tests.rs`; dedupe `accumulate_summary`.

### Phase 6b (done)

- Wired `players_sort_key` in `manager.rs` and `mappers.rs` (removed 4 duplicate sort-key blocks).
- Unit tests in `manager.rs` and `admin.rs` use `mc_test_support::fixture_geo()` instead of local copies.

### Phase 7 (done)

- Removed duplicate `fixture_geo()` from `manager.rs` and `admin.rs` unit tests; integration tests already used `mc_test_support`.
- `mc-test-support` left as single `lib.rs` (~203 lines — no split needed).

## Goals (summary)

| Area | Intent |
|------|--------|
| Crate organization | Domain-owned code in domain crates; infra crates stay thin |
| Module structure | Folder-based modules once a file exceeds ~300–400 lines or mixes responsibilities |
| Constants | `constants.rs` per crate; shared values in `mc-common` |
| Traits | Extract only where ≥2 real implementers or a clear extension point |
| Deduplication | One implementation for copy-pasted blocks |
| General | Dead code, visibility, naming, error-handling consistency |

## Workspace overview

```
mc-tracker (binary)     HTTP, auth, orchestration — largest cleanup target
mc-api-types            Serde DTOs only — already well-factored
mc-db                   Pool, migrations, repos, models — good shape
mc-ping / mc-dns        Protocol + DNS — minor boundary tweak
mc-geo                  MaxMind ASN — add constants module
mc-metrics              VM push + PromQL — add shared time constants
mc-insights             Timeseries analysis — small, keep as crate
mc-chat                 LLM agent + tools — split large tool file
mc-search               Text search — optional split
mc-common               Shared utilities — grow deliberately
mc-test-support         Test helpers — minor dedup with crate tests
```

### Module layout convention (pick one, apply everywhere)

Use the **`foo.rs` + `foo/` sibling** pattern (already used by `mc-metrics`):

```text
src/manager.rs          // re-exports + ServerManager core API
src/manager/
  tracked.rs            // TrackedServer, ServerSummary
  read.rs               // public list/search/detail response builders
  timeseries.rs
  metrics.rs            // VM query helpers
  ping.rs
  push.rs               // push cycle + cron loop
  asn.rs                // ASN aggregation + search
  mappers.rs            // DTO mapping helpers
  search.rs             // mc_search integration
  mod.rs                // `pub mod` declarations (or inline in manager.rs)
```

Avoid mixing `mod.rs`-only folders and sibling-file patterns in the same crate.

---

## Execution order

Work top-down by impact. Each phase ends with `cargo check` (full workspace) and targeted `cargo test -p <crate>`.

| Phase | Crate(s) | Risk | Notes |
|-------|----------|------|-------|
| 0 | — | — | Baseline: `cargo check && cargo test` |
| 1 | `mc-common` | Low | ✅ **Done** — `constants.rs` added |
| 2 | `mc-metrics`, `mc-insights` | Low | ✅ **Done** — day constants wired |
| 3 | `mc-geo`, `mc-ping`, `mc-dns` | Low | ✅ **Done** — constants + DNS boundary |
| 4 | `mc-db`, `mc-api-types` | Low | ✅ **Done** — settings constants + list limit wired |
| 5 | `mc-chat`, `mc-search` | Medium | ✅ **Done** — constants + helpers + per-tool split |
| 5b | `mc-chat` | Medium | ✅ **Done** — per-tool file split |
| 6 | `mc-tracker` | High | ✅ **Done** — `manager/` submodule split |
| 6b | `mc-tracker` | Low | ✅ **Done** — players_sort_key + fixture_geo dedup |
| 7 | `mc-test-support` + tests | Low | ✅ **Done** — fixture_geo dedup in unit tests |

---

## Crate-by-crate

### `mc-common`

**Current:** Single `time.rs` (`now_ms`, `unix_now_ms`). Used by `mc-ping` and `mc-tracker` tests only.

**Changes:**

- Add `constants.rs` with nested modules:

  ```rust
  pub mod time {
      pub const SECONDS_PER_DAY: i64 = 86_400;
      pub const SECONDS_PER_DAY_U64: u64 = 86_400;
  }
  pub mod limits {
      pub const DEFAULT_LIST_LIMIT: u32 = 25;
  }
  ```

- **Do not** move `now_ms` callers in `mc-insights` until `parse_range` is updated to use `mc_common::unix_now_ms()` (or a `now_secs()` helper) instead of inline `SystemTime` math.

**Ambiguous:** Whether `DEFAULT_LIST_LIMIT` belongs in `mc-common` or stays per-domain.

| Option | Tradeoff |
|--------|----------|
| `mc-common::limits` | One source of truth for HTTP/chat/tool caps (currently all `25`) |
| Per-crate constants | Allows chat tools to diverge from API limits later without coupling |

**Recommendation:** Put in `mc-common` — all three sites (`manager`, `insights`, `mc-chat` tools) intentionally share the same cap today.

---

### `mc-api-types`

**Current:** Clean `request/` + `response/` tree (~21 files). No business logic.

**Changes:**

- Extract `timeseries_keys` from `response/timeseries.rs` into `response/constants.rs` (or `constants/timeseries.rs`) if more key literals appear.
- No crate moves; DTOs stay here.

**Skip:** Splitting every response file — files are small and single-purpose.

---

### `mc-db`

**Current:** `bootstrap`, `db/` (pool, migrations, repos), `model/`, `error`. Matches conventions.

**Changes:**

- `model/settings.rs` (~196 lines): extract default values and validation strings to `model/constants.rs` or `model/settings/constants.rs`:

  ```rust
  pub const DEFAULT_PINGER_TIMEOUT_MS: u64 = 5000;
  pub const DEFAULT_METRICS_PUSH_CRON: &str = "*/10 * * * * *";
  pub const DEFAULT_VM_URL: &str = "http://localhost:8428";
  ```

- Keep `AppSettings::from_map` parse helpers on the struct — they are settings-domain, not generic.

**Ambiguous:** `parse_u16` / `parse_bool` on `AppSettings` look generic but are only used for settings hydration. **Keep local** unless a second caller appears.

---

### `mc-dns`

**Current:** Flat modules (`cache`, `resolve`, `resolver`, `types`, `error`). ~500 lines total.

**Changes:**

- Add `constants.rs`: `SRV_QUERY_PREFIX`, port defaults (re-export from `types` or move definitions here and re-export).
- **No folder split** — crate is small enough.

---

### `mc-geo`

**Current:** `cache`, `download`, `lookup`, `service`, `ip`, `types`, `error`.

**Changes:**

- Add `constants.rs`:

  | Constant | Current location |
  |----------|------------------|
  | `ASN_EDITION` | `types.rs` |
  | `ASN_REFRESH_CRON` | `service.rs` |
  | `DOWNLOAD_URL` | `download.rs` |
  | `STALE_AFTER` | `download.rs` |

- Leave module layout as-is.

---

### `mc-metrics`

**Current:** Good `push/` + `query/` split. `schema.rs` already holds metric names and label keys.

**Changes:**

1. **Constants dedup:** Replace literal `86_400` / `86400` in `query_window.rs`, `series_align.rs`, `step_policy.rs`, `vm_query.rs` tests with `mc_common::constants::time::SECONDS_PER_DAY*`.
2. **Move `timeseries_lane` from `mc-tracker`:** Pure function wrapping `align_samples_to_window(_avg)` → new `query/lane.rs` (or `query/timeseries.rs`):

   ```rust
   pub fn build_timeseries_lane(
       window: &MetricQueryWindow,
       samples: &[(i64, Option<f64>)],
       average: bool,
   ) -> TimeseriesLaneInput { ... }
   ```

   Return a small struct or build `TimeseriesLane` if `mc-api-types` is an acceptable dependency (it already is for `mc-tracker`). **Ambiguous:**

   | Option | Tradeoff |
   |--------|----------|
   | Return `(step, timestamps, values)` tuple | Keeps `mc-metrics` free of `mc-api-types` |
   | Return `TimeseriesLane` | Removes boilerplate at every call site in `manager` |

   **Recommendation:** Tuple struct in `mc-metrics`; `manager` maps to `TimeseriesLane` — preserves crate boundary rules.

3. **PromQL builders:** `server_queries.rs` and `asn_queries.rs` share `player_count_by_environment` / `deduped_players_by_asn` patterns. Extract a private `query/builders.rs` with shared `vector_selector` wrappers if a third variant appears. **Not worth a trait today** — only two query families.

---

### `mc-ping`

**Current:** `java/`, `bedrock/`, `net`, `retry`, `types`. Re-exports all of `mc-dns` at crate root.

**Changes:**

1. **DNS re-export boundary (ambiguous):**

   | Option | Tradeoff |
   |--------|----------|
   | Keep re-exporting `mc-dns` from `mc-ping` | Convenient for `manager` (`use mc_ping::{resolve_java, ...}`) |
   | `manager` imports `mc-dns` directly | Clearer layering; two imports at call sites |

   **Recommendation:** Stop re-exporting in `mc-ping/lib.rs`; update `mc-tracker` to `use mc_dns::...` for resolver types and `mc_ping::...` for ping only. `mc-ping` still depends on `mc-dns` internally.

2. Add `constants.rs` for protocol literals scattered in `java/handshake.rs`, `java/status.rs`, `bedrock/ping.rs`, `java/version.rs` (`LATEST_PROTOCOL`, packet IDs). Keep bedrock `MAGIC` in `bedrock/ping.rs` — bedrock-specific.

3. **`Platform` ping dispatch** in `manager::ping_server` matches `Platform::Pc | Pe` for resolve + ping. Consider:

   ```rust
   trait PlatformPing {
       fn resolve(...);
       fn ping(...);
   }
   impl PlatformPing for Platform { ... }
   ```

   Only two variants — valid trait candidate if `ping_server` stays in tracker after split. Alternative: methods on `Platform` in `mc-db::model` that return resolve/ping fn pointers — **prefer keeping ping logic in `mc-ping`**, so a small `ping::for_platform(platform)` function in `mc-ping` may be cleaner than a trait.

---

### `mc-search`

**Current:** Single `lib.rs` (~230 lines): normalize, match, score.

**Changes:**

- **Optional** split if it grows:

  ```text
  normalize.rs
  match.rs
  score.rs
  ```

- Borderline — **defer** unless adding features. Constants for token length thresholds (`4`, `3`) could go in `constants.rs` if extracted.

---

### `mc-insights`

**Current:** `analyze`, `range`, `trend`, `traits`, `error`. Well-scoped crate; `mc-chat` depends on `InsightsRead` implemented by `mc-tracker::InsightsService`.

**Changes:**

1. Replace `DAY_SECONDS` / `THREE_DAYS_SECONDS` with `mc_common::constants::time`.
2. Replace hardcoded `limit.clamp(1, 25)` with `mc_common::constants::limits::DEFAULT_LIST_LIMIT`.
3. Replace hardcoded `max_points: 30` in `InsightsService::summarize` with `AnalyzeOptions::default().max_points` or `constants::DEFAULT_MAX_SUMMARY_POINTS`.
4. `compare_optional_f64` / `compare_change_pct` — move to `mc-insights/src/sort.rs` (or `analyze/sort.rs`). **Not** `mc-common` — domain-specific `Option<f64>` ranking for insights/chat compact.

**Keep as separate crate** — enables unit tests without `mc-tracker` and keeps `mc-chat` deps clean.

---

### `mc-chat`

**Current:** `agent.rs` (~767 lines), `tools/tools_impl.rs` (~715 lines), `tools/compact.rs` (~383 lines), `llm/`, `traits.rs`.

**Changes:**

1. **`tools/constants.rs`:** `MAX_COMPARE_SERVERS`, `LIST_CAP`, rank limits, `DEFAULT_NEAR_PEAK_*`, token limits from `agent.rs`.
2. **Split `tools_impl.rs`** — one file per tool or grouped by domain:

   ```text
   tools/
     list_servers.rs
     search_servers.rs
     server_detail.rs
     compare_servers.rs
     ...
     mod.rs          // registers all tools in ToolRegistry
   ```

   `ChatTool` trait + `ToolRegistry` already exist — split is mechanical.

3. **`compact.rs`:** Shares truncate/rank patterns with `mc-tracker/insights.rs`. After insights `sort.rs` exists, consider a shared `truncate_vec(vec, cap) -> bool` in `mc-chat` only (compact is chat-specific JSON shaping). **Do not** move compact to `mc-api-types`.

4. **`agent.rs`:** Extract session/history helpers (`parse_raw_history`, `MAX_SESSION_ID_LEN`) to `agent/history.rs` if file remains >400 lines after constant extraction.

---

### `mc-tracker` (primary target)

**Current:** Flat `src/` with `manager.rs` at **1,829 lines** mixing tracking state, read APIs, timeseries, VM queries, ping, push loop, DTO mappers, and tests.

#### 1. Split `manager.rs` → `manager/` module

| Module | Responsibility | ~lines |
|--------|----------------|--------|
| `tracked.rs` | `TrackedServer`, `ServerSummary`, peak helpers | 120 |
| `search.rs` | `matches_server_search`, ASN search helpers, `AsnAggregate*` | 80 |
| `read.rs` | `servers_list_response`, `asns_list_response`, search, detail | 350 |
| `timeseries.rs` | `server_timeseries`, `asn_timeseries`, `total_timeseries` | 120 |
| `metrics.rs` | `query_player_count_series`, `query_scalar*`, peak queries | 100 |
| `ping.rs` | `ping_server`, `PingServerError` | 80 |
| `push.rs` | `run_push_cycle`, `spawn_push_loop`, `PushLoopHandle`, cron | 200 |
| `mappers.rs` | `server_list_item`, `entity_peak_stats`, sort helpers | 100 |
| `crud.rs` | `append_server`, `update_server_config`, `remove_server`, admin list | 80 |
| `manager.rs` | `ServerManager` struct, `new`, `summary`, `settings`, `environment` | 200 |

Move `#[cfg(test)]` tests alongside the module they cover (e.g. list sort tests → `read.rs`).

#### 2. Relocate misplaced helpers

| Symbol | Current | Target |
|--------|---------|--------|
| `settings_response` | `manager.rs` | `settings.rs` or `admin/mappers.rs` |
| `admin_server_response` | `manager.rs` | `admin/mappers.rs` |
| `TrackerRead` impl | `tracker_read.rs` | `manager/tracker_read.rs` |
| `InsightsService` | `insights.rs` | `insights/mod.rs` + `insights/rank.rs` |

#### 3. Deduplicate within manager

**`accumulate_summary(servers: &[TrackedServer]) -> ServerSummary`** — replace three copy-pasted loops in `servers_by_asn_org`, `asn_detail_response`, and similar with one function in `tracked.rs` or `read.rs`.

**Player sort key** — `players_online.map(i64::from).unwrap_or(-1)` appears in list, search, and ASN paths. Extract `fn players_sort_key(players: Option<u32>) -> i64`.

**`LIST_LIMIT`** — use `mc_common::constants::limits::DEFAULT_LIST_LIMIT`; remove local `const LIST_LIMIT`.

#### 4. Split `api.rs` (~308 lines)

Optional but consistent once `manager/` exists:

```text
api/
  mod.rs          // router, AppState, cors_layer
  health.rs
  servers.rs
  asns.rs
  timeseries.rs
  errors.rs         // map_metrics_error (shared with insights handlers)
```

Extract `trim_search` to `api/query.rs` or inline — used by many handlers.

#### 5. `insights.rs` (~329 lines)

- Move `rank_servers_by_growth` / `rank_servers_by_period_peak` shared loop into `insights/rank.rs`:

  ```rust
  async fn rank_servers<F, T>(ids, limit, fetch: F) -> (Vec<T>, Vec<ServerGrowthRankError>)
  ```

  The two rank functions differ only in mapping and sort order — clear dedup win.

- Use `mc_common::now_secs()` in `parse_range` instead of duplicating `SystemTime` math.

#### 6. Auth / chat / admin

Already folder-based (`auth/`). Minor:

- `auth/session.rs`: move `COOKIE_NAME`, `MAX_AGE_SECS` to `auth/constants.rs`.
- `chat.rs`: move `RATE_LIMIT_PER_MINUTE` next to `chat_quota.rs` limits or `chat/constants.rs`.
- `admin.rs`: `parse_platform` is a thin wrapper over `Platform::from_db` — **keep** for HTTP error messages; could move to `admin/validation.rs` if `admin.rs` grows.

#### 7. Error-handling audit

| Location | Pattern | Action |
|----------|---------|--------|
| VM query helpers in manager | `warn!` + empty/`None` | **Keep** — graceful degradation for dashboard |
| `duration_until_next_cron_tick` | `.expect(...)` | **Keep** — schedule validated before call |
| `ChatRateLimiter` | `Mutex::lock().unwrap()` | **Keep** — poison = panic is acceptable |
| `insights::parse_range` | `unwrap_or(0)` on clock | Switch to `mc_common` helper for consistency |

#### 8. Dead code / visibility

After split, run:

```bash
cargo clippy --workspace -- -W unused -W dead_code
```

- Audit `pub` on `ServerManager` methods only used inside `mc-tracker` → `pub(crate)`.
- `TrackedServer` fields: several are `pub` for tests — consider `#[cfg(test)]` visibility or test helpers.

---

### `mc-test-support`

**Current:** Postgres container, `build_app`, `fixture_geo`, login helpers.

**Changes (after tracker split):**

- Remove duplicate `fixture_geo()` from `manager` tests; use `mc_test_support::fixture_geo()`.
- Optionally split into `postgres.rs`, `app.rs`, `fixtures.rs` if `lib.rs` grows past ~250 lines.

---

## Cross-cutting: constants map

| Constant | Crates using it | Destination |
|----------|-----------------|-------------|
| `86_400` / day length | `mc-insights`, `mc-metrics` | `mc-common::constants::time` |
| List cap `25` | `mc-tracker`, `mc-insights`, `mc-chat` | `mc-common::constants::limits` |
| Summary `max_points` 30 | `mc-insights`, `AnalyzeOptions::default` | `mc-insights::constants` |
| VM step policy | `mc-metrics` only | stay in `step_policy.rs` |
| Session cookie | `mc-tracker` only | `auth/constants.rs` |
| Chat weekly limit | `mc-tracker` only | `chat_quota.rs` or `chat/constants.rs` |
| Metric / label names | `mc-metrics` only | stay in `schema.rs` |

---

## Cross-cutting: traits (candidates only)

| Pattern | Implementers | Verdict |
|---------|--------------|---------|
| `TimeRangeParser`, `TimeseriesAnalyzer` | 1 default each | **Done** — extension point for tests/mocks |
| `TrackerRead`, `InsightsRead`, `ChatTool`, `LlmClient` | 1 prod + mocks | **Done** |
| `Platform` ping/resolve dispatch | PC + PE | **Maybe** — `mc_ping::ping_platform(platform, ...)` function preferred over trait unless a third platform appears |
| PromQL query builders | server + asn families | **No trait** — shared private helpers sufficient |
| Rate limiters (login vs chat) | 2 different structs | **No trait** — different semantics |

---

## Cross-cutting: deduplication checklist

- [x] `accumulate_summary` in `manager` (3×)
- [x] `players_sort_key` in `manager` (3×)
- [ ] Rank-server loop in `insights.rs` (2×)
- [ ] `truncate` + `truncated` flag in `mc-chat` tools and `compact.rs`
- [ ] `LIST_LIMIT` / `25` (3 crates)
- [ ] `SECONDS_PER_DAY` (2+ crates)
- [x] `fixture_geo` (test-support vs manager tests)
- [ ] `map_metrics_error` — `api.rs` and `insights.rs` (slightly different mapping); unify in `api/errors.rs` if split
- [ ] `timeseries_lane` → `mc-metrics` (1 impl, 4 call sites)

---

## What not to change

- **Migration SQL files** — never edit applied migrations.
- **`mc-api-types` serde shapes** — HTTP contract unchanged.
- **Merge `mc-insights` into `mc-tracker`** — separation is intentional for testing and `mc-chat` deps.
- **Merge `mc-search` into `mc-tracker`** — used as a pure library; keep standalone.
- **Macro-generated PromQL** — current string builders are readable and tested; macros would hurt debuggability.
- **`mc-db` repos** — stay thin SQL only per `api-conventions.mdc`.

---

## Verification

```bash
# After each phase
cargo check --workspace
cargo test --workspace

# Final pass
cargo clippy --workspace -- -D warnings
cargo fmt --all
```

Integration tests to watch:

- `crates/mc-tracker/tests/*`
- `crates/mc-db/tests/integration.rs`
- `crates/mc-metrics` query alignment tests
- `crates/mc-api-types/tests/dto.rs`

---

## Suggested commit sequence

1. `add shared time and list limit constants to mc-common`
2. `dedupe day-length literals in mc-metrics and mc-insights`
3. `extract mc-geo and mc-ping constants modules`
4. `stop re-exporting mc-dns from mc-ping`
5. `split mc-chat tools_impl into per-tool modules`
6. `split mc-tracker manager into submodules`
7. `move timeseries lane builder to mc-metrics and dedupe manager summary helpers`
8. `relocate dto mappers and insights rank helpers`

Each commit should compile and pass tests independently.

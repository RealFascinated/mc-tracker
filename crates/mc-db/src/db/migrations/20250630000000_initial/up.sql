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
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX users_username_idx ON users (username);

-- default settings
INSERT INTO settings (key, value) VALUES
    ('api_port', '3000'),
    ('api_address', '0.0.0.0'),
    ('pinger_timeout_ms', '5000'),
    ('pinger_retry_attempts', '3'),
    ('pinger_retry_delay_ms', '1000'),
    ('dns_cache_enabled', 'true'),
    ('dns_cache_ttl_minutes', '5'),
    ('victoriametrics_url', 'http://localhost:8428'),
    ('metrics_push_interval_seconds', '10'),
    ('sign_up_enabled', 'false');

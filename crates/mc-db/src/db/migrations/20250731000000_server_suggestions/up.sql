CREATE TABLE server_suggestions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    host        TEXT NOT NULL,
    port        INTEGER,
    platform    TEXT NOT NULL CHECK (platform IN ('PC', 'PE')),
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX server_suggestions_active_identity_idx
    ON server_suggestions (host, COALESCE(port, -1), platform)
    WHERE status IN ('pending', 'denied');

CREATE INDEX server_suggestions_status_idx ON server_suggestions (status, created_at DESC);

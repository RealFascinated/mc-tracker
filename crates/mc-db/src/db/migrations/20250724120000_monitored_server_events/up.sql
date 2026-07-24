CREATE TABLE monitored_server_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id   UUID NOT NULL,
    server_name TEXT NOT NULL,
    event_type  TEXT NOT NULL CHECK (event_type IN ('added', 'removed', 'paused', 'unpaused')),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX monitored_server_events_occurred_at_idx
    ON monitored_server_events (occurred_at);

CREATE INDEX monitored_server_events_server_id_idx
    ON monitored_server_events (server_id);

-- Backfill from existing server rows.
INSERT INTO monitored_server_events (server_id, server_name, event_type, occurred_at)
SELECT id, name, 'added', created_at
FROM servers;

INSERT INTO monitored_server_events (server_id, server_name, event_type, occurred_at)
SELECT id, name, 'paused', updated_at
FROM servers
WHERE paused = true;

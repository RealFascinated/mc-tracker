ALTER TABLE monitored_server_events
    ADD COLUMN server_type TEXT;

UPDATE monitored_server_events AS e
SET server_type = s.platform
FROM servers AS s
WHERE e.server_id = s.id;

UPDATE monitored_server_events
SET server_type = 'PC'
WHERE server_type IS NULL;

ALTER TABLE monitored_server_events
    ALTER COLUMN server_type SET NOT NULL;

ALTER TABLE monitored_server_events
    ADD CONSTRAINT monitored_server_events_server_type_check
    CHECK (server_type IN ('PC', 'PE'));

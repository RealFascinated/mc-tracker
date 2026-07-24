ALTER TABLE monitored_server_events
    DROP CONSTRAINT IF EXISTS monitored_server_events_server_type_check;

ALTER TABLE monitored_server_events
    DROP COLUMN server_type;

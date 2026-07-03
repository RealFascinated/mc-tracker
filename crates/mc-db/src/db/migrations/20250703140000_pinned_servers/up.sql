CREATE TABLE pinned_servers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    position   INTEGER NOT NULL,
    UNIQUE (user_id, server_id)
);
CREATE INDEX pinned_servers_user_position_idx ON pinned_servers (user_id, position);

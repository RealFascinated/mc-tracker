diesel::table! {
    servers (id) {
        id -> Uuid,
        name -> Text,
        host -> Text,
        port -> Nullable<Integer>,
        platform -> Text,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
        peak_players -> Nullable<Integer>,
        peak_players_timestamp -> Nullable<BigInt>,
        paused -> Bool,
    }
}

diesel::table! {
    settings (key) {
        key -> Text,
        value -> Text,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    users (id) {
        id -> Uuid,
        username -> Text,
        password_hash -> Text,
        role -> Text,
        flags -> BigInt,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    chat_messages (id) {
        id -> Uuid,
        user_id -> Uuid,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    pinned_servers (id) {
        id -> Uuid,
        user_id -> Uuid,
        server_id -> Uuid,
        position -> Integer,
    }
}

diesel::joinable!(chat_messages -> users (user_id));
diesel::joinable!(pinned_servers -> users (user_id));
diesel::joinable!(pinned_servers -> servers (server_id));

diesel::allow_tables_to_appear_in_same_query!(
    servers,
    settings,
    users,
    chat_messages,
    pinned_servers,
);

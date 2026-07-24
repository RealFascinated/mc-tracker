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
        display_name -> Nullable<Text>,
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

diesel::table! {
    chat_sessions (id) {
        id -> Uuid,
        user_id -> Uuid,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
        tokens_used -> BigInt,
        last_prompt_tokens -> Integer,
    }
}

diesel::table! {
    monitored_server_events (id) {
        id -> Uuid,
        server_id -> Uuid,
        server_name -> Text,
        event_type -> Text,
        occurred_at -> Timestamptz,
    }
}

diesel::table! {
    chat_turns (id) {
        id -> Uuid,
        session_id -> Uuid,
        seq -> Integer,
        role -> Text,
        content -> Text,
        tool_names -> Array<Text>,
        created_at -> Timestamptz,
    }
}

diesel::joinable!(chat_messages -> users (user_id));
diesel::joinable!(chat_sessions -> users (user_id));
diesel::joinable!(chat_turns -> chat_sessions (session_id));
diesel::joinable!(pinned_servers -> users (user_id));
diesel::joinable!(pinned_servers -> servers (server_id));

diesel::allow_tables_to_appear_in_same_query!(
    servers,
    settings,
    users,
    chat_messages,
    chat_sessions,
    chat_turns,
    pinned_servers,
    monitored_server_events,
);

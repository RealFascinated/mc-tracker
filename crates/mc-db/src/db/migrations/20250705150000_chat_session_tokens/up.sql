ALTER TABLE chat_sessions
    ADD COLUMN tokens_used BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN last_prompt_tokens INTEGER NOT NULL DEFAULT 0;

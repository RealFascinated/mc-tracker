ALTER TABLE chat_sessions
    DROP COLUMN IF EXISTS tokens_used,
    DROP COLUMN IF EXISTS last_prompt_tokens;

INSERT INTO settings (key, value) VALUES
  ('llm_thinking_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES
  ('llm_model', 'default')
ON CONFLICT (key) DO NOTHING;

DELETE FROM settings WHERE key = 'llm_models';

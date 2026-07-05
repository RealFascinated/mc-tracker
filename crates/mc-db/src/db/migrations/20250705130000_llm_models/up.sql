INSERT INTO settings (key, value)
SELECT
  'llm_models',
  CASE
    WHEN trim(value) = '' THEN '["openrouter/free","deepseek/deepseek-v4-flash"]'
    ELSE json_build_array(value)::text
  END
FROM settings
WHERE key = 'llm_model'
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES
  ('llm_models', '["openrouter/free","deepseek/deepseek-v4-flash"]')
ON CONFLICT (key) DO NOTHING;

DELETE FROM settings WHERE key = 'llm_model';

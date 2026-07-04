INSERT INTO settings (key, value) VALUES
  ('llm_base_url', ''),
  ('llm_model', 'default'),
  ('llm_max_tool_rounds', '8'),
  ('llm_context_max_turns', '10'),
  ('llm_tool_max_tokens', '1024'),
  ('llm_final_max_tokens', '2048'),
  ('llm_context_max', '16384'),
  ('llm_context_reserve', '2048'),
  ('llm_timeout_secs', '60'),
  ('llm_provider', 'llama_cpp'),
  ('llm_parallel_slots', '2'),
  ('llm_api_key', '')
ON CONFLICT (key) DO NOTHING;

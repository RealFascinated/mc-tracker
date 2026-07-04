DELETE FROM settings WHERE key IN (
  'llm_base_url',
  'llm_model',
  'llm_max_tool_rounds',
  'llm_context_max_turns',
  'llm_tool_max_tokens',
  'llm_final_max_tokens',
  'llm_context_max',
  'llm_context_reserve',
  'llm_timeout_secs',
  'llm_provider',
  'llm_parallel_slots',
  'llm_api_key'
);

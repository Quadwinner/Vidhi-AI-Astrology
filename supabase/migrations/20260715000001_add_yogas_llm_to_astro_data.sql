-- profile_astro_data.yogas_llm stores LLM-generated yoga analysis text.
-- Referenced by get-chat-answer and generate-yogas functions.
alter table public.profile_astro_data
  add column if not exists yogas_llm text;

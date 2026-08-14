-- The 30B reasoning model spends time and tokens on internal reasoning before
-- emitting the report, which pushed generate-astro-data past the edge worker
-- time limit (the client saw a non-2xx response instead of a handled error).
-- Reports go back to the fast non-reasoning model; strict JSON instructions and
-- a tolerant parser in the function handle the formatting instead.

update public.system_prompts
set model_name = 'nim/meta/llama-3.1-8b-instruct'
where secret_name = 'NVIDIA_API_KEY'
  and prompt_name like 'insights_%';

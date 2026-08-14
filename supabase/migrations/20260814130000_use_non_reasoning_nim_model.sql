-- The nemotron reasoning model spends its token budget on internal reasoning
-- (streamed as reasoning_content) and can finish with an empty visible answer,
-- which shows up in the UI as a reply that never arrives.
-- Move all NIM prompts to a non-reasoning instruct model so the whole budget
-- goes to the answer.

update public.system_prompts
set model_name = 'nim/meta/llama-3.3-70b-instruct'
where secret_name = 'NVIDIA_API_KEY';

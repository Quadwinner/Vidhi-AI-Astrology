-- NIM also serves openai/gpt-oss-120b, which is the model these report prompts
-- were originally written and tuned for on the previous provider
-- (accounts/fireworks/models/gpt-oss-120b, chosen in 20260717060000 because it
-- returned reports reliably and quickly). Verified on NIM with a report-shaped
-- JSON request: finish_reason 'stop', 5784 completion tokens, complete output.
--
-- The function passes reasoning_effort 'low' for gpt-oss so its internal
-- reasoning does not dominate the response time.

update public.system_prompts
set model_name = 'nim/openai/gpt-oss-120b'
where secret_name = 'NVIDIA_API_KEY'
  and prompt_name like 'insights_%';

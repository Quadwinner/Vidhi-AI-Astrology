-- Fireworks credits are exhausted, so all LLM-backed prompts move to NVIDIA NIM.
-- NIM exposes an OpenAI-compatible endpoint at https://integrate.api.nvidia.com/v1.
-- Model names are stored with a 'nim/' routing prefix which the edge functions
-- strip before calling the API, so any NIM-hosted model can be selected here
-- (including non-nvidia/ vendors such as meta/ or deepseek-ai/).
--
-- Requires the NVIDIA_API_KEY secret to be set on the project:
--   supabase secrets set NVIDIA_API_KEY='<key>'

update public.system_prompts
set model_name = 'nim/' || model_name,
    secret_name = 'NVIDIA_API_KEY'
where model_name like 'accounts/fireworks/%';

update public.system_prompts
set model_name = 'nim/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'
where secret_name = 'NVIDIA_API_KEY'
  and model_name not like 'nim/nvidia/%'
  and model_name not like 'nim/meta/%'
  and model_name not like 'nim/deepseek-ai/%';

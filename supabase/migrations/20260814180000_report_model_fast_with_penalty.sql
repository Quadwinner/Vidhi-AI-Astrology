-- The 30B reasoning model exceeded the edge worker time limit at a 12k token
-- budget (client saw a non-2xx). The 8B never timed out — it only truncated and
-- looped, and both of those are now handled in the function (10k token budget
-- plus frequency_penalty). Put reports back on the fast model.

update public.system_prompts
set model_name = 'nim/meta/llama-3.1-8b-instruct'
where secret_name = 'NVIDIA_API_KEY'
  and prompt_name like 'insights_%';

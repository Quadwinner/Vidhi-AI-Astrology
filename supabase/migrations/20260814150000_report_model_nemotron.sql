-- meta/llama-3.1-8b-instruct handles chat fine but breaks strict JSON on the
-- large report schema (finish_reason 'stop' at 8000 tokens, yet unparseable),
-- so every report failed validation.
-- Reports move to the 30B nemotron model, which is still ~1s on this tier and
-- holds structure far better. Chat stays on the 8B.

update public.system_prompts
set model_name = 'nim/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'
where secret_name = 'NVIDIA_API_KEY'
  and prompt_name like 'insights_%';

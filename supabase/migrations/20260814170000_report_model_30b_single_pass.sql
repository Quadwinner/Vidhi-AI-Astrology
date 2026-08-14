-- Instrumented output showed the 8B model failing two ways on the report
-- schema: finish_reason 'length' at 25k characters (truncated JSON) and the
-- tail repeating the head verbatim, i.e. a repetition loop it never exits.
--
-- The 30B model was blamed earlier for a non-2xx, but that was caused by a
-- two-attempt retry loop in the function (now single-pass), not by the model.
-- Reports move back to it with a larger token budget.

update public.system_prompts
set model_name = 'nim/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'
where secret_name = 'NVIDIA_API_KEY'
  and prompt_name like 'insights_%';

-- meta/llama-3.3-70b-instruct is queued on this NIM tier and took ~2 minutes per
-- reply, so the chat appeared to hang. Measured against the same key:
--   meta/llama-3.1-8b-instruct                     ~1.0s   200
--   nvidia/nemotron-3-nano-omni-30b-a3b-reasoning  ~1.0s   200 (spends budget on reasoning)
--   meta/llama-3.3-70b-instruct                    ~120s   200
--   google/gemma-3-12b-it                          404 (not served for this key)
--   nvidia/llama-3.1-nemotron-51b-instruct         404 (not served for this key)
-- Use the fast non-reasoning model so the whole token budget goes to the answer.

update public.system_prompts
set model_name = 'nim/meta/llama-3.1-8b-instruct'
where secret_name = 'NVIDIA_API_KEY';

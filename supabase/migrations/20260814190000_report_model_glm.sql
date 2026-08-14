-- Reports move to z-ai/glm-5.2 on NIM. Measured against the same key with a
-- report-shaped JSON request:
--   z-ai/glm-5.2                 finish=stop, 1282 completion tokens, valid
--                                minified JSON, correctly escaped, Hinglish
--   meta/llama-3.1-8b-instruct   finish=length, degenerated into a repeated
--                                phrase, JSON never valid
--   nemotron-3-nano-30b          exceeded the edge worker time limit
--   meta/llama-3.3-70b-instruct  ~120s, exceeded the time limit
--
-- GLM is also what these report prompts were originally written against
-- (accounts/fireworks/models/glm-5p2) before the Fireworks credits ran out.
-- Chat stays on the fast 8B, which is fine for short conversational replies.

update public.system_prompts
set model_name = 'nim/z-ai/glm-5.2'
where secret_name = 'NVIDIA_API_KEY'
  and prompt_name like 'insights_%';

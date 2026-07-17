-- Report prompts were set to accounts/fireworks/models/glm-5p2, which takes ~60s+
-- per report and pushes the edge function past its worker limit (546 errors).
-- Switch report insight prompts to the fast gpt-oss-120b model already used by
-- chat (~1-5s), so reports generate reliably within the timeout.
update public.system_prompts
set model_name = 'accounts/fireworks/models/gpt-oss-120b'
where prompt_name like 'insights_%'
  and model_name = 'accounts/fireworks/models/glm-5p2';

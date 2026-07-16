-- Rebrand the live voice-call system prompt from "Aura"/"Aura AI" to "Vidhi".
-- The call agent introduces itself using this prompt, so this fixes the spoken intro.
UPDATE public.system_prompts
SET prompt_text = REPLACE(
      REPLACE(
        REPLACE(prompt_text, 'Aura AI', 'Vidhi'),
      'AURA', 'VIDHI'),
    'Aura', 'Vidhi')
WHERE prompt_name = 'voice_call_default';

-- Persist interactive compatibility-form state in chat history.
-- Nullable so all existing chat messages remain valid.
ALTER TABLE public.chat_history
ADD COLUMN IF NOT EXISTS widget_data JSONB;

COMMENT ON COLUMN public.chat_history.widget_data IS
  'Structured state for interactive chat widgets such as compatibility forms.';

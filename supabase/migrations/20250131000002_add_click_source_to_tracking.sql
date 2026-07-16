-- Add click_source column to track button vs message link clicks
ALTER TABLE public.whatsapp_link_clicks 
ADD COLUMN IF NOT EXISTS click_source TEXT DEFAULT 'message_link';

-- Add comment
COMMENT ON COLUMN public.whatsapp_link_clicks.click_source IS 'Source of click: button or message_link';

-- Create index for filtering by click source
CREATE INDEX IF NOT EXISTS idx_whatsapp_link_clicks_source ON public.whatsapp_link_clicks(click_source);















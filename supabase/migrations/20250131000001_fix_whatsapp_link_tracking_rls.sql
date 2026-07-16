-- Fix RLS policies for whatsapp_link_clicks
-- Allow anonymous inserts for tracking function

DROP POLICY IF EXISTS "Allow anonymous inserts for tracking" ON public.whatsapp_link_clicks;

CREATE POLICY "Allow anonymous inserts for tracking"
ON public.whatsapp_link_clicks
FOR INSERT
TO anon
WITH CHECK (true);

-- Also ensure service role can insert (should work but adding explicitly)
DROP POLICY IF EXISTS "Service role can insert clicks" ON public.whatsapp_link_clicks;

CREATE POLICY "Service role can insert clicks"
ON public.whatsapp_link_clicks
FOR INSERT
TO service_role
WITH CHECK (true);


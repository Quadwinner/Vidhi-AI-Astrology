-- Create table to track WhatsApp campaign link clicks
CREATE TABLE IF NOT EXISTS public.whatsapp_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id),
  campaign_name TEXT NOT NULL,
  template_name TEXT,
  original_url TEXT NOT NULL,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_link_clicks_phone ON public.whatsapp_link_clicks(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_link_clicks_campaign ON public.whatsapp_link_clicks(campaign_name);
CREATE INDEX IF NOT EXISTS idx_whatsapp_link_clicks_clicked_at ON public.whatsapp_link_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_link_clicks_user_id ON public.whatsapp_link_clicks(user_id);

-- Enable RLS
ALTER TABLE public.whatsapp_link_clicks ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert (for Edge Functions)
-- Note: Service role bypasses RLS, but this policy ensures inserts work
CREATE POLICY "Service role can insert clicks"
ON public.whatsapp_link_clicks
FOR INSERT
TO service_role
WITH CHECK (true);

-- Also allow anonymous inserts (for tracking function)
CREATE POLICY "Allow anonymous inserts for tracking"
ON public.whatsapp_link_clicks
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow users to read their own clicks
CREATE POLICY "Users can read own clicks"
ON public.whatsapp_link_clicks
FOR SELECT
USING (auth.uid() = user_id);

-- Allow admins to read all clicks
CREATE POLICY "Admins can read all clicks"
ON public.whatsapp_link_clicks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND is_admin = true
  )
);


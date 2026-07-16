-- Migration: Create CleverTap sync logs table
-- Created: 2025-12-17
-- Purpose: Track CleverTap sync history and status

CREATE TABLE IF NOT EXISTS public.clevertap_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  response JSONB,
  error_message TEXT,
  synced_properties_count INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_clevertap_sync_logs_user_id ON public.clevertap_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_clevertap_sync_logs_status ON public.clevertap_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_clevertap_sync_logs_synced_at ON public.clevertap_sync_logs(synced_at DESC);

-- Enable RLS
ALTER TABLE public.clevertap_sync_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs
CREATE POLICY "Admins can read all sync logs"
ON public.clevertap_sync_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Service role can insert logs (for Edge Functions)
CREATE POLICY "Service role can insert sync logs"
ON public.clevertap_sync_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON TABLE public.clevertap_sync_logs TO authenticated;
GRANT ALL ON TABLE public.clevertap_sync_logs TO service_role;

-- Add comment
COMMENT ON TABLE public.clevertap_sync_logs IS 'Tracks CleverTap user sync history and status for monitoring and debugging';

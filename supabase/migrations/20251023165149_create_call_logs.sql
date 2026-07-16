-- Migration: Create call_logs table for tracking AI voice call duration and coin usage
-- Description: Implements coin-based billing for AI calls (20 coins per minute)
-- Created: 2025-10-23

-- Create call_logs table
CREATE TABLE IF NOT EXISTS public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  call_id text, -- Ultravox call ID (updated after call creation)
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration_seconds integer DEFAULT 0,
  coins_deducted integer DEFAULT 0,
  coins_per_minute integer DEFAULT 20,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'interrupted', 'insufficient_coins')),
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_call_logs_user_id ON public.call_logs(user_id);
CREATE INDEX idx_call_logs_profile_id ON public.call_logs(profile_id);
CREATE INDEX idx_call_logs_started_at ON public.call_logs(started_at DESC);
CREATE INDEX idx_call_logs_status ON public.call_logs(status);

-- Enable Row Level Security
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own call logs
CREATE POLICY "Users can view their own call logs"
  ON public.call_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own call logs
CREATE POLICY "Users can insert their own call logs"
  ON public.call_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own call logs
CREATE POLICY "Users can update their own call logs"
  ON public.call_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON TABLE public.call_logs TO authenticated;
GRANT ALL ON TABLE public.call_logs TO service_role;
GRANT ALL ON TABLE public.call_logs TO anon;

-- Add table comment
COMMENT ON TABLE public.call_logs IS 'Tracks AI voice call duration and coin usage for billing. Users are charged 20 coins per minute during active calls.';

-- Add column comments
COMMENT ON COLUMN public.call_logs.call_id IS 'Ultravox call ID, populated after call is created';
COMMENT ON COLUMN public.call_logs.duration_seconds IS 'Total call duration in seconds';
COMMENT ON COLUMN public.call_logs.coins_deducted IS 'Total coins deducted for this call';
COMMENT ON COLUMN public.call_logs.coins_per_minute IS 'Coin rate per minute (default: 20)';
COMMENT ON COLUMN public.call_logs.status IS 'Call status: active, completed, interrupted, or insufficient_coins';



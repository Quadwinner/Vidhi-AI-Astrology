-- Migration: Create WhatsApp bot tables for session and message tracking
-- Description: Tables for WhatsApp bot conversation flow and message logging
-- Created: 2025-11-18

-- Create WhatsApp sessions table
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'greeting',
  user_data JSONB DEFAULT '{}',
  question_count INTEGER DEFAULT 0,
  chart_created BOOLEAN DEFAULT false,
  chart_data JSONB,
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create WhatsApp message logs table
CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  message_content TEXT,
  message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON public.whatsapp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_state ON public.whatsapp_sessions(state);
CREATE INDEX IF NOT EXISTS idx_message_session ON public.whatsapp_message_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_message_phone ON public.whatsapp_message_logs(session_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_whatsapp_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_whatsapp_session_timestamp ON public.whatsapp_sessions;
CREATE TRIGGER update_whatsapp_session_timestamp
BEFORE UPDATE ON public.whatsapp_sessions
FOR EACH ROW
EXECUTE FUNCTION update_whatsapp_session_timestamp();

-- Enable Row Level Security
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Service role can access all (for webhook)
-- Users can view their own sessions (if linked to user_id)
CREATE POLICY "Service role full access to whatsapp_sessions"
  ON public.whatsapp_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to whatsapp_message_logs"
  ON public.whatsapp_message_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE public.whatsapp_sessions TO service_role;
GRANT ALL ON TABLE public.whatsapp_message_logs TO service_role;













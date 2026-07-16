-- Migration: Add WhatsApp opt-in tracking to users table
-- Description: Track if users have opted in to receive WhatsApp marketing campaigns
-- Created: 2025-01-30

-- Add whatsapp_marketing_opt_in column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS whatsapp_marketing_opt_in BOOLEAN DEFAULT false;

-- Add opt_in_date to track when user opted in
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS whatsapp_marketing_opt_in_date TIMESTAMP WITH TIME ZONE;

-- Add opt_in_source to track how user opted in (website, email, sms, etc.)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS whatsapp_marketing_opt_in_source TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_whatsapp_opt_in ON public.users(whatsapp_marketing_opt_in) 
WHERE whatsapp_marketing_opt_in = true;

-- Comment
COMMENT ON COLUMN public.users.whatsapp_marketing_opt_in IS 'Whether user has opted in to receive WhatsApp marketing campaigns';
COMMENT ON COLUMN public.users.whatsapp_marketing_opt_in_date IS 'Date when user opted in to WhatsApp marketing';
COMMENT ON COLUMN public.users.whatsapp_marketing_opt_in_source IS 'Source of opt-in: website, email, sms, whatsapp, etc.';


-- Migration: Add notification preferences table
-- Created: 2025-01-31
-- Purpose: Store user notification preferences for CleverTap Web Push

-- User notification preferences table
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,

  -- Permission state
  notification_permission TEXT CHECK (notification_permission IN ('default', 'granted', 'denied')),
  notification_enabled BOOLEAN DEFAULT false,

  -- Preference categories
  daily_horoscope_enabled BOOLEAN DEFAULT true,
  weekly_forecast_enabled BOOLEAN DEFAULT true,
  transit_alerts_enabled BOOLEAN DEFAULT true,
  chat_reminders_enabled BOOLEAN DEFAULT false,
  subscription_reminders_enabled BOOLEAN DEFAULT true,
  promotional_enabled BOOLEAN DEFAULT false,

  -- Timing preferences
  daily_horoscope_time TIME DEFAULT '09:00:00',
  weekly_forecast_day INTEGER DEFAULT 1 CHECK (weekly_forecast_day BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday, etc.

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own preferences
CREATE POLICY "Users manage own notification preferences"
ON public.user_notification_preferences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins have full access
CREATE POLICY "Admins full access to notification preferences"
ON public.user_notification_preferences
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trg_update_notification_preferences_updated_at
BEFORE UPDATE ON public.user_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_notification_preferences_updated_at();

-- Index for faster lookups
CREATE INDEX idx_notification_prefs_user_id ON public.user_notification_preferences(user_id);
CREATE INDEX idx_notification_prefs_enabled ON public.user_notification_preferences(notification_enabled) WHERE notification_enabled = true;

-- Add comment
COMMENT ON TABLE public.user_notification_preferences IS 'Stores user preferences for CleverTap Web Push notifications';

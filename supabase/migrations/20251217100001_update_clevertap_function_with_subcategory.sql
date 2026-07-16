-- Migration: Update CleverTap aggregation function with sub-category tracking
-- Created: 2025-12-17
-- Purpose: Add sub_category tracking and improve NULL handling for age/gender

CREATE OR REPLACE FUNCTION public.get_user_clevertap_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_user RECORD;
  v_profile_count INT;
  v_call_stats RECORD;
  v_chat_stats RECORD;
  v_category_stats JSONB;
  v_payment_stats RECORD;
  v_counters RECORD;
  v_birth_details RECORD;
  v_feedback_stats RECORD;
  v_notif_prefs RECORD;
  v_plan_entitlements RECORD;
  v_total_spent NUMERIC;
BEGIN
  -- Get user basic info
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- Get profile count
  SELECT COUNT(*) INTO v_profile_count
  FROM public.user_profiles WHERE user_id = p_user_id;

  -- Get call stats
  SELECT
    COUNT(*) as total_calls,
    COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
    COALESCE(AVG(duration_seconds), 0) as avg_duration_seconds,
    MAX(started_at) as last_call_date,
    (SELECT duration_seconds FROM public.call_logs
     WHERE user_id = p_user_id AND status = 'completed'
     ORDER BY started_at DESC LIMIT 1) as last_call_duration
  INTO v_call_stats
  FROM public.call_logs
  WHERE user_id = p_user_id AND status = 'completed';

  -- Get chat stats with category AND sub-category breakdown
  SELECT
    COUNT(*) FILTER (WHERE role = 'user') as total_messages,
    MAX(created_at) FILTER (WHERE role = 'user') as last_message_date,
    MODE() WITHIN GROUP (ORDER BY language) as preferred_language,
    COUNT(*) FILTER (WHERE role = 'user' AND question_category = 'Love') as love_questions,
    COUNT(*) FILTER (WHERE role = 'user' AND question_category = 'Marriage') as marriage_questions,
    COUNT(*) FILTER (WHERE role = 'user' AND question_category = 'Career') as career_questions,
    COUNT(*) FILTER (WHERE role = 'user' AND question_category = 'Health') as health_questions,
    COUNT(*) FILTER (WHERE role = 'user' AND question_category = 'Money') as money_questions,
    COUNT(*) FILTER (WHERE role = 'user' AND question_category = 'Spiritual') as spiritual_questions,
    MODE() WITHIN GROUP (ORDER BY question_category) FILTER (WHERE role = 'user' AND question_category IS NOT NULL) as most_asked_category,
    MODE() WITHIN GROUP (ORDER BY sub_category) FILTER (WHERE role = 'user' AND sub_category IS NOT NULL) as most_asked_subcategory
  INTO v_chat_stats
  FROM public.chat_history
  WHERE user_id = p_user_id;

  -- Get payment stats
  SELECT
    us.status as subscription_status,
    us.current_period_end as subscription_end,
    us.created_at as last_payment_date,
    pr.amount as last_payment_amount,
    pr.currency as payment_currency,
    CASE
      WHEN v_user.gateway_customer_id LIKE 'cus_%' THEN 'Stripe'
      WHEN v_user.gateway_customer_id LIKE 'cust_%' THEN 'Razorpay'
      ELSE 'Unknown'
    END as payment_gateway
  INTO v_payment_stats
  FROM public.users_subscriptions us
  JOIN public.prices pr ON us.price_id = pr.id
  WHERE us.user_id = p_user_id
  ORDER BY us.created_at DESC
  LIMIT 1;

  -- Calculate total amount spent
  SELECT COALESCE(SUM(pr.amount), 0)
  INTO v_total_spent
  FROM public.users_subscriptions us
  JOIN public.prices pr ON us.price_id = pr.id
  WHERE us.user_id = p_user_id AND us.status IN ('active', 'canceled');

  -- Get current cycle counters
  SELECT *
  INTO v_counters
  FROM public.user_plan_counters
  WHERE user_id = p_user_id
  AND cycle_end >= CURRENT_DATE
  ORDER BY cycle_start DESC
  LIMIT 1;

  -- Get plan entitlements for remaining calculations
  SELECT pe.*
  INTO v_plan_entitlements
  FROM public.plan_entitlements pe
  JOIN public.subscription_plans sp ON pe.plan_id = sp.id
  WHERE sp.interval = CASE
    WHEN v_user.plan_tier = 'monthly' THEN 'month'::subscription_interval
    WHEN v_user.plan_tier = 'yearly' THEN 'year'::subscription_interval
    ELSE 'month'::subscription_interval
  END
  LIMIT 1;

  -- Get birth details from first profile (with NULL handling)
  SELECT ubd.gender, ubd.date_of_birth
  INTO v_birth_details
  FROM public.user_birth_details ubd
  JOIN public.user_profiles up ON ubd.profile_id = up.id
  WHERE up.user_id = p_user_id
  LIMIT 1;

  -- Get call feedback stats
  SELECT
    ROUND(AVG(rating)::NUMERIC, 2) as avg_rating,
    COUNT(*) as total_feedbacks,
    MAX(created_at) as last_feedback_date,
    (SELECT rating FROM public.call_feedback
     WHERE user_id = p_user_id
     ORDER BY created_at DESC LIMIT 1) as last_rating
  INTO v_feedback_stats
  FROM public.call_feedback
  WHERE user_id = p_user_id;

  -- Get notification preferences
  SELECT *
  INTO v_notif_prefs
  FROM public.user_notification_preferences
  WHERE user_id = p_user_id;

  -- Build result JSON with improved NULL handling
  result := jsonb_build_object(
    -- User Identity
    'user_id', v_user.id,
    'email', v_user.email,

    -- Plan & Subscription
    'plan_tier', v_user.plan_tier,
    'subscription_status', COALESCE(v_user.subscription_status, 'inactive'),
    'subscription_start_date', v_user.subscription_start_date,
    'subscription_end_date', v_user.subscription_end_date,
    'coin_balance', v_user.coin_balance,

    -- Profile Info (with NULL handling for birth details)
    'profile_count', v_profile_count,
    'gender', COALESCE(v_birth_details.gender, 'Not Provided'),
    'age', CASE
      WHEN v_birth_details.date_of_birth IS NOT NULL
      THEN EXTRACT(YEAR FROM AGE(v_birth_details.date_of_birth))
      ELSE NULL
    END,

    -- Call Stats
    'total_calls', COALESCE(v_call_stats.total_calls, 0),
    'total_call_duration_minutes', ROUND(COALESCE(v_call_stats.total_duration_seconds, 0)::NUMERIC / 60, 2),
    'avg_call_duration_minutes', ROUND(COALESCE(v_call_stats.avg_duration_seconds, 0)::NUMERIC / 60, 2),
    'last_call_date', v_call_stats.last_call_date,
    'last_call_duration_minutes', ROUND(COALESCE(v_call_stats.last_call_duration, 0)::NUMERIC / 60, 2),

    -- Call Feedback
    'avg_call_rating', COALESCE(v_feedback_stats.avg_rating, 0),
    'total_call_feedbacks', COALESCE(v_feedback_stats.total_feedbacks, 0),
    'last_call_rating', v_feedback_stats.last_rating,

    -- Chat Stats
    'total_messages', COALESCE(v_chat_stats.total_messages, 0),
    'last_message_date', v_chat_stats.last_message_date,
    'preferred_language', COALESCE(v_chat_stats.preferred_language, 'en'),

    -- Category Breakdown (UPDATED WITH SUB-CATEGORY)
    'most_asked_category', v_chat_stats.most_asked_category,
    'most_asked_subcategory', v_chat_stats.most_asked_subcategory,
    'love_questions_count', COALESCE(v_chat_stats.love_questions, 0),
    'marriage_questions_count', COALESCE(v_chat_stats.marriage_questions, 0),
    'career_questions_count', COALESCE(v_chat_stats.career_questions, 0),
    'health_questions_count', COALESCE(v_chat_stats.health_questions, 0),
    'money_questions_count', COALESCE(v_chat_stats.money_questions, 0),
    'spiritual_questions_count', COALESCE(v_chat_stats.spiritual_questions, 0),

    -- Payment Stats
    'last_payment_date', v_payment_stats.last_payment_date,
    'last_payment_amount', COALESCE(v_payment_stats.last_payment_amount, 0),
    'payment_currency', v_payment_stats.payment_currency,
    'payment_gateway', COALESCE(v_payment_stats.payment_gateway, 'None'),
    'total_amount_spent', COALESCE(v_total_spent, 0),

    -- Usage Counters (Current Cycle)
    'questions_used_this_month', COALESCE(v_counters.questions_used, 0),
    'talk_minutes_used_this_month', COALESCE(v_counters.talk_minutes_used, 0),
    'questions_remaining', COALESCE(v_plan_entitlements.questions_per_month, 0) - COALESCE(v_counters.questions_used, 0),
    'talk_minutes_remaining', COALESCE(v_plan_entitlements.ai_call_talk_minutes, 0) - COALESCE(v_counters.talk_minutes_used, 0),
    'cycle_end_date', v_counters.cycle_end,

    -- Notification Preferences
    'push_notifications_enabled', COALESCE(v_notif_prefs.notification_enabled, false),
    'daily_horoscope_enabled', COALESCE(v_notif_prefs.daily_horoscope_enabled, false),
    'weekly_forecast_enabled', COALESCE(v_notif_prefs.weekly_forecast_enabled, false),
    'promotional_enabled', COALESCE(v_notif_prefs.promotional_enabled, false),

    -- Engagement Flags
    'has_created_profile', v_profile_count > 0,
    'has_made_call', COALESCE(v_call_stats.total_calls, 0) > 0,
    'has_sent_message', COALESCE(v_chat_stats.total_messages, 0) > 0,
    'is_admin', COALESCE(v_user.is_admin, false),

    -- Metadata
    'last_updated', NOW(),
    'account_created', v_user.updated_at
  );

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_clevertap_data(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_clevertap_data(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_user_clevertap_data(UUID) IS 'Aggregates all user data for CleverTap profile sync including sub-categories, with improved NULL handling for age/gender';

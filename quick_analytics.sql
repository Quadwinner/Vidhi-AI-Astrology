-- ============================================
-- QUICK ANALYTICS QUERIES - COPY & PASTE INTO SUPABASE SQL EDITOR
-- ============================================

-- 1. TOTAL LOGGED IN USERS (DATE WISE) - Last 30 days
SELECT 
  DATE(created_at) as date,
  COUNT(DISTINCT id) as total_logged_in_users
FROM auth.users
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 2. USER CHATS (DATE WISE) - Last 30 days
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_messages,
  COUNT(DISTINCT user_id) as unique_users_chatted,
  COUNT(*) FILTER (WHERE role = 'user') as user_messages,
  COUNT(*) FILTER (WHERE role = 'assistant') as assistant_messages
FROM public.chat_history
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 3. USERS WHO PAID (DATE WISE) - Last 30 days
SELECT 
  DATE(subscription_start_date) as date,
  COUNT(DISTINCT id) as users_who_paid,
  COUNT(DISTINCT id) FILTER (WHERE plan_tier = 'monthly') as monthly_subscribers,
  COUNT(DISTINCT id) FILTER (WHERE plan_tier = 'yearly') as yearly_subscribers,
  COUNT(DISTINCT id) FILTER (WHERE subscription_status = 'active') as active_subscribers
FROM public.users
WHERE subscription_start_date IS NOT NULL
  AND subscription_start_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(subscription_start_date)
ORDER BY date DESC;

-- 4. TOTAL AMOUNT (DATE WISE) - Estimated from subscriptions
-- Note: Prices are stored in the 'prices' table. This shows plan_tier breakdown.
SELECT 
  DATE(u.subscription_start_date) as date,
  COUNT(DISTINCT u.id) as paid_users,
  u.plan_tier,
  COUNT(DISTINCT u.id) FILTER (WHERE u.plan_tier = 'monthly') as monthly_count,
  COUNT(DISTINCT u.id) FILTER (WHERE u.plan_tier = 'yearly') as yearly_count
FROM public.users u
WHERE u.subscription_start_date IS NOT NULL
  AND u.subscription_start_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(u.subscription_start_date), u.plan_tier
ORDER BY date DESC, u.plan_tier;

-- 5. FAILED PAYMENTS (DATE WISE) - Last 30 days
SELECT 
  DATE(updated_at) as date,
  COUNT(*) as failed_payments,
  COUNT(DISTINCT id) as users_with_failed_payments,
  subscription_status
FROM public.users
WHERE subscription_status IN ('past_due', 'incomplete')
  AND updated_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(updated_at), subscription_status
ORDER BY date DESC;

-- ============================================
-- ALL-IN-ONE DAILY SUMMARY (RECOMMENDED)
-- ============================================
WITH daily_users AS (
  SELECT 
    DATE(created_at) as date,
    COUNT(DISTINCT id) as new_users
  FROM auth.users
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY DATE(created_at)
),
daily_chats AS (
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_messages,
    COUNT(DISTINCT user_id) as active_users
  FROM public.chat_history
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY DATE(created_at)
),
daily_payments AS (
  SELECT 
    DATE(subscription_start_date) as date,
    COUNT(DISTINCT id) as paid_users
  FROM public.users
  WHERE subscription_start_date IS NOT NULL
    AND subscription_start_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY DATE(subscription_start_date)
),
daily_failed AS (
  SELECT 
    DATE(updated_at) as date,
    COUNT(*) as failed_payments
  FROM public.users
  WHERE subscription_status IN ('past_due', 'incomplete')
    AND updated_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY DATE(updated_at)
)
SELECT 
  COALESCE(du.date, dc.date, dp.date, df.date) as date,
  COALESCE(du.new_users, 0) as new_users,
  COALESCE(dc.total_messages, 0) as total_messages,
  COALESCE(dc.active_users, 0) as active_chat_users,
  COALESCE(dp.paid_users, 0) as paid_users,
  COALESCE(df.failed_payments, 0) as failed_payments
FROM daily_users du
FULL OUTER JOIN daily_chats dc ON du.date = dc.date
FULL OUTER JOIN daily_payments dp ON COALESCE(du.date, dc.date) = dp.date
FULL OUTER JOIN daily_failed df ON COALESCE(du.date, dc.date, dp.date) = df.date
ORDER BY date DESC;


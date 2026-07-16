-- ============================================
-- ANALYTICS QUERIES FOR SUPABASE SQL EDITOR
-- ============================================

-- ============================================
-- 1. TOTAL LOGGED IN USERS (DATE WISE)
-- ============================================
SELECT 
  DATE(created_at) as date,
  COUNT(DISTINCT id) as total_logged_in_users,
  COUNT(DISTINCT id) FILTER (WHERE email IS NOT NULL) as users_with_email,
  COUNT(DISTINCT id) FILTER (WHERE phone IS NOT NULL) as users_with_phone
FROM auth.users
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'  -- Last 30 days, adjust as needed
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Alternative: Using public.users table (join with auth.users for creation date)
SELECT 
  DATE(au.created_at) as date,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT u.id) FILTER (WHERE u.email IS NOT NULL) as users_with_email,
  COUNT(DISTINCT u.id) FILTER (WHERE u.phone_number IS NOT NULL) as users_with_phone,
  COUNT(DISTINCT u.id) FILTER (WHERE u.msg91_phone_number IS NOT NULL) as users_with_msg91_phone
FROM public.users u
INNER JOIN auth.users au ON u.id = au.id
WHERE au.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(au.created_at)
ORDER BY date DESC;

-- ============================================
-- 2. USER CHATS (DATE WISE)
-- ============================================
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_messages,
  COUNT(DISTINCT user_id) as unique_users_chatted,
  COUNT(DISTINCT profile_id) as unique_profiles,
  COUNT(*) FILTER (WHERE role = 'user') as user_messages,
  COUNT(*) FILTER (WHERE role = 'assistant') as assistant_messages,
  COUNT(*) FILTER (WHERE feedback = 'like') as liked_messages,
  COUNT(*) FILTER (WHERE feedback = 'dislike') as disliked_messages
FROM public.chat_history
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Chats per user per day (who chatted what volume)
SELECT 
  DATE(created_at) AS date,
  user_id,
  COUNT(*) AS total_messages,
  COUNT(*) FILTER (WHERE role = 'user') AS user_messages,
  COUNT(*) FILTER (WHERE role = 'assistant') AS assistant_messages
FROM public.chat_history
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), user_id
ORDER BY date DESC, total_messages DESC;

-- ============================================
-- 3. USERS WHO PAID (DATE WISE)
-- ============================================
-- Preferred: from users_subscriptions (captures status changes and renewals)
SELECT 
  DATE(created_at) AS date,
  COUNT(DISTINCT user_id) FILTER (WHERE status IN ('active','past_due','incomplete')) AS users_who_paid_or_in_progress,
  COUNT(DISTINCT user_id) FILTER (WHERE status = 'active') AS active_subscriptions,
  COUNT(DISTINCT user_id) FILTER (WHERE status = 'canceled') AS canceled_subscriptions,
  COUNT(DISTINCT gateway_subscription_id) AS total_subscriptions
FROM public.users_subscriptions
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Fallback: from users table (if subscription_start_date is stored there)
SELECT 
  DATE(subscription_start_date) AS date,
  COUNT(DISTINCT id) AS users_who_paid,
  COUNT(DISTINCT id) FILTER (WHERE plan_tier = 'monthly') AS monthly_subscribers,
  COUNT(DISTINCT id) FILTER (WHERE plan_tier = 'yearly') AS yearly_subscribers,
  COUNT(DISTINCT id) FILTER (WHERE subscription_status = 'active') AS active_subscribers,
  COUNT(DISTINCT id) FILTER (WHERE subscription_status = 'canceled') AS canceled_subscribers
FROM public.users
WHERE subscription_start_date IS NOT NULL
  AND subscription_start_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(subscription_start_date)
ORDER BY date DESC;

-- ============================================
-- 4. TOTAL AMOUNT (DATE WISE)
-- ============================================
-- Note: This requires payment data. If you store payment amounts, adjust accordingly.
-- Check if you have a payments/transactions table

-- Option A: If you have a payments table
-- SELECT 
--   DATE(created_at) as date,
--   SUM(amount) as total_amount,
--   COUNT(*) as total_payments,
--   SUM(amount) FILTER (WHERE status = 'success') as successful_amount,
--   SUM(amount) FILTER (WHERE status = 'failed') as failed_amount
-- FROM public.payments
-- WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY DATE(created_at)
-- ORDER BY date DESC;

-- Option B: Estimate from subscription plans and prices
-- Note: Prices are stored in the 'prices' table, not 'subscription_plans'
-- This query shows plan_tier breakdown. For actual prices, join with 'prices' table using plan_id
-- If you do NOT have a payments table, use this safe fallback (counts only, no amounts)
SELECT 
  DATE(created_at) AS date,
  COUNT(*) AS total_subscription_rows,
  COUNT(*) FILTER (WHERE status = 'active') AS active_rows,
  COUNT(*) FILTER (WHERE status IN ('past_due','incomplete','canceled')) AS non_active_rows,
  0::numeric AS total_amount_placeholder -- replace with SUM(amount) if/when you add an amount column
FROM public.users_subscriptions
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Option A: payments table (uncomment and adjust only if you have this table/columns)
-- SELECT 
--   DATE(created_at) AS date,
--   SUM(amount) FILTER (WHERE status = 'success') AS total_amount_success,
--   SUM(amount) FILTER (WHERE status = 'failed') AS total_amount_failed,
--   COUNT(*) AS total_payments,
--   COUNT(*) FILTER (WHERE status = 'success') AS successful_payments,
--   COUNT(*) FILTER (WHERE status = 'failed') AS failed_payments
-- FROM public.payments
-- WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
-- GROUP BY DATE(created_at)
-- ORDER BY date DESC;

-- ============================================
-- 5. FAILED PAYMENTS (DATE WISE)
-- ============================================
-- Check webhook logs or payment status in users_subscriptions

-- Option A: From users_subscriptions (if status tracks failures)
SELECT 
  DATE(updated_at) as date,
  COUNT(*) as failed_payments,
  COUNT(DISTINCT user_id) as users_with_failed_payments
FROM public.users_subscriptions
WHERE status IN ('past_due', 'incomplete')
  AND updated_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(updated_at)
ORDER BY date DESC;

-- Option B: From users table (subscription_status)
SELECT 
  DATE(updated_at) as date,
  COUNT(*) as failed_payments,
  COUNT(DISTINCT id) as users_with_failed_payments,
  subscription_status
FROM public.users
WHERE subscription_status IN ('past_due', 'incomplete')
  AND updated_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(updated_at), subscription_status
ORDER BY date DESC;

-- ============================================
-- COMPREHENSIVE DAILY SUMMARY
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

-- ============================================
-- ADDITIONAL USEFUL QUERIES
-- ============================================

-- Total users by plan tier
SELECT 
  plan_tier,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE subscription_status = 'active') as active_users,
  COUNT(*) FILTER (WHERE subscription_status = 'canceled') as cancelled_users
FROM public.users
GROUP BY plan_tier
ORDER BY plan_tier;

-- Users with most chat messages
SELECT 
  u.id,
  u.email,
  COUNT(ch.id) as total_messages,
  COUNT(ch.id) FILTER (WHERE ch.role = 'user') as user_messages,
  COUNT(ch.id) FILTER (WHERE ch.role = 'assistant') as assistant_messages
FROM public.users u
LEFT JOIN public.chat_history ch ON ch.user_id = u.id
GROUP BY u.id, u.email
ORDER BY total_messages DESC
LIMIT 20;

-- Revenue by plan (plan_tier breakdown)
-- Note: For actual prices, you'll need to join with 'prices' table using plan_id
SELECT 
  u.plan_tier,
  COUNT(DISTINCT u.id) as subscribers,
  COUNT(DISTINCT u.id) FILTER (WHERE u.plan_tier = 'monthly') as monthly_subscribers,
  COUNT(DISTINCT u.id) FILTER (WHERE u.plan_tier = 'yearly') as yearly_subscribers
FROM public.users u
WHERE u.plan_tier != 'free'
  AND u.subscription_status = 'active'
GROUP BY u.plan_tier
ORDER BY subscribers DESC;


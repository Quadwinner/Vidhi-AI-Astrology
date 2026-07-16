-- Check phone numbers in users table
-- Run this in Supabase SQL Editor

-- 1. Check if phone_number column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'phone_number';

-- 2. Check all users with phone numbers
SELECT 
  id,
  email,
  phone_number,
  coin_balance,
  plan_tier,
  subscription_status,
  updated_at
FROM public.users
WHERE phone_number IS NOT NULL
ORDER BY updated_at DESC
LIMIT 20;

-- 3. Count users with phone numbers
SELECT 
  COUNT(*) as total_users,
  COUNT(phone_number) as users_with_phone,
  COUNT(*) - COUNT(phone_number) as users_without_phone
FROM public.users;

-- 4. Check recent users (last 10)
SELECT 
  id,
  email,
  phone_number,
  coin_balance,
  plan_tier,
  updated_at
FROM public.users
ORDER BY updated_at DESC
LIMIT 10;

-- 5. Check for duplicate phone numbers (should be none due to unique index)
SELECT 
  phone_number,
  COUNT(*) as count
FROM public.users
WHERE phone_number IS NOT NULL
GROUP BY phone_number
HAVING COUNT(*) > 1;


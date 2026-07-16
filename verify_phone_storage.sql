-- Verify if phone number 7068901646 is stored in public.users table
-- Run this in Supabase SQL Editor

-- ============================================
-- PRIMARY CHECK: public.users table
-- ============================================
SELECT 
  id,
  email,
  phone_number,
  coin_balance,
  plan_tier,
  subscription_status,
  updated_at,
  CASE 
    WHEN phone_number IS NOT NULL THEN '✅ STORED'
    ELSE '❌ NOT STORED'
  END as storage_status
FROM public.users
WHERE phone_number = '7068901646'
   OR phone_number = '+7068901646'
   OR phone_number = '+917068901646'
   OR phone_number LIKE '%7068901646%'
ORDER BY updated_at DESC;

-- ============================================
-- Check if ANY phone numbers are being stored
-- ============================================
SELECT 
  COUNT(*) as total_users,
  COUNT(phone_number) as users_with_phone,
  COUNT(*) - COUNT(phone_number) as users_without_phone
FROM public.users;

-- ============================================
-- Check most recent 10 users (to see latest storage activity)
-- ============================================
SELECT 
  id,
  email,
  phone_number,
  coin_balance,
  plan_tier,
  updated_at,
  CASE 
    WHEN phone_number IS NOT NULL THEN '✅ HAS PHONE'
    ELSE '❌ NO PHONE'
  END as phone_status
FROM public.users
ORDER BY updated_at DESC
LIMIT 10;


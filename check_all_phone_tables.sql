-- Comprehensive query to check phone number 7068901646 in ALL possible tables
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Check public.users table (PRIMARY LOCATION)
-- ============================================
SELECT 
  'public.users' as table_name,
  id,
  email,
  phone_number,
  coin_balance,
  plan_tier,
  updated_at
FROM public.users
WHERE phone_number = '7068901646'
   OR phone_number = '+7068901646'
   OR phone_number = '+917068901646'
   OR phone_number LIKE '%7068901646%';

-- ============================================
-- 2. Check auth.users table (Supabase Auth)
-- ============================================
SELECT 
  'auth.users' as table_name,
  id,
  email,
  phone,
  raw_user_meta_data->>'phone' as phone_from_metadata,
  raw_user_meta_data->>'phone_number' as phone_number_from_metadata,
  created_at,
  updated_at
FROM auth.users
WHERE phone = '7068901646'
   OR phone = '+7068901646'
   OR phone = '+917068901646'
   OR phone LIKE '%7068901646%'
   OR raw_user_meta_data->>'phone' = '7068901646'
   OR raw_user_meta_data->>'phone_number' = '7068901646';

-- ============================================
-- 3. Check whatsapp_sessions table (if exists)
-- ============================================
SELECT 
  'public.whatsapp_sessions' as table_name,
  id,
  phone_number,
  user_id,
  state,
  created_at,
  updated_at
FROM public.whatsapp_sessions
WHERE phone_number = '7068901646'
   OR phone_number = '+7068901646'
   OR phone_number = '+917068901646'
   OR phone_number LIKE '%7068901646%';

-- ============================================
-- 4. Summary: Check all tables with phone_number column
-- ============================================
SELECT 
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name LIKE '%phone%'
  AND table_schema IN ('public', 'auth')
ORDER BY table_schema, table_name;

-- ============================================
-- 5. Check recent users in public.users (to see latest activity)
-- ============================================
SELECT 
  'Recent users in public.users' as info,
  id,
  email,
  phone_number,
  coin_balance,
  plan_tier,
  updated_at
FROM public.users
ORDER BY updated_at DESC
LIMIT 10;


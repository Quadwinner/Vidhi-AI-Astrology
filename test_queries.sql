-- ============================================
-- TEST QUERIES - Run these to verify everything works
-- ============================================

-- Test 1: Check if public.users has created_at (should fail, confirming fix needed)
-- SELECT DATE(created_at) FROM public.users LIMIT 1;  -- This will fail

-- Test 2: Check columns in public.users
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- Test 3: Verify the fixed query works (should work now)
SELECT 
  DATE(au.created_at) as date,
  COUNT(DISTINCT u.id) as total_users
FROM public.users u
INNER JOIN auth.users au ON u.id = au.id
WHERE au.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(au.created_at)
ORDER BY date DESC;


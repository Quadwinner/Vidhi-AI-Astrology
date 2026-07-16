-- Query to extract users with wallet balance greater than 10
-- This query selects all users who have wallet balance > 10

SELECT 
    u.id,
    u.email,
    u.wallet_balance,
    u.currency_code,
    u.coin_balance,
    u.plan_tier,
    u.subscription_status,
    u.country,
    u.created_at,
    u.updated_at
FROM 
    public.users u
WHERE 
    u.wallet_balance > 10
ORDER BY 
    u.wallet_balance DESC;

-- Count of users with balance > 10
-- SELECT COUNT(*) as users_count 
-- FROM public.users 
-- WHERE wallet_balance > 10;

-- Summary by currency
-- SELECT 
--     currency_code,
--     COUNT(*) as user_count,
--     SUM(wallet_balance) as total_balance,
--     AVG(wallet_balance) as avg_balance
-- FROM public.users 
-- WHERE wallet_balance > 10
-- GROUP BY currency_code
-- ORDER BY user_count DESC;














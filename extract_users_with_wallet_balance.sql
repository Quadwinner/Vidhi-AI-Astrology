-- Query to extract users with wallet balance greater than zero
-- This query selects all users who have a positive wallet balance

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
    u.wallet_balance > 0
ORDER BY 
    u.wallet_balance DESC;

-- Summary statistics
-- Uncomment the queries below to get additional insights

-- Total count of users with positive balance
-- SELECT COUNT(*) as users_with_balance 
-- FROM public.users 
-- WHERE wallet_balance > 0;

-- Total wallet balance across all users
-- SELECT 
--     SUM(wallet_balance) as total_wallet_balance,
--     AVG(wallet_balance) as average_wallet_balance,
--     MIN(wallet_balance) as min_wallet_balance,
--     MAX(wallet_balance) as max_wallet_balance
-- FROM public.users 
-- WHERE wallet_balance > 0;

-- Group by currency
-- SELECT 
--     currency_code,
--     COUNT(*) as user_count,
--     SUM(wallet_balance) as total_balance,
--     AVG(wallet_balance) as avg_balance
-- FROM public.users 
-- WHERE wallet_balance > 0
-- GROUP BY currency_code
-- ORDER BY total_balance DESC;














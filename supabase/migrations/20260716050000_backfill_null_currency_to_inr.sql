-- Backfill: any account left with a NULL currency (created before geo-detection
-- was working) defaults to INR, the app's primary market. New signups continue
-- to get currency auto-detected by init-user-wallet.
UPDATE public.users
SET currency_code = 'INR'
WHERE currency_code IS NULL;

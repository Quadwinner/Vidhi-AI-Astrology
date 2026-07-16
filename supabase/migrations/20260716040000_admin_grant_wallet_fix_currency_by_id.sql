-- One-off admin fix for user q61023175@gmail.com
-- (public.users.email is null for OAuth users, so target by auth id).
--   auth id: 647c92d4-f177-4b99-9081-ef462f60593c
--   1) Set currency to INR (was null -> app defaulted to USD)
--   2) Add 1000 to the spendable wallet balance (stored in minor units: +100000 = +1000.00)
UPDATE public.users
SET currency_code = 'INR',
    wallet_balance = COALESCE(wallet_balance, 0) + 100000
WHERE id = '647c92d4-f177-4b99-9081-ef462f60593c';

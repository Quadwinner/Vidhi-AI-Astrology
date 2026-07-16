-- One-off admin operation:
--   1) Grant 1000 coins to q61023175@gmail.com
--   2) Correct their currency to INR (India)
-- Safe / idempotent-friendly: no-op if the user row does not exist.

-- 1) Add 1000 coins to the user's balance
UPDATE public.users
SET coin_balance = COALESCE(coin_balance, 0) + 1000
WHERE lower(email) = lower('q61023175@gmail.com');

-- 2) Fix currency for the India-based user
UPDATE public.users
SET currency_code = 'INR'
WHERE lower(email) = lower('q61023175@gmail.com');

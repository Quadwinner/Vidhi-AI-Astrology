-- Add coins_granted_on_subscription column to plan_entitlements table
-- This field stores the number of coins to credit when a user subscribes to a plan

-- Add the column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'plan_entitlements' 
    AND column_name = 'coins_granted_on_subscription'
  ) THEN
    ALTER TABLE public.plan_entitlements
    ADD COLUMN coins_granted_on_subscription INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Update existing records with default values
-- Monthly plan: 100 coins
UPDATE public.plan_entitlements
SET coins_granted_on_subscription = 100
WHERE plan_id = 'monthly' AND (coins_granted_on_subscription IS NULL OR coins_granted_on_subscription = 0);

-- Yearly plan: 2500 coins
UPDATE public.plan_entitlements
SET coins_granted_on_subscription = 2500
WHERE plan_id = 'yearly' AND (coins_granted_on_subscription IS NULL OR coins_granted_on_subscription = 0);

-- Free plan: 0 coins (already default)
UPDATE public.plan_entitlements
SET coins_granted_on_subscription = 0
WHERE plan_id = 'free' AND (coins_granted_on_subscription IS NULL OR coins_granted_on_subscription = 0);


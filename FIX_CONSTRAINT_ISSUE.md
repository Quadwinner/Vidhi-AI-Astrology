# Fix Database Constraint Issue

## Problem
Your `prices` table has a NOT NULL constraint on `gateway_price_id` column, which prevents us from clearing invalid plan IDs.

## Solution Options

### Option 1: Remove NOT NULL Constraint (Recommended)
Run this in your Supabase SQL editor:

```sql
-- Remove NOT NULL constraint from gateway_price_id
ALTER TABLE prices ALTER COLUMN gateway_price_id DROP NOT NULL;

-- Now you can safely clear invalid IDs
UPDATE prices SET gateway_price_id = NULL WHERE currency = 'inr';
UPDATE users SET gateway_customer_id = NULL;

-- Verify the changes
SELECT id, amount, currency, gateway_price_id FROM prices WHERE currency = 'inr';
```

### Option 2: Update Invalid Plan IDs with Placeholder
If you can't modify constraints, run this:

```sql
-- Replace invalid plan IDs with a placeholder that will trigger recreation
UPDATE prices
SET gateway_price_id = 'RECREATE_PLAN'
WHERE currency = 'inr'
AND (gateway_price_id IS NULL OR gateway_price_id NOT LIKE 'plan_%' OR gateway_price_id = 'plan_RFB4CtwRT9PtbV');

-- Clear all customer IDs to force recreation
UPDATE users SET gateway_customer_id = NULL WHERE gateway_customer_id IS NOT NULL;

-- Verify the changes
SELECT id, amount, currency, gateway_price_id FROM prices WHERE currency = 'inr';
```

### Option 3: Manual Plan Recreation
Create new plans manually with correct names:

```sql
-- Update with new placeholder values that the system will replace
UPDATE prices SET gateway_price_id = 'NEEDS_CREATION_MONTHLY' WHERE id = 1; -- Monthly plan
UPDATE prices SET gateway_price_id = 'NEEDS_CREATION_YEARLY' WHERE id = 5;  -- Yearly plan
```

## Deploy Updated Function

After running any of the above SQL, deploy the updated function:

```bash
supabase functions deploy create-payment-session
```

## What the Updated Function Does

The enhanced function now:
1. **Checks if plan ID is valid** (starts with 'plan_')
2. **Verifies plan exists** in Razorpay by calling the API
3. **Creates new plan** if the old one doesn't exist
4. **Updates database** with the new valid plan ID

## Test the Fix

1. Run your chosen SQL option above
2. Deploy the function
3. Try the subscription flow - click "Begin Journey"
4. Check logs in Supabase → Edge Functions → Logs

You should see logs like:
```
Verifying existing plan: plan_RFB4CtwRT9PtbV
Plan does not exist in Razorpay, creating new one
Created Razorpay plan with ID: plan_XXXXXXXXXXXXX
```

## Recommended Approach

**Use Option 1** (remove constraint) as it's the cleanest solution. The constraint seems unnecessary since the system can handle NULL values and auto-create plans as needed.

Run Option 1 first, and if that doesn't work due to permissions, try Option 2.
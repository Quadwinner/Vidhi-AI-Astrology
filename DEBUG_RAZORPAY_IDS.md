# Debug Razorpay "ID Does Not Exist" Error

## Issue
Error: `Razorpay API Error: The id provided does not exist`

## Possible Causes & Solutions

### 1. **Invalid Plan ID**
The most common cause is that the `plan_id` being sent to Razorpay doesn't exist.

**Check your Supabase `prices` table:**
```sql
SELECT id, amount, currency, gateway_price_id, subscription_plans(name, interval)
FROM prices
WHERE currency = 'inr';
```

**Look for:**
- `gateway_price_id` column should contain valid Razorpay plan IDs (format: `plan_xxxxxxxxxxxxx`)
- If `gateway_price_id` is NULL or empty, plans will be auto-created

### 2. **Invalid Customer ID**
The `customer_id` might be invalid or from a different Razorpay account.

**Check your Supabase `users` table:**
```sql
SELECT id, email, gateway_customer_id
FROM users
WHERE gateway_customer_id IS NOT NULL;
```

**Look for:**
- `gateway_customer_id` should be in format: `cust_xxxxxxxxxxxxx`
- Make sure these customer IDs exist in your Razorpay dashboard

### 3. **Wrong Razorpay Account**
You might be using test keys with live plan IDs or vice versa.

**Verify:**
- Test keys start with `rzp_test_`
- Live keys start with `rzp_live_`
- Make sure your plans were created in the same environment (test/live)

## Debugging Steps

### Step 1: Check Environment Variables
In your Supabase dashboard, verify these environment variables:
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx (or rzp_live_xxxxxxxxxx)
RAZORPAY_KEY_SECRET=your_key_secret
```

### Step 2: Deploy Enhanced Logging
Deploy the updated function with enhanced logging:
```bash
supabase functions deploy create-payment-session
```

### Step 3: Check Supabase Logs
1. Go to Supabase Dashboard → Edge Functions → Logs
2. Look for these specific logs:
   - `Creating new Razorpay plan for price:`
   - `Plan body for Razorpay:`
   - `Creating Razorpay subscription with options:`
   - `[FATAL] Razorpay API Error Creating Subscription:`

### Step 4: Manual Verification

#### Check Plans in Razorpay Dashboard
1. Login to your Razorpay Dashboard
2. Go to Subscriptions → Plans
3. Verify the plan IDs match what's in your database

#### Test with Razorpay API Directly
```bash
# Replace with your actual key
curl -X GET https://api.razorpay.com/v1/plans \
  -u rzp_test_xxxxxxxxxx:your_secret_key
```

### Step 5: Common Fixes

#### Fix 1: Clear Invalid Gateway IDs
If you have invalid `gateway_price_id` values:
```sql
UPDATE prices
SET gateway_price_id = NULL
WHERE gateway_price_id IS NOT NULL
AND gateway_price_id NOT LIKE 'plan_%';
```

#### Fix 2: Clear Invalid Customer IDs
If you have invalid `gateway_customer_id` values:
```sql
UPDATE users
SET gateway_customer_id = NULL
WHERE gateway_customer_id IS NOT NULL
AND gateway_customer_id NOT LIKE 'cust_%';
```

#### Fix 3: Force Plan Recreation
To force new plan creation:
```sql
UPDATE prices SET gateway_price_id = NULL WHERE currency = 'inr';
```

## Expected Log Output (Success)

When working correctly, you should see logs like:
```
Create payment session request: { price_id: "1", user_id: "user-uuid" }
Creating new Razorpay plan for price: { id: 1, amount: 99900, currency: "inr" }
Plan body for Razorpay: { period: "monthly", interval: 1, item: {...} }
Razorpay plan creation response: { id: "plan_xxxxxxxxxx", ... }
Created Razorpay plan with ID: plan_xxxxxxxxxx
Creating Razorpay subscription with options: { plan_id: "plan_xxxxxxxxxx", customer_id: "cust_xxxxxxxxxx" }
```

## Expected Log Output (Error)

When there's an error, you'll see:
```
[FATAL] Razorpay API Error Creating Subscription: {
  status: 400,
  error: { description: "The id provided does not exist" },
  plan_id: "plan_xxxxxxxxxx",
  customer_id: "cust_xxxxxxxxxx"
}
```

## Quick Test

Try this test to narrow down the issue:

1. **Clear all gateway IDs** (force recreation):
   ```sql
   UPDATE prices SET gateway_price_id = NULL WHERE currency = 'inr';
   UPDATE users SET gateway_customer_id = NULL;
   ```

2. **Test subscription** with a fresh user account

3. **Check the logs** to see exactly which step fails

## Next Steps

After deploying the enhanced logging:
1. Try the subscription flow again
2. Check the Supabase Edge Function logs
3. Share the specific log output to identify the exact issue

The enhanced logging will show you exactly which ID is invalid and help pinpoint whether it's a plan ID, customer ID, or environment mismatch issue.
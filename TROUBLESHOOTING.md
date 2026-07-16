# Troubleshooting: Edge Function Non-2xx Status Code Error

## Common Causes and Solutions

### 1. **Missing Environment Variables**
The most common cause is missing or incorrectly named environment variables in Supabase.

**Check these in Supabase Dashboard → Settings → Edge Functions → Secrets:**
```
SUPABASE_URL or APP_SUPABASE_URL
SUPABASE_ANON_KEY or APP_SUPABASE_ANON_KEY  
SUPABASE_SERVICE_ROLE_KEY or APP_SUPABASE_SERVICE_ROLE_KEY
APP_SITE_URL
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
```

### 2. **Authentication Issues**
Make sure the user is properly authenticated when calling the function.

**Frontend Fix:**
```typescript
// Make sure user is logged in before calling
const { data, error } = await supabase.functions.invoke('create-customer-portal-session');
```

### 3. **Database Issues**
Check if the user exists in the `users` table and has the required fields.

**Required Database Columns:**
- `users.gateway_customer_id`
- `users.coin_balance`
- `users_subscriptions.status`
- `users_subscriptions.management_url`

### 4. **CORS Issues**
Edge functions need proper CORS headers.

**Check `_shared/cors.ts` exists:**
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

## Debugging Steps

### Step 1: Check Supabase Function Logs
1. Go to Supabase Dashboard → Edge Functions
2. Click on the function that's failing
3. Check the "Invocations" tab for error logs

### Step 2: Test with Simple Function
Deploy the debug-test function and call it to see if basic functionality works:

```bash
# Test the debug function
curl -X POST https://your-project-ref.supabase.co/functions/v1/debug-test \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Step 3: Check Frontend Network Tab
1. Open browser Developer Tools
2. Go to Network tab
3. Try the failing operation
4. Look at the failed request for exact error message

### Step 4: Verify Environment Variables
Make sure all required environment variables are set in Supabase:

```bash
# These should all be set in Supabase Dashboard
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_SITE_URL=https://your-frontend-domain.com
RAZORPAY_KEY_ID=rzp_test_RIdOOohLUUFJhr
RAZORPAY_KEY_SECRET=yKfmYVMY9NTrxW9sNj4N4VO2
```

## Quick Fixes

### Fix 1: Update Frontend Error Handling
```typescript
const handleOpenPortal = async () => {
  try {
    const { data, error } = await supabase.functions.invoke('create-customer-portal-session');
    
    if (error) {
      console.error('Supabase function error:', error);
      throw new Error(error.message || 'Failed to create portal session');
    }
    
    if (!data?.url) {
      throw new Error('Portal URL missing from response');
    }
    
    window.location.href = data.url;
  } catch (e: any) {
    console.error('Portal error:', e);
    setError(e.message || 'Failed to open portal');
  }
};
```

### Fix 2: Check User Authentication
```typescript
// Add this before calling functions
if (!user) {
  setError('Please log in to manage your subscription');
  return;
}
```

### Fix 3: Add Better Error Logging
Add this to your Edge Functions for better debugging:

```typescript
console.log('Function called with:', {
  method: req.method,
  url: req.url,
  headers: Object.fromEntries(req.headers.entries()),
  userId: user?.id
});
```

## Most Likely Solution

Based on the error, the most common issue is **missing environment variables**. 

**Action Items:**
1. ✅ Go to Supabase Dashboard
2. ✅ Navigate to Settings → Edge Functions → Secrets
3. ✅ Add all required environment variables listed above
4. ✅ Redeploy your Edge Functions
5. ✅ Test the functionality again

If the issue persists, check the Supabase function logs for the specific error message.
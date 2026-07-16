# Counter System Fix - Deployment Complete ✓

## What Was Fixed

### Critical Issues Identified:
1. **RLS Policy Gap** - `user_plan_counters` table had RLS enabled but no policy allowing `SECURITY DEFINER` trigger functions to write
2. **Trigger Logic Bug** - Call logs trigger could fire multiple times on same call
3. **Silent RPC Failures** - Edge Functions weren't checking/logging RPC errors
4. **Cycle Boundary Drift** - Dashboard might compute cycle boundaries differently than write path

### Fixes Applied:
- ✅ Added RLS policy allowing authenticated role to write counters
- ✅ Fixed trigger to only fire when `ended_at` changes NULL → timestamp
- ✅ Added comprehensive logging (RAISE NOTICE) to all DB functions
- ✅ Added error handling to Edge Functions
- ✅ Created `get_current_cycle_counters()` helper for dashboard

---

## Deployment Status

### ✅ Database Migrations Applied
All migrations are up to date in remote database:
- `20251028120000_add_plan_entitlements.sql`
- `20251028120500_add_user_plan_counters.sql`
- `20251028121000_add_counter_helpers.sql`
- `20251028121500_add_normalized_counter_rpc.sql`
- `20251028122000_add_counter_triggers.sql`
- `20251028123000_fix_counter_rls_and_triggers.sql` ⭐ **THE FIX**
- `20251028123500_add_dashboard_counter_view.sql`

### ✅ Edge Functions Deployed
- `get-chat-answer` - Updated with RPC error logging
- `end-call` - Updated with RPC error logging

---

## Testing & Verification

### Step 1: Run Diagnostics

Open Supabase Dashboard → SQL Editor → Run [check-counter-status.sql](check-counter-status.sql)

This will show:
- ✓ Triggers installed (should see 2)
- ✓ RLS policies (should see 3+ including "Service role full access")
- ✓ Functions exist with SECURITY DEFINER
- Current counter values
- Recent chat/call activity

### Step 2: Test with Real Activity

#### Test Question Counter:
1. Go to your app
2. Ask a question as user: `shubhamkush0123@gmail.com`
3. Wait for full assistant response
4. Check counter:
```sql
SELECT * FROM public.user_plan_counters
WHERE user_id = (SELECT id FROM users WHERE email = 'shubhamkush0123@gmail.com')
  AND cycle_start = date_trunc('month', current_date)::date;
```
Expected: `questions_used` should increment by 1

#### Test Call Minutes Counter:
1. Start and complete a call
2. End the call (must set `ended_at`)
3. Check counter (same query as above)
Expected: `talk_minutes_used` should increment by `CEIL(duration_seconds/60)` with minimum 1

### Step 3: Check Logs

**Database Logs** (Supabase Dashboard → Logs → Postgres):
Look for:
```
[COUNTER] user=... plan=... kind=questions inc=1 cycle=...
[COUNTER] Questions now: 1
[TRIGGER] Incrementing questions for user ...
```

**Edge Function Logs**:
```bash
npx supabase functions logs get-chat-answer
npx supabase functions logs end-call
```
Look for:
```
[get-chat-answer] Question counter incremented successfully
[end-call] Talk minutes incremented successfully
```

---

## If Counters Still Don't Increment

### Diagnostic Checklist:

1. **Verify triggers are firing**:
```sql
-- This should return 2 rows
SELECT t.tgname, c.relname, t.tgenabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE t.tgname IN ('inc_questions_on_chat', 'inc_minutes_on_call_end');
```

2. **Check RLS policies**:
```sql
-- Should include "Service role full access" policy
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE tablename = 'user_plan_counters';
```

3. **Test manual increment**:
```sql
-- Replace with real user_id
SELECT public.upsert_increment_counter_normalized(
  'USER_UUID_HERE'::uuid,
  'free',
  NULL,
  'questions',
  1
);

-- Check if it worked
SELECT * FROM public.user_plan_counters
WHERE user_id = 'USER_UUID_HERE'::uuid;
```

4. **Check if chat_history inserts have role='assistant'**:
```sql
SELECT role, COUNT(*)
FROM public.chat_history
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY role;
```
Should show both 'user' and 'assistant' rows

5. **Check if call_logs updates set ended_at**:
```sql
SELECT
  COUNT(*) FILTER (WHERE ended_at IS NULL) as active_calls,
  COUNT(*) FILTER (WHERE ended_at IS NOT NULL) as completed_calls
FROM public.call_logs
WHERE started_at >= NOW() - INTERVAL '24 hours';
```

---

## Dashboard Integration

To use the new helper function in your dashboard:

```typescript
// Instead of manual cycle calculation, call this:
const { data, error } = await supabase
  .rpc('get_current_cycle_counters', { p_user_id: userId });

// Returns:
// {
//   questions_used: 5,
//   talk_minutes_used: 12,
//   cycle_start: '2025-10-01',
//   cycle_end: '2025-11-01',
//   questions_remaining: 95,      // pre-computed!
//   talk_minutes_remaining: 88,   // pre-computed!
//   plan_tier: 'free',
//   questions_per_month: 100,
//   ai_call_talk_minutes: 100
// }
```

This ensures dashboard uses **exact same cycle logic** as increment functions.

---

## Root Cause Summary

The counters weren't incrementing because:
1. **RLS was blocking trigger writes** - The `SECURITY DEFINER` functions couldn't insert/update `user_plan_counters` due to missing RLS policy
2. **Triggers might double-count** - Call trigger didn't check if `OLD.ended_at` was NULL
3. **Errors were silent** - No logging made debugging impossible

**The fix** adds the missing RLS policy and comprehensive logging throughout the stack.

---

## Files Modified

### Database Migrations:
- [supabase/migrations/20251028123000_fix_counter_rls_and_triggers.sql](supabase/migrations/20251028123000_fix_counter_rls_and_triggers.sql) - Main fix
- [supabase/migrations/20251028123500_add_dashboard_counter_view.sql](supabase/migrations/20251028123500_add_dashboard_counter_view.sql) - Helper function

### Edge Functions:
- [supabase/functions/get-chat-answer/index.ts](supabase/functions/get-chat-answer/index.ts) - Lines 342-355 (added error logging)
- [supabase/functions/end-call/index.ts](supabase/functions/end-call/index.ts) - Lines 158-171 (added error logging)

### Diagnostic Tools:
- [check-counter-status.sql](check-counter-status.sql) - Run this to verify system state
- [deploy-counter-fixes.sh](deploy-counter-fixes.sh) - Automated deployment script

---

## Next Steps

1. ✅ Migrations applied
2. ✅ Functions deployed
3. ⏳ Run [check-counter-status.sql](check-counter-status.sql) in Supabase SQL Editor
4. ⏳ Test with real question/call
5. ⏳ Verify counters increment
6. ⏳ Update dashboard to use `get_current_cycle_counters()` function

## Support

If issues persist after testing:
- Share output of [check-counter-status.sql](check-counter-status.sql)
- Share logs from Edge Functions
- Share database logs (NOTICE/WARNING messages)

The logging is now comprehensive enough to pinpoint exactly where the flow breaks.

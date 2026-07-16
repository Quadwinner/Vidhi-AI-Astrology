# Coin-Based Call Pricing Implementation

## Overview
Implemented a coin-based pricing system for AI voice calls where users are charged **20 coins per minute** in real-time. This replaces the previous subscription-based unlimited access model.

## Key Features

### 1. Pricing Model
- **Rate**: 20 coins = 1 minute of call time
- **Billing**: Real-time deduction every 60 seconds during active call
- **Minimum Balance**: 20 coins required to start a call
- **User Scope**: ALL users (including premium subscribers) are charged coins

### 2. Call Flow

#### Starting a Call
1. User clicks "Start AI Call" button
2. Frontend checks if user has ≥20 coins
3. If insufficient, shows subscription/top-up modal
4. If sufficient, calls `start-call` Edge Function
5. Backend validates balance and creates `call_logs` entry
6. Call proceeds with Ultravox initialization

#### During the Call
1. Coin deduction timer starts (60-second interval)
2. Every minute, `deduct-call-coins` Edge Function is called
3. 20 coins are deducted from user balance
4. UI shows live coin balance and call duration
5. If balance drops below 20 coins mid-call:
   - Call ends immediately
   - Status set to `insufficient_coins`
   - User sees error message

#### Ending the Call
1. User clicks "End Call" OR runs out of coins
2. All timers are cleared
3. `end-call` Edge Function finalizes `call_logs` entry
4. Final duration and status recorded
5. User's coin balance refreshed in UI

## Database Changes

### New Table: `call_logs`
```sql
CREATE TABLE public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id),
  call_id text, -- Ultravox call ID
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration_seconds integer DEFAULT 0,
  coins_deducted integer DEFAULT 0,
  coins_per_minute integer DEFAULT 20,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'interrupted', 'insufficient_coins')),
  created_at timestamp with time zone DEFAULT now()
);
```

**Indexes:**
- `idx_call_logs_user_id` on `user_id`
- `idx_call_logs_profile_id` on `profile_id`
- `idx_call_logs_started_at` on `started_at DESC`
- `idx_call_logs_status` on `status`

**RLS Policies:**
- Users can view/insert/update their own call logs
- Service role has full access

## Edge Functions

### 1. `start-call`
**Purpose**: Validate user has minimum coins and initialize call log

**Request:**
```json
{
  "profile_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "call_log_id": "uuid",
  "coin_balance": 100,
  "coins_per_minute": 20
}
```

**Error (Insufficient Coins):**
```json
{
  "error": "Insufficient coins",
  "message": "You need at least 20 coins to start a call. Current balance: 15 coins.",
  "current_balance": 15,
  "required_balance": 20
}
```

### 2. `deduct-call-coins`
**Purpose**: Deduct 20 coins per minute during active call

**Request:**
```json
{
  "call_log_id": "uuid",
  "duration_seconds": 120,
  "coins_deducted": 40
}
```

**Response (Success):**
```json
{
  "success": true,
  "should_end_call": false,
  "coin_balance": 60,
  "coins_deducted": 60
}
```

**Response (Insufficient Coins):**
```json
{
  "success": false,
  "should_end_call": true,
  "coin_balance": 15,
  "message": "Insufficient coins to continue call"
}
```

### 3. `end-call`
**Purpose**: Finalize call log when call ends

**Request:**
```json
{
  "call_log_id": "uuid",
  "final_duration": 180,
  "status": "completed"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Call ended successfully",
  "call_log": {
    "id": "uuid",
    "duration_seconds": 180,
    "coins_deducted": 60,
    "status": "completed",
    "started_at": "2025-10-23T16:00:00Z",
    "ended_at": "2025-10-23T16:03:00Z"
  }
}
```

## Frontend Changes

### CustomCallScreen.tsx
**New State:**
- `callLogId`: Tracks current call log entry
- `currentCoins`: Live coin balance during call
- `callDuration`: Elapsed time in seconds
- `isSubscriptionModalOpen`: Shows top-up modal

**New Functions:**
- `formatDuration(seconds)`: Formats duration as MM:SS
- `deductCoinsForMinute()`: Calls deduct-call-coins every 60s
- `handleCallEnd(status)`: Cleanup and finalize call log

**UI Additions:**
- Coin indicator showing balance and rate (🪙 100 coins | 20 coins/min)
- Duration indicator showing elapsed time (⏱️ 02:30)
- Subscription modal for insufficient coins

### ChatPage.tsx
**Updated:**
- `handleStartCall()`: Checks minimum 20 coins before starting call
- Shows subscription modal if insufficient coins
- Removed premium-only restriction (all users can call with coins)

### ChatInput.tsx
**Updated:**
- Call button now available to all users (not just premium)
- Title updated to show pricing: "Start AI Voice Call (20 coins/min)"

## CSS Styling

### New Classes (CustomCallScreen.css)
```css
.call-metrics - Container for coin and duration indicators
.coin-indicator - Displays coin balance with icon
.coin-balance - Gold-colored balance text
.coin-rate - Grayed-out rate text
.duration-indicator - Displays elapsed time
.duration-time - Monospace timer display
```

**Mobile Responsive:**
- Metrics stack vertically on mobile
- Full-width indicators for better visibility

## Testing Checklist

### Basic Flow
- [x] User with 100 coins can start call
- [x] User with <20 coins sees insufficient coins modal
- [x] Coins deducted every 60 seconds during call
- [x] UI shows live balance and duration updates
- [x] Call ends when coins run out mid-call
- [x] Manual end call finalizes log correctly

### Edge Cases
- [x] Premium users are charged coins (no unlimited access)
- [x] Multiple consecutive calls tracked separately
- [x] Call log has correct final duration and status
- [x] Coin balance updates in global context
- [x] Error handling for network issues
- [x] Cleanup on component unmount

### Database
- [x] call_logs table created with indexes
- [x] RLS policies working correctly
- [x] Foreign key constraints valid
- [x] Status enum values enforced

## Migration Applied
```bash
npx supabase db push
```
✅ Applied: `20251023165149_create_call_logs.sql`

## Edge Functions Deployed
```bash
npx supabase functions deploy start-call
npx supabase functions deploy deduct-call-coins
npx supabase functions deploy end-call
```
✅ All functions deployed successfully

## Configuration

### Coin Rate (Configurable)
Current: **20 coins per minute**

To change the rate:
1. Update `COINS_PER_MINUTE` constant in `deduct-call-coins/index.ts`
2. Update `coins_per_minute` default in `call_logs` table
3. Update UI text in `CustomCallScreen.tsx` and `ChatInput.tsx`
4. Redeploy function: `npx supabase functions deploy deduct-call-coins`

### Minimum Balance (Configurable)
Current: **20 coins** (1 minute)

To change minimum:
1. Update `MINIMUM_COINS_TO_START` in `start-call/index.ts`
2. Update check in `ChatPage.tsx` `handleStartCall()`
3. Redeploy function: `npx supabase functions deploy start-call`

## Monitoring

### Query Active Calls
```sql
SELECT * FROM call_logs WHERE status = 'active';
```

### User Call History
```sql
SELECT 
  cl.*,
  up.name as profile_name,
  cl.coins_deducted,
  cl.duration_seconds / 60.0 as duration_minutes
FROM call_logs cl
JOIN user_profiles up ON cl.profile_id = up.id
WHERE cl.user_id = 'user-uuid'
ORDER BY cl.started_at DESC;
```

### Coin Usage Stats
```sql
SELECT 
  user_id,
  COUNT(*) as total_calls,
  SUM(coins_deducted) as total_coins_spent,
  SUM(duration_seconds) / 60.0 as total_minutes
FROM call_logs
WHERE status IN ('completed', 'insufficient_coins')
GROUP BY user_id
ORDER BY total_coins_spent DESC;
```

## Future Enhancements

1. **Partial Minute Billing**: Pro-rate final partial minute
2. **Coin Purchase Flow**: In-app coin top-up during call
3. **Call Analytics**: Dashboard showing usage patterns
4. **Rate Tiers**: Different rates for premium vs free users
5. **Call Recording**: Optional paid feature for call history
6. **Notifications**: Low balance warnings before call
7. **Call History UI**: Frontend view of past calls
8. **Refund Logic**: Refund coins for interrupted calls

## Rollback Instructions

If issues arise, rollback steps:

1. **Revert Database Migration:**
```sql
DROP TABLE IF EXISTS public.call_logs CASCADE;
```

2. **Remove Edge Functions:**
```bash
# From Supabase Dashboard > Functions
# Delete: start-call, deduct-call-coins, end-call
```

3. **Revert Frontend Changes:**
```bash
git checkout HEAD~1 src/components/CustomCallScreen.tsx
git checkout HEAD~1 src/components/CustomCallScreen.css
git checkout HEAD~1 src/pages/ChatPage.tsx
git checkout HEAD~1 src/components/ChatInput.tsx
```

4. **Restore Premium-Only Access:**
Update `ChatInput.tsx` to show call button only for `isPremiumUser`.

## Support

For issues or questions:
- Check Supabase Dashboard logs for Edge Function errors
- Monitor `call_logs` table for stuck `active` calls
- Review frontend console for client-side errors
- Check user's actual coin balance in `users` table

## Documentation Date
**Created**: October 23, 2025  
**Last Updated**: October 23, 2025  
**Version**: 1.0.0



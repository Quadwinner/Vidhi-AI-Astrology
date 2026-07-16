# CleverTap Sync - Setup & Deployment Guide

## 🎉 Implementation Complete!

All components for CleverTap user data sync have been created. Follow this guide to deploy and test.

---

## 📦 What Was Created

### 1. Database Components
- ✅ **SQL Aggregation Function**: `get_user_clevertap_data(user_id UUID)`
  - File: `supabase/migrations/20251217000000_create_clevertap_aggregation_function.sql`
  - Aggregates all user data including call stats, chat categories, payment info, usage metrics

- ✅ **Sync Logs Table**: `clevertap_sync_logs`
  - File: `supabase/migrations/20251217000001_create_clevertap_sync_logs.sql`
  - Tracks sync history and status

### 2. Edge Functions
- ✅ **Single User Sync**: `sync-user-to-clevertap`
  - File: `supabase/functions/sync-user-to-clevertap/index.ts`
  - Syncs individual user to CleverTap

- ✅ **Batch Sync**: `batch-sync-users-to-clevertap`
  - File: `supabase/functions/batch-sync-users-to-clevertap/index.ts`
  - Syncs multiple users by segment (all, premium, push-enabled, active)

### 3. Admin UI
- ✅ **CleverTap Sync Manager**: New admin panel tab
  - File: `src/components/admin/CleverTapSyncManager.tsx`
  - Component added to: `src/pages/AdminPage.tsx`
  - Features: Single user sync, batch sync, sync history, user stats

---

## 🔧 Deployment Steps

### Step 1: Run Database Migrations

```bash
cd "/media/OS/for linux work/Aura_Ai_backend-main"

# Apply migrations
supabase db push
```

This will create:
- `get_user_clevertap_data()` function
- `clevertap_sync_logs` table

### Step 2: Configure Environment Variables

Add these secrets to Supabase Dashboard → Settings → Edge Functions → Secrets:

```bash
# CleverTap Credentials
CLEVERTAP_ACCOUNT_ID=4W9-979-K67Z
CLEVERTAP_PASSCODE=your-passcode-here
CLEVERTAP_REGION=eu1
```

**Where to find your CleverTap Passcode:**
1. Login to CleverTap Dashboard
2. Go to Settings → Passcode
3. Copy your Project Passcode

### Step 3: Deploy Edge Functions

```bash
# Deploy single user sync
supabase functions deploy sync-user-to-clevertap --no-verify-jwt

# Deploy batch sync
supabase functions deploy batch-sync-users-to-clevertap --no-verify-jwt
```

### Step 4: Test Deployment

#### Test SQL Function
```sql
-- In Supabase SQL Editor
SELECT get_user_clevertap_data('your-user-id-here');
```

Expected output: JSON object with all user properties

#### Test Single User Sync (via curl)
```bash
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/sync-user-to-clevertap' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{"user_id": "your-user-id-here"}'
```

Expected output:
```json
{
  "success": true,
  "message": "User synced to CleverTap successfully",
  "user_id": "...",
  "synced_properties": 45
}
```

---

## 🎯 User Properties Synced to CleverTap

### Identity & Account
- Email
- Identity (User ID)
- Plan Tier (free/monthly/yearly)
- Subscription Status
- Subscription Start/End Dates
- Coin Balance
- Is Admin

### User Details
- Profile Count
- Gender
- Age
- Has Created Profile
- Has Made Call
- Has Sent Message

### Call Stats
- Total Calls
- Total Call Duration (minutes)
- Average Call Duration (minutes)
- Last Call Date
- Last Call Duration (minutes)
- Average Call Rating
- Total Call Feedbacks
- Last Call Rating

### Chat Stats
- Total Messages
- Last Message Date
- Preferred Language
- Most Asked Category

### Category Breakdown
- Love Questions Count
- Marriage Questions Count
- Career Questions Count
- Health Questions Count
- Money Questions Count
- Spiritual Questions Count

### Payment Stats
- Last Payment Date
- Last Payment Amount
- Payment Currency
- Payment Gateway (Stripe/Razorpay)
- Total Amount Spent

### Usage (Current Cycle)
- Questions Used This Month
- Talk Minutes Used This Month
- Questions Remaining
- Talk Minutes Remaining
- Cycle End Date

### Notification Preferences
- Push Notifications Enabled
- Daily Horoscope Enabled
- Weekly Forecast Enabled
- Promotional Enabled

### Timestamps
- Account Created
- Last Updated

**Total: ~45 user properties**

---

## 🖥️ Using the Admin UI

### Access CleverTap Sync Manager

1. Login as admin
2. Navigate to `/admin`
3. Click **🔄 CleverTap Sync** tab

### Features

#### Stats Dashboard
- Total Users
- Premium Users
- Push-Enabled Users
- Active Users (last 30 days)

#### Sync Single User
1. Enter User ID
2. Click "Sync User"
3. View result in toast notification

#### Batch Sync Users
1. Select segment:
   - Premium Users (monthly/yearly)
   - Push-Enabled Users
   - Active Users (30 days)
   - All Users

2. Set batch limit (max 1000)
3. Click "Sync [segment] Users"
4. Monitor progress in toast

#### Recent Syncs
- View last 10 syncs
- Status (success/failed)
- Properties synced count
- Timestamp

---

## 📊 CleverTap Dashboard Setup

### 1. Verify User Profiles

After syncing, check CleverTap Dashboard:

1. Go to **Engage** → **Segments**
2. Create test segment:
   - Name: "Premium Users"
   - Condition: `Plan Tier` equals `monthly` OR `yearly`

3. View users in segment

### 2. Create User Segments

Example segments you can create:

**High-Value Users:**
- `Total Amount Spent` > 500
- `Plan Tier` = "yearly"

**Engaged Users:**
- `Total Messages` > 50
- `Last Message Date` within last 7 days

**Category-Based:**
- `Most Asked Category` = "Love"
- `Love Questions Count` > 10

**At-Risk Users:**
- `Last Message Date` older than 30 days
- `Plan Tier` ≠ "free"
- `Push Notifications Enabled` = false

**Call Enthusiasts:**
- `Total Calls` > 5
- `Avg Call Rating` > 4

### 3. Create Targeted Campaigns

Use segments for personalized campaigns:

**Example 1: Re-engage Inactive Premium Users**
- Segment: Premium users, last message > 30 days
- Message: "We miss you! Your personalized insights await 💫"

**Example 2: Upsell Free Users**
- Segment: Free tier, total messages > 20
- Message: "Unlock unlimited questions! Upgrade to Premium"

**Example 3: Category-Specific**
- Segment: Love Questions > 10
- Message: "New love compatibility feature available! ❤️"

---

## 🔄 Automatic Sync (Optional)

To auto-sync users on specific events, add database triggers:

### Trigger: Sync on Subscription Change

```sql
CREATE OR REPLACE FUNCTION trigger_sync_to_clevertap()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Function to sync user
  PERFORM net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/sync-user-to-clevertap',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := json_build_object('user_id', NEW.user_id)::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on subscription update
CREATE TRIGGER trg_sync_on_subscription_change
AFTER INSERT OR UPDATE ON public.users_subscriptions
FOR EACH ROW
EXECUTE FUNCTION trigger_sync_to_clevertap();
```

**Note:** This requires `pg_net` extension enabled.

---

## 🧪 Testing Checklist

### Database Tests
- [ ] Run both migration files successfully
- [ ] Test `get_user_clevertap_data()` with real user ID
- [ ] Verify all user properties are returned
- [ ] Check `clevertap_sync_logs` table exists

### Edge Function Tests
- [ ] Deploy both functions without errors
- [ ] Test single user sync via admin UI
- [ ] Test batch sync with small limit (e.g., 5 users)
- [ ] Verify sync logs are created
- [ ] Check CleverTap dashboard for user profiles

### Admin UI Tests
- [ ] Navigate to CleverTap Sync tab
- [ ] Stats cards display correct numbers
- [ ] Single user sync works
- [ ] Batch sync works for each segment
- [ ] Recent syncs table updates
- [ ] Error handling works (invalid user ID)

### CleverTap Integration Tests
- [ ] User profiles appear in CleverTap dashboard
- [ ] All properties are synced correctly
- [ ] Create test segment based on properties
- [ ] Segment shows expected users
- [ ] Send test campaign to segment

---

## 🐛 Troubleshooting

### Issue: "CleverTap credentials not configured"

**Solution:**
1. Check Edge Function secrets are set:
   ```bash
   supabase secrets list
   ```
2. Ensure `CLEVERTAP_ACCOUNT_ID` and `CLEVERTAP_PASSCODE` exist
3. Redeploy functions after adding secrets

### Issue: "User data not found"

**Solution:**
1. Verify user ID exists in `users` table
2. Check user has at least one profile
3. Run SQL function directly to see error

### Issue: CleverTap API returns 401/403

**Solution:**
1. Verify Account ID and Passcode are correct
2. Check region is set correctly (eu1, in1, us1)
3. Test CleverTap API directly with curl

### Issue: Batch sync times out

**Solution:**
1. Reduce batch limit (start with 10-20 users)
2. Check Edge Function logs for errors
3. Verify all users have complete data

### Issue: Some properties not syncing

**Solution:**
1. Check if user has data for that property
2. Verify SQL function includes property
3. Check property name matches CleverTap format

---

## 📈 Best Practices

### Sync Frequency
- **Initial Setup**: Batch sync all users once
- **Regular Updates**: Sync premium users weekly
- **Real-time**: Auto-sync on subscription changes (via triggers)

### Data Quality
- Ensure all users have at least basic profile data
- Keep categories consistent in chat history
- Validate gender/age data from birth details

### Performance
- Batch sync during off-peak hours
- Use smaller batch sizes (100-200 users)
- Monitor sync logs for failures

### Privacy
- Sync only necessary user data
- Respect user notification preferences
- Follow GDPR/data protection guidelines

---

## 🎯 Next Steps

1. **Deploy all components** (migrations + functions)
2. **Configure CleverTap credentials**
3. **Test with single user**
4. **Batch sync premium users first**
5. **Verify in CleverTap dashboard**
6. **Create user segments**
7. **Launch targeted campaigns**

---

## 📞 Support

If you encounter issues:

1. Check Supabase Edge Function logs
2. Review `clevertap_sync_logs` table for errors
3. Test CleverTap API directly
4. Verify all environment variables

---

**Your CleverTap sync system is ready to deploy! 🚀**

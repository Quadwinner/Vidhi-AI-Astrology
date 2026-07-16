# CleverTap Data Sync Implementation Plan

## 🎯 User Requirements - Data to Track

### 1. **Call Feedback** (from `call_feedback` table)
- Average rating (1-5 stars)
- Total feedback count
- Last feedback rating
- Last feedback date

### 2. **Call Logs** (from `call_logs` table)
- Total call duration (all time, in minutes)
- Last call duration (in minutes)
- Last call date
- Total calls made
- Average call duration

### 3. **Chat History** (from `chat_history` table)
- Last message date
- Total messages sent
- Category tracking (Love, Marriage, Career, Health, Money, Spiritual)
- Sub-category tracking
- Preferred language

### 4. **Payment** (from `users_subscriptions` table)
- Subscription status (active/canceled/past_due/incomplete)
- Last payment amount
- Last payment date
- Total amount spent
- Gateway used (Stripe/Razorpay)

### 5. **Profile Usage** (from `user_plan_counters` table)
- Questions remaining this month
- Talk minutes remaining this month
- Questions used this month
- Talk minutes used this month
- Cycle end date

### 6. **User Profile** (from `user_birth_details` table)
- Gender
- Age (calculated from date_of_birth)
- Zodiac sign (calculated from date_of_birth)

### 7. **Preferred Language** (from `chat_history` table)
- Most used language (aggregate)
- Last language used

### 8. **Last Recharge** (from `users` table)
- Last coin balance update
- Current coin balance

---

## 📋 Implementation Steps

### **Phase 1: Create Category Tracking Table**
We need a table to track chat message categories and subcategories.

```sql
CREATE TABLE IF NOT EXISTS public.chat_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.chat_history(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT, -- Love, Marriage, Career, Health, Money, Spiritual
  sub_category TEXT, -- Specific topic within category
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_categories_user ON public.chat_categories(user_id);
CREATE INDEX idx_chat_categories_category ON public.chat_categories(category);
```

### **Phase 2: Create Data Aggregation Function**
SQL function to aggregate all user data for CleverTap sync.

**Function**: `get_user_clevertap_data(user_id UUID)`

Returns:
- All user properties
- Aggregated stats from all tables
- Calculated fields (age, zodiac, remaining quotas)

### **Phase 3: Create CleverTap Sync Edge Function**
**File**: `supabase/functions/sync-user-to-clevertap/index.ts`

**What it does**:
1. Call `get_user_clevertap_data()` to fetch all user data
2. Format data according to CleverTap Profile API spec
3. POST to CleverTap Profile API (https://eu1.api.clevertap.com/1/upload)
4. Return sync status

### **Phase 4: Create Batch Sync Function**
**File**: `supabase/functions/batch-sync-users-to-clevertap/index.ts`

**What it does**:
- Sync all users or specific segments
- Called manually from admin panel
- Shows progress and results

### **Phase 5: Add Admin UI for Sync**
Add to WebPushCampaignManager or create new "CleverTap Sync" tab:
- Manual sync button for single user
- Batch sync all users button
- View last sync status
- Sync history/logs

### **Phase 6: Automatic Sync Triggers**
Set up database triggers to auto-sync on:
- User signup
- Subscription change
- Profile creation
- Call completion
- Message sent (debounced - max once per hour)

---

## 🔧 Technical Implementation

### Step 1: SQL Function to Aggregate User Data

```sql
CREATE OR REPLACE FUNCTION public.get_user_clevertap_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_user RECORD;
  v_profile_count INT;
  v_call_stats RECORD;
  v_chat_stats RECORD;
  v_payment_stats RECORD;
  v_counters RECORD;
  v_birth_details RECORD;
  v_feedback_stats RECORD;
BEGIN
  -- Get user basic info
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

  -- Get profile count
  SELECT COUNT(*) INTO v_profile_count
  FROM public.user_profiles WHERE user_id = p_user_id;

  -- Get call stats
  SELECT
    COUNT(*) as total_calls,
    COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
    COALESCE(AVG(duration_seconds), 0) as avg_duration_seconds,
    MAX(started_at) as last_call_date,
    (SELECT duration_seconds FROM public.call_logs
     WHERE user_id = p_user_id
     ORDER BY started_at DESC LIMIT 1) as last_call_duration
  INTO v_call_stats
  FROM public.call_logs
  WHERE user_id = p_user_id AND status = 'completed';

  -- Get chat stats
  SELECT
    COUNT(*) FILTER (WHERE role = 'user') as total_messages,
    MAX(created_at) FILTER (WHERE role = 'user') as last_message_date,
    MODE() WITHIN GROUP (ORDER BY language) as preferred_language
  INTO v_chat_stats
  FROM public.chat_history
  WHERE user_id = p_user_id;

  -- Get payment stats
  SELECT
    status as subscription_status,
    current_period_end as subscription_end,
    (SELECT SUM(pr.amount)
     FROM public.users_subscriptions us2
     JOIN public.prices pr ON us2.price_id = pr.id
     WHERE us2.user_id = p_user_id) as total_spent
  INTO v_payment_stats
  FROM public.users_subscriptions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Get current cycle counters
  SELECT *
  INTO v_counters
  FROM public.user_plan_counters
  WHERE user_id = p_user_id
  ORDER BY cycle_start DESC
  LIMIT 1;

  -- Get birth details from first profile
  SELECT ubd.gender, ubd.date_of_birth
  INTO v_birth_details
  FROM public.user_birth_details ubd
  JOIN public.user_profiles up ON ubd.profile_id = up.id
  WHERE up.user_id = p_user_id
  LIMIT 1;

  -- Get call feedback stats
  SELECT
    AVG(rating) as avg_rating,
    COUNT(*) as total_feedbacks,
    MAX(created_at) as last_feedback_date
  INTO v_feedback_stats
  FROM public.call_feedback
  WHERE user_id = p_user_id;

  -- Build result JSON
  result := jsonb_build_object(
    'user_id', v_user.id,
    'email', v_user.email,
    'plan_tier', v_user.plan_tier,
    'subscription_status', v_user.subscription_status,
    'coin_balance', v_user.coin_balance,
    'profile_count', v_profile_count,

    -- Call stats
    'total_calls', COALESCE(v_call_stats.total_calls, 0),
    'total_call_duration_minutes', ROUND(COALESCE(v_call_stats.total_duration_seconds, 0)::NUMERIC / 60, 2),
    'avg_call_duration_minutes', ROUND(COALESCE(v_call_stats.avg_duration_seconds, 0)::NUMERIC / 60, 2),
    'last_call_date', v_call_stats.last_call_date,
    'last_call_duration_minutes', ROUND(COALESCE(v_call_stats.last_call_duration, 0)::NUMERIC / 60, 2),

    -- Chat stats
    'total_messages', COALESCE(v_chat_stats.total_messages, 0),
    'last_message_date', v_chat_stats.last_message_date,
    'preferred_language', COALESCE(v_chat_stats.preferred_language, 'en'),

    -- Payment stats
    'subscription_end_date', v_payment_stats.subscription_end,
    'total_amount_spent', COALESCE(v_payment_stats.total_spent, 0),

    -- Usage counters
    'questions_used_this_month', COALESCE(v_counters.questions_used, 0),
    'talk_minutes_used_this_month', COALESCE(v_counters.talk_minutes_used, 0),
    'cycle_end_date', v_counters.cycle_end,

    -- User details
    'gender', v_birth_details.gender,
    'age', EXTRACT(YEAR FROM AGE(v_birth_details.date_of_birth)),

    -- Feedback stats
    'avg_call_rating', ROUND(COALESCE(v_feedback_stats.avg_rating, 0)::NUMERIC, 2),
    'total_call_feedbacks', COALESCE(v_feedback_stats.total_feedbacks, 0),

    -- Timestamps
    'last_updated', NOW()
  );

  RETURN result;
END;
$$;
```

### Step 2: CleverTap Sync Edge Function

**File**: `supabase/functions/sync-user-to-clevertap/index.ts`

### Step 3: Batch Sync Edge Function

**File**: `supabase/functions/batch-sync-users-to-clevertap/index.ts`

### Step 4: Admin UI Component

Add "CleverTap Sync" section to WebPushCampaignManager or create new tab.

---

## 🎯 CleverTap User Profile Schema

```json
{
  "identity": "user-uuid",
  "ts": 1234567890,
  "type": "profile",
  "profileData": {
    "Email": "user@example.com",
    "Identity": "user-uuid",

    "Plan Tier": "monthly",
    "Subscription Status": "active",
    "Subscription End Date": "2025-12-31",
    "Coin Balance": 50,

    "Profile Count": 3,
    "Gender": "Female",
    "Age": 28,

    "Total Calls": 15,
    "Total Call Duration (min)": 45.5,
    "Last Call Date": "2025-12-15",
    "Last Call Duration (min)": 3.2,
    "Avg Call Rating": 4.8,

    "Total Messages": 120,
    "Last Message Date": "2025-12-16",
    "Preferred Language": "en",

    "Questions Used This Month": 15,
    "Talk Minutes Used This Month": 45,
    "Questions Remaining": 85,
    "Talk Minutes Remaining": 15,

    "Total Amount Spent": 999,
    "Last Payment Date": "2025-11-01"
  }
}
```

---

## 📅 Sync Schedule

### Automatic Sync (via Database Triggers)
- ✅ On user signup (immediate)
- ✅ On subscription change (immediate)
- ✅ On call completion (immediate)
- ✅ After profile creation (immediate)
- ⚠️ After message sent (debounced - max once per hour)

### Manual Sync (via Admin Panel)
- ✅ Single user sync
- ✅ Batch sync all users
- ✅ Sync specific segment (e.g., premium users only)

### Scheduled Sync (Optional - via Cron)
- Daily sync at 2 AM UTC (catch any missed syncs)

---

## ✅ Next Steps

1. **Do you approve this plan?**
2. **Should I start implementation?**

**Implementation Order:**
1. Create SQL aggregation function ✅
2. Create sync Edge Function ✅
3. Create batch sync Edge Function ✅
4. Add admin UI for manual sync ✅
5. Add database triggers for auto-sync ✅

Let me know if you want me to proceed with the implementation!

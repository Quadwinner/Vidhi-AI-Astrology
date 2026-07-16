# Database Tables Available for CleverTap Sync

## 📊 Available Tables and Fields

### 1. **users** (Main User Table)
- `id` (UUID) - User unique identifier
- `email` (TEXT) - User email address
- `coin_balance` (INTEGER) - Current coin balance (default: 5)
- `plan_tier` (ENUM) - 'free', 'monthly', 'yearly'
- `subscription_status` (TEXT) - 'active', 'canceled', 'past_due', 'incomplete', 'inactive'
- `subscription_start_date` (TIMESTAMPTZ) - When subscription started
- `subscription_end_date` (TIMESTAMPTZ) - When subscription ends
- `gateway_customer_id` (TEXT) - Stripe/Razorpay customer ID
- `subscription_id` (TEXT) - Stripe/Razorpay subscription ID
- `is_admin` (BOOLEAN) - Admin status
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

### 2. **user_profiles** (User Birth Charts)
- `id` (UUID) - Profile ID
- `user_id` (UUID) - References users table
- `name` (VARCHAR) - Profile name (e.g., "Me", "My Son")
- `created_at` (TIMESTAMPTZ) - Profile creation date

**Aggregatable:**
- Profile count per user
- Has profiles (true/false)

### 3. **user_notification_preferences** (Push Notification Settings)
- `user_id` (UUID) - References users table
- `notification_permission` (TEXT) - 'default', 'granted', 'denied'
- `notification_enabled` (BOOLEAN) - Overall push enabled
- `daily_horoscope_enabled` (BOOLEAN)
- `weekly_forecast_enabled` (BOOLEAN)
- `transit_alerts_enabled` (BOOLEAN)
- `chat_reminders_enabled` (BOOLEAN)
- `subscription_reminders_enabled` (BOOLEAN)
- `promotional_enabled` (BOOLEAN)
- `daily_horoscope_time` (TIME) - Preferred time for daily notifications
- `weekly_forecast_day` (INTEGER) - 0-6 (Sunday-Saturday)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 4. **user_plan_counters** (Usage Tracking)
- `user_id` (UUID) - References users table
- `cycle_start` (DATE) - Billing cycle start
- `cycle_end` (DATE) - Billing cycle end
- `questions_used` (INTEGER) - Questions asked this cycle
- `talk_minutes_used` (INTEGER) - Voice call minutes used this cycle
- `updated_at` (TIMESTAMPTZ)

**Note:** Only current cycle data is relevant for CleverTap

### 5. **users_subscriptions** (Subscription History)
- `id` (BIGINT)
- `user_id` (UUID)
- `price_id` (BIGINT) - References prices table
- `status` (ENUM) - 'active', 'canceled', 'past_due', 'incomplete'
- `current_period_start` (TIMESTAMPTZ)
- `current_period_end` (TIMESTAMPTZ)
- `gateway_subscription_id` (TEXT)
- `management_url` (TEXT) - Portal URL
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 6. **chat_history** (User Activity)
- `id` (UUID)
- `user_id` (UUID)
- `profile_id` (UUID)
- `role` (TEXT) - 'user' or 'assistant'
- `message_content` (TEXT)
- `language` (TEXT) - Language used
- `feedback` (TEXT) - 'like', 'dislike', or NULL
- `created_at` (TIMESTAMPTZ)

**Aggregatable:**
- Total messages sent
- Last message date
- Favorite language
- Messages with positive/negative feedback

### 7. **call_logs** (Voice Call Activity)
- `id` (UUID)
- `user_id` (UUID)
- `profile_id` (UUID)
- `call_id` (TEXT) - Ultravox/Agora call ID
- `started_at` (TIMESTAMPTZ)
- `ended_at` (TIMESTAMPTZ)
- `duration_seconds` (INTEGER)
- `coins_deducted` (INTEGER)
- `coins_per_minute` (INTEGER) - Rate (default: 20)
- `status` (TEXT) - 'active', 'completed', 'interrupted', 'insufficient_coins'
- `created_at` (TIMESTAMPTZ)

**Aggregatable:**
- Total calls made
- Total call duration
- Last call date
- Average call duration
- Calls this month

### 8. **call_feedback** (Call Ratings)
- `id` (BIGINT)
- `user_id` (UUID)
- `profile_id` (UUID)
- `rating` (SMALLINT) - 1-5
- `comments` (TEXT)
- `created_at` (TIMESTAMPTZ)

**Aggregatable:**
- Average rating
- Total ratings submitted

### 9. **whatsapp_link_clicks** (Campaign Tracking)
- `id` (UUID)
- `phone_number` (TEXT)
- `user_id` (UUID) - References users table
- `campaign_name` (TEXT)
- `template_name` (TEXT)
- `original_url` (TEXT)
- `clicked_at` (TIMESTAMPTZ)
- `user_agent` (TEXT)
- `ip_address` (TEXT)

**Aggregatable:**
- WhatsApp campaigns clicked
- Last WhatsApp click date

### 10. **user_birth_details** (Astrology Info)
- `id` (BIGINT)
- `profile_id` (UUID)
- `date_of_birth` (DATE)
- `time_of_birth` (TIME)
- `birth_place` (VARCHAR)
- `birth_lat` (VARCHAR)
- `birth_lng` (VARCHAR)
- `gender` (VARCHAR)
- `timezone_offset` (DOUBLE PRECISION)

**Derivable:**
- Zodiac sign (calculated from date_of_birth)
- Age
- Birth location

---

## 🎯 Recommended CleverTap User Properties

### Essential Properties (Always Sync)
- ✅ User ID (identity)
- ✅ Email
- ✅ Plan Tier (free/monthly/yearly)
- ✅ Subscription Status
- ✅ Coin Balance
- ✅ Profile Count
- ✅ Push Notifications Enabled
- ✅ Subscription End Date

### Engagement Properties
- ✅ Last Message Date
- ✅ Total Messages Sent
- ✅ Last Call Date
- ✅ Total Calls Made
- ✅ Total Call Duration (minutes)

### Usage Tracking (Current Cycle)
- ✅ Questions Used This Month
- ✅ Talk Minutes Used This Month
- ✅ Cycle End Date (when usage resets)

### Preference Properties
- ✅ Daily Horoscope Enabled
- ✅ Weekly Forecast Enabled
- ✅ Promotional Notifications Enabled
- ✅ Preferred Notification Time

### Segmentation Properties
- ✅ Has Created Profile (boolean)
- ✅ Has Made Call (boolean)
- ✅ Has Sent Message (boolean)
- ✅ Clicked WhatsApp Campaign (boolean)
- ✅ Is Admin (boolean)

### Lifecycle Properties
- ✅ Account Created Date
- ✅ Subscription Start Date
- ✅ Days Since Last Activity
- ✅ Days Until Subscription Expires

---

## ❓ Questions for You

1. **Which properties do you want to sync?** (Mark the ones above you want)

2. **When should we sync?**
   - On user signup/login?
   - On subscription change?
   - On notification preference change?
   - Periodic sync (daily/weekly)?
   - Manual trigger from admin panel?

3. **What events should we track?**
   - User signed up
   - Subscription purchased
   - Subscription canceled
   - Message sent
   - Call made
   - Profile created
   - Notification permission granted
   - WhatsApp link clicked

4. **Segmentation needs?**
   - Do you need specific user segments in CleverTap?
   - Examples: "Free users with >10 messages", "Premium users expiring soon", etc.

---

Please review this and tell me:
1. Which user properties you want to sync
2. When to sync them
3. Any custom segments you want to create

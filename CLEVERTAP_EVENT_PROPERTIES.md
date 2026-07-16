# CleverTap Event Properties Reference

All events tracked via `trackEvent()` automatically include enriched user properties for segmentation.

---

## Standard Properties (Auto-Added to ALL Events)

These properties are **automatically included** with every event:

### Demographics

| Property       | Type   | Example   | Description                                                            |
| -------------- | ------ | --------- | ---------------------------------------------------------------------- |
| `Age`        | Number | `28`    | User's age from birth date                                             |
| `Age Bucket` | String | `25-34` | Age range:`<18`, `18-24`, `25-34`, `35-44`, `45-54`, `55+` |
| `Gender`     | String | `Male`  | User's gender or `Not Provided`                                      |

### Category Preferences

| Property                   | Type   | Example           | Description                             |
| -------------------------- | ------ | ----------------- | --------------------------------------- |
| `Most Asked Category`    | String | `Love`          | Most frequently asked question category |
| `Most Asked Subcategory` | String | `Compatibility` | Most frequently asked subcategory       |

### Financial

| Property                   | Type   | Example     | Description                          |
| -------------------------- | ------ | ----------- | ------------------------------------ |
| `Wallet Balance`         | Number | `150`     | Current coin balance                 |
| `Total Amount Recharged` | Number | `2999`    | Lifetime spending (INR/USD)          |
| `Plan Tier`              | String | `monthly` | `free`, `monthly`, or `yearly` |

### Usage Stats

| Property                      | Type   | Example | Description                          |
| ----------------------------- | ------ | ------- | ------------------------------------ |
| `Questions Left`            | Number | `45`  | Remaining questions in billing cycle |
| `Total Chats Completed`     | Number | `89`  | Lifetime chat messages sent          |
| `Total Call Mins Completed` | Number | `23`  | Lifetime voice call minutes          |
| `Total Reports Viewed`      | Number | `2`   | Number of profiles created           |

### Engagement Flags

| Property                | Type    | Example  | Description                           |
| ----------------------- | ------- | -------- | ------------------------------------- |
| `Has Created Profile` | Boolean | `true` | User has created at least one profile |
| `Has Made Call`       | Boolean | `true` | User has made at least one call       |
| `Has Sent Message`    | Boolean | `true` | User has sent at least one message    |

### Metadata

| Property            | Type   | Example                      | Description            |
| ------------------- | ------ | ---------------------------- | ---------------------- |
| `Event Timestamp` | String | `2025-12-20T14:30:00.000Z` | ISO timestamp of event |

---

## Event-Specific Properties

### Authentication Events

#### `User Logged In`

```javascript
trackEvent('User Logged In');
```

**Additional Properties:** (none - only standard properties)

#### `User Logged Out`

```javascript
trackEvent('User Logged Out');
```

**Additional Properties:** (none - only standard properties)

---

### Payment Events

#### `Payment Gateway Initiated`

Triggered when user opens Razorpay/Stripe checkout modal.

```javascript
trackEvent('Payment Gateway Initiated', {
  'Plan': 'Yearly',
  'Amount': 2999,
  'Currency': 'INR',
  'Gateway': 'Razorpay',
  'Source': 'Subscription Modal'
});
```

| Property     | Type   | Example                | Description                      |
| ------------ | ------ | ---------------------- | -------------------------------- |
| `Plan`     | String | `Yearly`             | Subscription plan name           |
| `Amount`   | Number | `2999`               | Payment amount                   |
| `Currency` | String | `INR`                | Currency code                    |
| `Gateway`  | String | `Razorpay`           | Payment gateway used             |
| `Source`   | String | `Subscription Modal` | Where payment was initiated from |

**Use Case:** Track drop-offs between payment initiation and completion.

---

#### `Payment Success`

Triggered on successful payment completion.

```javascript
trackEvent('Payment Success', {
  'user_id': 'uuid',
  'email': 'user@example.com',
  'plan_tier': 'yearly',
  'subscription_status': 'active'
});
```

| Property                | Type   | Example              | Description         |
| ----------------------- | ------ | -------------------- | ------------------- |
| `user_id`             | String | `uuid`             | User ID             |
| `email`               | String | `user@example.com` | User email          |
| `plan_tier`           | String | `yearly`           | New plan tier       |
| `subscription_status` | String | `active`           | Subscription status |

---

#### `Charged` (CleverTap Special Event)

Triggered when payment is captured (webhook).

```javascript
clevertap.event.push('Charged', {
  'Amount': 2999,
  'Currency': 'INR',
  'Plan': 'Yearly',
  'Payment Status': 'Success',
  'Gateway': 'Razorpay'
});
```

| Property           | Type   | Example      | Description     |
| ------------------ | ------ | ------------ | --------------- |
| `Amount`         | Number | `2999`     | Payment amount  |
| `Currency`       | String | `INR`      | Currency code   |
| `Plan`           | String | `Yearly`   | Plan purchased  |
| `Payment Status` | String | `Success`  | Payment result  |
| `Gateway`        | String | `Razorpay` | Payment gateway |

**Note:** CleverTap uses `Charged` for revenue tracking.

---

### Chat Events

#### `Chat Message Sent`

Triggered when user sends a chat message.

```javascript
trackEvent('Chat Message Sent', {
  'profile_id': 'uuid',
  'question_length': 156,
  'language': 'en'
});
```

| Property            | Type   | Example  | Description             |
| ------------------- | ------ | -------- | ----------------------- |
| `profile_id`      | String | `uuid` | Profile used for chat   |
| `question_length` | Number | `156`  | Message character count |
| `language`        | String | `en`   | Language code           |

---

### Call Events

#### `Call Initiated`

Triggered when user starts a voice call.

```javascript
trackEvent('Call Initiated', {
  'provider': 'ultravox',
  'profile_id': 'uuid',
  'call_log_id': 'uuid'
});
```

| Property        | Type   | Example      | Description                    |
| --------------- | ------ | ------------ | ------------------------------ |
| `provider`    | String | `ultravox` | Call provider (ultravox/agora) |
| `profile_id`  | String | `uuid`     | Profile used for call          |
| `call_log_id` | String | `uuid`     | Call log ID                    |

---

#### `Call Ended`

Triggered when call ends.

```javascript
trackEvent('Call Ended', {
  'duration': 180,
  'coins_deducted': 3,
  'status': 'completed'
});
```

| Property           | Type   | Example       | Description              |
| ------------------ | ------ | ------------- | ------------------------ |
| `duration`       | Number | `180`       | Call duration in seconds |
| `coins_deducted` | Number | `3`         | Total coins spent        |
| `status`         | String | `completed` | Call status              |

---

### Profile Events

#### `Profile Created`

Triggered when user creates a new profile.

```javascript
trackEvent('Profile Created', {
  'profile_id': 'uuid',
  'profile_name': 'John Doe'
});
```

| Property         | Type   | Example      | Description    |
| ---------------- | ------ | ------------ | -------------- |
| `profile_id`   | String | `uuid`     | New profile ID |
| `profile_name` | String | `John Doe` | Profile name   |

---

### Navigation Events

#### `Page Viewed`

Triggered on page navigation (if implemented).

```javascript
trackEvent('Page Viewed', {
  'page_name': 'Chat',
  'page_path': '/chat'
});
```

| Property      | Type   | Example   | Description |
| ------------- | ------ | --------- | ----------- |
| `page_name` | String | `Chat`  | Page name   |
| `page_path` | String | `/chat` | URL path    |

---

## Segmentation Examples

### By Demographics

```
Event: Payment Gateway Initiated
Filter: Age Bucket = "25-34" AND Gender = "Male"
Result: Payment attempts from males aged 25-34
```

### By Category Preference

```
Event: Payment Success
Filter: Most Asked Category = "Love"
Result: Users who ask about Love and subscribed
```

### By Financial Behavior

```
Event: Chat Message Sent
Filter: Wallet Balance < 50 AND Total Amount Recharged > 1000
Result: Active users running low on coins (re-engagement target)
```

### By Usage Pattern

```
Event: Call Initiated
Filter: Total Chats Completed > 100 AND Total Call Mins Completed = 0
Result: Heavy chat users who haven't tried calls yet
```

### Conversion Funnel

```
Step 1: Payment Gateway Initiated
        ↓ (Filter: Age Bucket = "25-34")
Step 2: Payment Success
        ↓
Result: Conversion rate for users aged 25-34
```

---

## Implementation Notes

### Automatic Enrichment

```javascript
// All these calls get auto-enriched:
trackEvent('Button Clicked');
trackEvent('Feature Used', { feature: 'Chart View' });
trackEvent('Error Occurred', { error_code: 500 });
```

### Without Enrichment (Special Cases)

```javascript
import { trackEventBasic } from '../utils/analytics';

// Track without enriched properties
trackEventBasic('System Event', { type: 'Cache Clear' });
```

### Cache Behavior

- **Duration:** 5 minutes
- **Auto-cleared:** On logout, subscription change, user data update
- **Manual clear:** `clearUserPropertiesCache()`

---

## CleverTap Dashboard Usage

### View Events

1. CleverTap Dashboard → **Events**
2. Select event name (e.g., "Payment Gateway Initiated")
3. View all properties in the table

### Create Segment

1. CleverTap Dashboard → **Segments**
2. Add filters (e.g., "Age Bucket" = "25-34")
3. Add event criteria (e.g., "Payment Gateway Initiated" in last 7 days)
4. Save segment for campaigns

### Analyze Trends

1. CleverTap Dashboard → **Analytics** → **Trends**
2. Select event (e.g., "Chat Message Sent")
3. Group by property (e.g., "Most Asked Category")
4. View breakdown by category

---

## Performance

| Metric                  | Value           |
| ----------------------- | --------------- |
| First event (no cache)  | ~200-500ms      |
| Cached events           | <1ms            |
| Cache duration          | 5 minutes       |
| Database calls per user | 1 per 5 minutes |

---

## Troubleshooting

### Properties Missing in CleverTap?

1. Check user is authenticated
2. Verify `get-user-clevertap-data` Edge Function is deployed
3. Check browser console for errors
4. Clear cache: `clearUserPropertiesCache()`

### Stale Data?

- Cache refreshes every 5 minutes
- Force refresh on logout/subscription change
- Manual refresh: `clearUserPropertiesCache()`

### Property is `null` or `0`?

- User may not have that data (e.g., no birth details → Age = null)
- Check database for missing data
- Default values: `None`, `Not Provided`, `0`

---

## Quick Reference

**All events get these 15 properties automatically:**

1. Age
2. Age Bucket
3. Gender
4. Most Asked Category
5. Most Asked Subcategory
6. Wallet Balance
7. Total Amount Recharged
8. Plan Tier
9. Questions Left
10. Total Chats Completed
11. Total Call Mins Completed
12. Total Reports Viewed
13. Has Created Profile
14. Has Made Call
15. Has Sent Message

**Plus event-specific properties** (plan, amount, duration, etc.)

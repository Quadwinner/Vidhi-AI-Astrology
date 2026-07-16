# CLAUDE.md - AuraAI Codebase Guide

Vedic astrology platform with AI chat, voice calling, and subscription management.

## Project Instructions

Always use context7 when I need code generation or library documentation.
Automatically use MCP tools to resolve library IDs and fetch docs.

## Agent System Rules

Follow the universal 15-rule framework for all tasks:

**CORE EXECUTION PHASES:**
1. **COMPREHEND** - Understand task completely before acting
2. **ANALYZE** - Break complexity into manageable pieces  
3. **PLAN** - Create clear execution strategy with priorities
4. **EXECUTE** - Build incrementally, test continuously
5. **VERIFY** - Ensure solution meets all requirements

**KEY PRINCIPLES:**
- Start simple → Build → Test → Ship → Learn → Iterate
- Estimate realistically (3-point estimation + 20-30% buffer)
- Test continuously (happy path + edge cases + error handling)
- Communicate proactively (progress, blockers, changes)
- Document decisions (why, not just what)
- Balance speed and quality based on context
- Learn from every task and apply to future work

**QUALITY THRESHOLDS:**
- MVP/Prototype: 70% quality (ship fast, learn)
- Production: 90% quality (reliable, maintained)
- Critical Systems: 99% quality (safety, legal, financial)

**ANTI-PATTERNS TO AVOID:**
- Jumping to solution without understanding problem
- Over-engineering simple problems
- Under-communicating progress and blockers
- Assuming instead of verifying
- Feature creep without scope discussion
- No error handling or edge case testing
- Analysis paralysis vs progressive refinement

**SUCCESS METRICS:**
- Complete tasks within estimated time (±20%)
- Low rework rate with minimal bugs
- Clear communication and documentation
- Decreasing time on similar tasks (learning curve)
- Help others succeed through quality work

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Quick Start](#quick-start)
5. [Frontend](#frontend)
6. [Database Schema](#database-schema)
7. [Edge Functions](#edge-functions)
8. [Authentication](#authentication)
9. [Payment System](#payment-system)
10. [Key Integrations](#key-integrations)
11. [Common Tasks](#common-tasks)
12. [Important Quirks](#important-quirks)

---

## Project Overview

**Tech Stack:**
- Frontend: React 19, TypeScript, React Router v7
- Backend: Supabase (PostgreSQL, Auth, Edge Functions/Deno)
- Voice: Ultravox (default) or Agora
- AI: OpenAI (embeddings, chat), Gemini (live calls)
- Payments: Stripe (global), Razorpay (India)
- Analytics: Amplitude

**Core Features:**
- AI chat with RAG over birth chart data
- Voice calls with AI astrology experts
- Multi-gateway subscription management (Stripe/Razorpay)
- Admin dashboard for configuration
- VedicAstro API integration for natal charts

---

## Architecture

### High-Level Flow

```
Frontend (React)
  ↓
Supabase API
  ↓
PostgreSQL + Edge Functions (Deno)
  ↓
External Services: VedicAstro, Stripe/Razorpay, Ultravox/Agora, OpenAI
```

### Key Data Flows

**Chat:**
1. User sends question → `get-chat-answer` Edge Function
2. Check auth, coins, daily data freshness
3. Embed question (OpenAI) → RAG search (`match_astro_chunks`)
4. Call AI with system prompt + context
5. Save to `chat_history`, return answer + TTS

**Voice Call:**
1. User initiates → `create-ultravox-call` or `initiate-agora-call`
2. Create `call_logs` entry
3. Establish WebRTC session
4. Real-time coin deduction via `deduct-call-coins`
5. End call → trigger updates `user_plan_counters`

**Payment:**
1. User selects plan → `create-payment-session`
2. Redirect to Stripe/Razorpay
3. Webhook (`stripe-webhook`/`razorpay-webhook`) verifies payment
4. Call `update_user_subscription` RPC
5. Update `users.plan_tier` and subscription status

---

## Project Structure

```
Aura_Ai_backend-main/
├── src/
│   ├── context/AuthContext.tsx          # Global auth state
│   ├── pages/
│   │   ├── ChatPage.tsx                 # Main chat interface
│   │   ├── AdminPage.tsx                # Admin dashboard
│   │   └── [Other pages]
│   ├── components/
│   │   ├── CustomCallScreen.tsx         # Ultravox UI
│   │   ├── AICallScreen.tsx             # Agora UI
│   │   ├── SubscriptionModal.tsx
│   │   └── admin/[Admin components]
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useCallProvider.ts
│   └── utils/
│       ├── UltravoxCallManager.ts
│       ├── AgoraManager.ts
│       └── TTSPlayer.ts
│
├── supabase/
│   ├── migrations/                      # 30+ SQL migrations
│   └── functions/                       # 30+ Edge Functions
│       ├── get-chat-answer/
│       ├── create-ultravox-call/
│       ├── create-payment-session/
│       ├── stripe-webhook/
│       └── [20+ more]
```

**Key Files:**
- Frontend: `src/context/AuthContext.tsx`, `src/pages/ChatPage.tsx`
- Backend: `supabase/functions/get-chat-answer/`, `create-payment-session/`
- Schema: `supabase/migrations/20250930093646_remote_schema.sql`

---

## Quick Start

### Prerequisites
- Node.js 18+, npm
- Supabase account

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd Aura_Ai_backend-main
npm install

# 2. Configure .env
cp .env.example .env
# Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY

# 3. Start dev server
npm start  # → http://localhost:3000

# 4. Build production
npm run build
```

### Supabase Secrets (Dashboard → Edge Functions → Secrets)

```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SIGNING_SECRET
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
OPENAI_API_KEY, VEDICASTRO_API_KEY
AGORA_APP_ID, AGORA_CUSTOMER_ID, AGORA_CUSTOMER_SECRET
```

---

## Frontend

### AuthContext (`src/context/AuthContext.tsx`)

Global state management:
```typescript
interface AuthContextType {
  session, user, isAdmin, isSubscribed
  coinBalance, planTier, subscriptionStatus
  signOut(), signInWithGoogle(), refreshUserStatus()
  updateCoinBalance(newBalance)
}
```

**Features:**
- Initializes from Supabase session
- Refreshes on tab focus
- Admin detection: `is_admin` DB flag OR hardcoded emails
- Coin balance cached in-memory (use `updateCoinBalance` after deductions)

### Routing

```
/                           → HomePage
/chat                       → ChatPage (main feature)
/profiles                   → ProfileDashboardPage
/admin                      → AdminPage (admin-only)
/subscription-management    → SubscriptionManagementPage
```

### ChatPage Architecture

**State:**
- `selectedProfile`, `chatHistory`, `coinBalance`
- `selectedCallProvider`: 'ultravox' | 'agora'

**Flow:**
```typescript
// Send message
const response = await supabase.functions.invoke('get-chat-answer', {
  body: { profile_id, question_text, client_date }
});
// Response: { answer, tts_content, language }
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `ProtectedRoute` | Auth & admin route guards |
| `CustomCallScreen` | Ultravox call UI |
| `AICallScreen` | Agora call UI |
| `SubscriptionModal` | Upgrade prompts |
| `CoinBalance` | Display coins |

---

## Database Schema

### Core Tables

**`users`**: One per authenticated user
- `id`, `email`, `coin_balance` (default 5), `plan_tier`, `subscription_status`, `is_admin`

**`user_profiles`**: Multiple profiles per user
- `id`, `user_id`, `name`

**`user_birth_details`**: Birth info (1:1 with profiles)
- `profile_id`, `date_of_birth`, `time_of_birth`, `birth_place`, `birth_lat/lng`

**`profile_astro_data`**: Generated chart data
- `profile_id`, `chart_data` (JSONB), `processed_tables` (JSONB), `last_generated_at`

**`vectored_astro_data`**: RAG embeddings
- `profile_id`, `content`, `embedding` vector(1536)

**`chat_history`**: All messages
- `profile_id`, `user_id`, `role` (user/assistant), `message_content`, `tts_content`, `feedback`

**`call_logs`**: Voice call records
- `user_id`, `profile_id`, `call_provider`, `duration_seconds`, `coins_deducted`, `started_at`, `ended_at`

**`user_plan_counters`**: Monthly usage tracking
- `user_id`, `cycle_start`, `cycle_end`, `questions_used`, `talk_minutes_used`

**`subscription_plans`**: Available tiers
- `id`, `plan_name`, `plan_tier`, `currency`, `base_price`

**`plan_entitlements`**: Plan benefits
- `plan_id`, `questions_per_month`, `ai_call_talk_minutes`, `max_profiles`

**`prices`**: Regional pricing
- `plan_id`, `currency`, `stripe_price_id`, `razorpay_plan_id`

**`system_prompts`**: AI instructions
- `prompt_name`, `prompt_text`, `api_provider`, `model_name`, `is_active`

**`provider_settings`**: Call provider config
- `setting_key` ('default_call_provider'), `setting_value` ('ultravox'/'agora')

### Key RPCs

- `get_recent_chats()`: Last 5 chats
- `match_astro_chunks(profile_id, query_embedding, match_count)`: RAG search
- `update_user_subscription(user_id, price_id, gateway_sub_id)`: Activate subscription
- `upsert_increment_counter_normalized(...)`: Update usage counters

### Triggers

- `inc_questions_on_chat`: Auto-increment `questions_used` on assistant message
- `inc_minutes_on_call_end`: Auto-increment `talk_minutes_used` on call end
- `handle_new_user_setup`: Create `users` row on auth signup

---

## Edge Functions

All functions are TypeScript (Deno) in `supabase/functions/`.

### Critical Functions

#### `get-chat-answer` (JWT required)
Core chat pipeline with RAG.

**Flow:**
1. Verify auth, check coins
2. Check daily data freshness → invoke `generate-daily-astro-data` if stale
3. Embed question (OpenAI)
4. RAG: `match_astro_chunks` for context
5. Format prompt with dasha + transits
6. Call AI (OpenAI/Anthropic per `system_prompts`)
7. Save messages to `chat_history`
8. Return `{ answer, tts_content, language }`

**Quirks:**
- Dasha dates in DD/MM/YYYY format
- 4-layer JSON parsing with fallbacks

#### `create-ultravox-call` (no JWT, CORS enabled)
Create WebRTC session.

**Security Issue:** API key hardcoded (should use Deno.env)

#### `create-payment-session` (no JWT, CORS)
Create Stripe/Razorpay checkout.

**Flow:**
1. Get user location via `get-location-and-plans`
2. India → Razorpay, else → Stripe
3. Create customer if needed
4. Create session with metadata `{user_id, price_id}`
5. Return checkout URL

#### `stripe-webhook` / `razorpay-webhook` (no JWT)
Handle payment events.

**Events:**
- `checkout.session.completed`: Call `update_user_subscription`
- `invoice.payment_succeeded`: Renew subscription
- `customer.subscription.deleted`: Cancel

**Security:** HMAC-SHA256 signature verification

#### `generate-astro-data` (JWT required)
Full natal chart generation.

**Flow:**
1. Fetch profile + birth details
2. Call VedicAstro API
3. Parse and normalize response
4. Generate embeddings (OpenAI)
5. Store in `vectored_astro_data` + `profile_astro_data`
6. Update `daily_data_log`

#### `deduct-call-coins` (JWT required)
Real-time coin deduction during calls.

**Logic:**
1. Verify call ownership
2. Check call is active
3. Deduct from `users.coin_balance`
4. Update `call_logs.coins_deducted`

### Deployment

```bash
# With JWT verification
supabase functions deploy get-chat-answer

# Without JWT (webhooks)
supabase functions deploy stripe-webhook --no-verify-jwt
```

---

## Authentication

### Flow

1. Google OAuth → Supabase verifies → redirect with JWT
2. `AuthContext` fetches session → stores in localStorage
3. JWT auto-attached to all requests

### Admin Identification

```typescript
// In AuthContext.tsx
const adminFromDb = Boolean(userData?.is_admin);
const adminFromEmail = ['shubhamkush012@gmail.com', ...].includes(email);
setIsAdmin(adminFromDb || adminFromEmail);
```

### RLS Policies

```sql
-- Users read own data
CREATE POLICY "Users read own" ON chat_history
FOR SELECT USING (auth.uid() = user_id);

-- Admins full access
CREATE POLICY "Admins full" ON chat_history
FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

-- Public read
CREATE POLICY "Public read" ON prices
FOR SELECT USING (true);
```

---

## Payment System

### Multi-Gateway

```
User → get-location-and-plans
  ↓
India → Razorpay
Rest → Stripe
```

### Subscription Tiers

- **Free**: 5 coins, 1 profile
- **Monthly**: 100 questions, 60 call mins, 3 profiles
- **Yearly**: Same as monthly, annual billing

### Coin System

**Acquisition:**
- Free: 5 on signup
- Purchase: `create-topup-session`

**Deduction:**
- Chat: 1 coin/message (free on premium)
- Calls: 1 coin/minute (up to plan limit)

### Lifecycle

```
1. Select plan → 2. create-payment-session → 3. Checkout
→ 4. Payment → 5. Webhook → 6. update_user_subscription RPC
→ 7. Update users.plan_tier → 8. Frontend refreshUserStatus
```

---

## Key Integrations

### VedicAstro API
Natal chart calculations (planets, dasha, yogas).

### OpenAI API
1. Embeddings (`text-embedding-3-small`)
2. Chat completion (optional, per `system_prompts`)

### Ultravox API
Low-latency voice AI via WebRTC.

**Quirk:** API key hardcoded in function (SECURITY TODO)

### Agora SDK
Video/audio calls with AI agent.

### Stripe
Global payment processing.

### Razorpay
India payment processing.

### Amplitude
User analytics tracking.

---

## Common Tasks

### Add Edge Function

```bash
mkdir supabase/functions/my-function
# Write index.ts with Deno.serve()
# Update config.toml: [functions.my-function] verify_jwt = true
supabase functions deploy my-function
```

### Add Subscription Plan

```sql
-- In migration
INSERT INTO subscription_plans (id, plan_name, plan_tier, currency, base_price, interval)
VALUES ('plan_id', 'Name', 'tier', 'usd', 29.99, 'month');

INSERT INTO plan_entitlements (plan_id, questions_per_month, ai_call_talk_minutes, max_profiles)
VALUES ('plan_id', 500, 300, 10);

INSERT INTO prices (id, plan_id, currency, stripe_price_id, razorpay_plan_id)
VALUES ('price_id', 'plan_id', 'usd', 'stripe_xxx', 'rzp_xxx');
```

### Add Admin User

```sql
UPDATE users SET is_admin = true WHERE email = 'admin@example.com';
```

Or add email to hardcoded list in `AuthContext.tsx`.

### Switch Call Provider

```sql
-- Via DB
INSERT INTO provider_settings (setting_key, setting_value)
VALUES ('default_call_provider', 'agora')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = 'agora';
```

Or use Admin UI: `/admin` → Provider Settings Manager

---

## Important Quirks

### 1. Coin Balance Not Real-Time
- Cached in AuthContext memory
- Use `updateCoinBalance()` after deductions
- Full refresh via `refreshUserStatus()`

### 2. Ultravox API Key Hardcoded
File: `supabase/functions/create-ultravox-call/index.ts`
**SECURITY TODO:** Move to Deno.env

### 3. Dasha Dates Format
VedicAstro returns DD/MM/YYYY. Parse carefully:
```typescript
const [day, month, year] = dateString.split('/').map(Number);
new Date(year, month - 1, day); // JS months are 0-indexed
```

### 4. Subscription Counters Reset on Billing Cycle
`user_plan_counters` tracks usage per cycle (determined by `subscription_start_date`).

### 5. RLS Uses auth.uid()
If JWT missing/invalid, `auth.uid()` returns NULL → access denied.

### 6. Daily Data Generation On-Demand
Triggered by first chat of the day (can add 30-60s latency).

### 7. Admin State is Dual
Checked via DB flag OR hardcoded email list (either grants admin).

### 8. Webhook Secrets Must Match
Verify `STRIPE_WEBHOOK_SIGNING_SECRET` and `RAZORPAY_WEBHOOK_SECRET` match dashboard values.

### 9. Location-Based Payment Routing
MaxMind GeoIP used. India → Razorpay, else → Stripe. No manual override.

### 10. Call Provider Configuration
Stored in `provider_settings` table. Default: 'ultravox' if missing.

### 11. Profile Requires Birth Details
Profile creation separate from birth details. Chart generation fails without complete birth info.

### 12. Prices Need Regional Configs
Each plan needs price rows for all target currencies/regions.

---

## Development Flow

1. Update DB schema via migrations
2. Implement Edge Function (Deno + TypeScript)
3. Add React component UI
4. Test locally, deploy via Supabase CLI
5. Monitor via logs + admin dashboard

---

## Troubleshooting Quick Reference

**Chat not working:**
- Check coin balance > 0
- Verify `profile_astro_data.last_generated_at` is recent
- Check Edge Function logs for `get-chat-answer` errors
- Ensure `system_prompts` has active prompt

**Voice call fails:**
- Check `provider_settings` for correct provider
- Verify API credentials in Supabase secrets
- Check browser console for WebRTC errors

**Subscription not activating:**
- Verify webhook delivery in Stripe/Razorpay dashboard
- Check webhook signature secrets match
- Trace `stripe-webhook`/`razorpay-webhook` function logs

**401 Unauthorized:**
- Verify JWT token exists and is valid
- Check function `verify_jwt` config
- Refresh token via `supabase.auth.refreshSession()`

---

**Key Files Summary:**
- Frontend: `src/App.tsx`, `src/context/AuthContext.tsx`, `src/pages/ChatPage.tsx`
- Backend: `supabase/functions/get-chat-answer/`, `create-payment-session/`, `stripe-webhook/`
- DB: `supabase/migrations/20250930093646_remote_schema.sql`

Good luck building on AuraAI!

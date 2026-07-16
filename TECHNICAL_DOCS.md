# AuraAI — Technical Documentation

## 1. Overview

AuraAI is a Vedic astrology platform with AI-powered chat, voice calling, and subscription management. The system comprises a React (TypeScript) frontend and a Supabase backend (Postgres + Auth + Storage + Edge Functions). Payments are supported via Stripe (global) and Razorpay (India), auto-selected by location.

Key capabilities:
- Auth (Google OAuth), RLS-secured data access.
- AI chat (RAG pipeline over per-profile astro data).
- Real-time voice calls via Agora.
- Multi-gateway subscriptions with webhooks and customer portals.
- Daily and on-demand astro data generation.

---

## 2. Tech Stack

- Frontend: React 19, TypeScript, `react-router-dom` 7, CRA scripts (`react-scripts` 5)
- Styling: CSS modules and component-level CSS
- Auth/DB/Storage: Supabase (`@supabase/supabase-js@^2`)
- Realtime voice: `agora-rtc-sdk-ng`
- AI: OpenAI / Anthropic (configurable per-function)
- Payments: Stripe + Razorpay
- Build/Tooling: npm, TypeScript, ESLint (CRA defaults)

---

## 3. Repository Layout

```
/media/shubham/OS/for linux work/Aura_Ai_backend-main/
  package.json
  tsconfig.json
  src/
    context/AuthContext.tsx
    pages/*.tsx
    components/*.tsx
    utils/*.ts
    supabaseClient.js
  supabase/
    config.toml
    functions/*/index.ts
  public/
```

Important frontend files:
- `src/context/AuthContext.tsx`: Central user session + subscription state.
- `src/pages/ChatPage.tsx`: Chat UI, supabase function integration, TTS playback.
- `src/pages/PaymentSuccessPage.tsx`: Post-payment polling and redirect.
- `src/utils/TTSPlayer.ts`: Stream TTS audio and playback controls.
- `src/supabaseClient.js`: Supabase client init from environment.

---

## 4. Environment Configuration

Frontend expects the following environment variables (CRA format):

- `REACT_APP_SUPABASE_URL` — Supabase Project URL
- `REACT_APP_SUPABASE_ANON_KEY` — Supabase anon key (public)

Supabase Edge Functions require these secrets (set in Supabase → Settings → Edge Functions → Secrets):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `APP_SITE_URL` — site/base URL for redirects
- Payment: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SIGNING_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- AI: `OPENAI_API_KEY` (and optionally Anthropic key by name configured in DB)
- Astro API: `VEDICASTRO_API_KEY`
- Agora: `AGORA_APP_ID`, `AGORA_CUSTOMER_ID`, `AGORA_CUSTOMER_SECRET`

Example template: `.env.example`

---

## 5. Supabase Configuration

### 5.1 Database (key tables)
- `public.users` (app-level user data): `id`, `plan_tier` ('free'|'monthly'|'yearly'), `coin_balance`, `gateway_customer_id`
- `public.users_subscriptions`: `user_id`, `status`, `current_period_end`
- `public.user_profiles`: `id`, `user_id`, `name`
- `public.user_birth_details`: `profile_id`, `date_of_birth`, `time_of_birth`, `birth_lat`, `birth_lng`, `timezone_offset`, `birth_place`
- `public.profile_astro_data`: `profile_id`, `chart_data`, `processed_tables`, `analyst_report`, `last_generated_at`
- `public.vectored_astro_data`: `profile_id`, `content`, `embedding`
- `public.chat_history`: `id`, `profile_id`, `user_id`, `role`, `message_content`, `language`, `tts_content`, `feedback`
- `public.daily_data_log`: `profile_id`, `last_generated_date`
- `public.system_prompts`: `prompt_name`, `prompt_text`, `api_provider`, `model_name`, `secret_name`, `is_active`
- `public.prices`: Per-region pricing metadata used by `create-payment-session`

Note: SQL schema is managed outside this repo; ensure columns match function queries.

### 5.2 RLS Policies (high level)
- Users can only `SELECT`/`UPDATE` rows for their own `auth.uid()` where applicable.
- Functions that update cross-user state use the `SERVICE_ROLE` key server-side (Edge Functions).

---

## 6. Edge Functions (Supabase)

All functions are in `supabase/functions/*/index.ts`. CORS headers are centralized in `_shared/cors.ts`.

- `get-location-and-plans` — Resolve country/currency, return plans.
- `create-payment-session` — Creates Stripe or Razorpay session, manages gateway customer linkage.
- `create-customer-portal-session` — Returns Stripe/Razorpay portal URL for self-serve management.
- `stripe-webhook` — Processes key Stripe events (e.g., `checkout.session.completed`, `invoice.payment_succeeded/failed`, `customer.subscription.deleted`), updates DB.
- `razorpay-webhook` — Processes Razorpay events (`payment.captured`, `subscription.cancelled/ halted`), updates DB.
- `reset-user-tier` — Resets `plan_tier` to `free` for authenticated user (uses fixed env names `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- `get-chat-answer` — Core chat pipeline:
  - Verifies auth and coin logic.
  - Ensures daily data freshness (invokes `generate-daily-astro-data` when stale).
  - RAG: embeds question, retrieves context via `match_astro_chunks` RPC over `vectored_astro_data`.
  - Selects AI provider/model from `system_prompts` with fallback.
  - 4-layer resilient JSON parsing for structured answer.
  - Persists `chat_history` (user + assistant messages).
- `generate-astro-data` — Fetches and normalizes full natal data from VedicAstro API, saves `profile_astro_data`, generates vector chunks to `vectored_astro_data` (OpenAI embeddings).
- `generate-daily-astro-data` — Computes/refreshes daily data slice; maintains `daily_data_log`.
- `generate-personalized-questions` — Produces tailored question sets driven by prompts and processed tables.
- `generate-tts` — Produces TTS audio stream for responses.
- `transcribe-audio` — Whisper-based speech-to-text for audio uploads.
- `initiate-ai-call` — Validates subscription, formats prompt from `processed_tables`, fetches system prompt, and starts voice session logic.
- `generate-agora-token` / `manage-agora-ai` — Token generation and agent lifecycle support.
- `submit-call-feedback` / `update-message-feedback` — Secure writes with user ownership checks.
- `cache-planet-transits` — Periodic planet transit caching from external API.

Configuration: `supabase/config.toml` sets `verify_jwt` and import maps per function.

---

## 7. Frontend Architecture

### 7.1 Routing
- Declared in `src/App.tsx` using `react-router-dom` 7
- Protected routes guarded by `components/ProtectedRoute`

### 7.2 Auth & State
- `AuthContext.tsx` initializes session from Supabase, tracks:
  - `isSubscribed`, `planTier`, `coinBalance`, `subscriptionStatus`, `currentPeriodEnd`, `userProfiles`
  - Refresh on visibility change and auth state changes

### 7.3 Chat Flow (`src/pages/ChatPage.tsx`)
- Loads profiles and recent chats.
- On send:
  - Calls `get-chat-answer` with `profile_id`, `question_text`, `client_date`.
  - Handles coin deduction UX and TTS playback.
  - Supports message-level feedback via `update-message-feedback`.

### 7.4 Payment Success UX (`src/pages/PaymentSuccessPage.tsx`)
- Polls `refreshUserStatus` for up to ~30 seconds after redirect.
- Redirects to dashboard on subscription activation.

---

## 8. Payments

- Region detection via `get-location-and-plans` determines gateway and currency.
- `create-payment-session` creates checkout sessions and ensures `gateway_customer_id` is stored.
- Customer portals via `create-customer-portal-session`.
- Webhooks (`stripe-webhook`, `razorpay-webhook`) are the source of truth for subscription changes.

Important: Webhook functions should be deployed with `--no-verify-jwt` and secured via signing secrets.

---

## 9. AI & RAG Details

- Embeddings: OpenAI `text-embedding-3-small`.
- Vector store: `vectored_astro_data(embedding)`; retrieval via SQL RPC `match_astro_chunks`.
- Dynamic prompts: `system_prompts` table controls provider (`openai`|`anthropic`), model, and secret name.
- Safety: 4-layer parser (JSON.parse → greedy → jsonrepair → AI fallback) ensures structured output.

---

## 10. Running Locally

Prerequisites: Node 18+ (tested on 22.x), npm.

1) Configure env:
- Copy `.env.example` → `.env` and set real values for `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`.
- Set Supabase Edge Function secrets in the dashboard.

2) Install and run:
```
npm install
npm start
```

3) Build:
```
npm run build
```

---

## 11. Deployment

- Frontend: Deploy CRA build artifacts (`build/`) to static hosting (Vercel/Netlify/S3+CloudFront etc.).
- Supabase functions:
```
# Example critical functions
supabase functions deploy get-location-and-plans --no-verify-jwt --use-api
supabase functions deploy create-payment-session --no-verify-jwt --use-api
supabase functions deploy create-customer-portal-session --use-api
supabase functions deploy stripe-webhook --no-verify-jwt --use-api
supabase functions deploy razorpay-webhook --no-verify-jwt --use-api
supabase functions deploy reset-user-tier --use-api
```
- Update Supabase Auth → URL Configuration `Site URL` to your production domain.

---

## 12. Security & Compliance

- RLS on all user-owned data tables.
- Webhooks verified via signing secrets.
- Service role keys used only server-side in Edge Functions.
- CORS is explicitly allowed via `_shared/cors.ts`; scope to your domain in production if needed.
- No secrets in the frontend; only anon key.

---

## 13. Observability

- Function logs: Supabase Dashboard → Logs → Edge Functions.
- Client errors: browser console + network inspector.
- Add HTTP structured logs in functions for critical paths (payments, AI).

---

## 14. Troubleshooting

- Auth not persisting: Confirm `Site URL` and redirect settings in Supabase Auth.
- Payment success not reflected: Check gateway webhook delivery & function logs; verify DB update.
- Chat coin deduction issues: Inspect `users.coin_balance` updates and `get-chat-answer` early exits.
- Timezone errors: Ensure `user_birth_details.timezone_offset` is set; `generate-astro-data` requires it.
- 401s from functions: Ensure `Authorization: Bearer <access_token>` is forwarded (handled automatically in `supabase.functions.invoke`).

---

## 15. Notable Implementation Details

- `reset-user-tier`: Fixed env names — uses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` consistently.
- `get-chat-answer`: On-demand daily data generation trigger (`generate-daily-astro-data`) based on `daily_data_log` and `client_date` passed from client.
- `generate-astro-data`: Regenerates vectors per profile after normalization; avoids stale RAG results.
- `ChatPage.tsx`: Streams TTS via `generate-tts`, safe playback lifecycle, and first-assistant message voice prompt UX.

---

## 16. Roadmap / Extension Points

- Add per-locale content and voices for TTS.
- Add admin analytics dashboards (subscriptions, usage, retention).
- Introduce retries and dead-letter handling for webhook processing.
- Add rate-limiting on chat endpoints.

---

## 17. Contacts & Ownership

- Backend/Edge Functions: Supabase team (Edge Functions + SQL), AI Integration owner.
- Frontend: React team.
- Payments: Billing & Compliance.

End of document.

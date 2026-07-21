# AGENTS.md — AuraAI

Guide for AI coding agents working in this repository. This is a full-stack app despite the
folder name: a React frontend (`src/`) backed by Supabase (Postgres, Auth, Edge Functions) in
`supabase/`. Domain: Vedic astrology platform with AI chat, voice calls, and subscriptions.

For deep architectural detail (DB schema, edge function flows, quirks, troubleshooting), see
`CLAUDE.md` in the repo root — it's a comprehensive existing guide and this file avoids
duplicating it. Read `CLAUDE.md` first for anything non-trivial.

## Tech Stack

- Frontend: React 19, TypeScript 4.9, React Router v7, styled-components
- Build tooling: Create React App via `react-app-rewired` (webpack overrides in `config-overrides.js`, needed for `buffer`/`crypto-browserify`/`stream-browserify`/`process` polyfills)
- Backend: Supabase (Postgres, Auth, Edge Functions on Deno/TypeScript)
- Voice/calls: Ultravox (default) or Agora (`agora-rtc-sdk-ng`), Gemini live calls (`@google/genai`)
- AI: OpenAI (embeddings + chat), Gemini
- Payments: Stripe (global) + Razorpay (India), routed by geolocation
- Analytics/CRM: Amplitude, CleverTap, Firebase

## Project Structure

```
src/
  App.tsx, index.tsx           entry points
  supabaseClient.js            Supabase client init
  firebaseClient.ts, clevertapClient.ts   3rd-party client setup
  context/                     AuthContext.tsx (auth/coins/subscription state), PricingContext.tsx
  pages/                       route-level pages (ChatPage, AdminPage, ProfileDashboardPage, ...)
  components/                  UI components (+ components/admin/ subfolder)
  hooks/                       useCallProvider, useAdminOperations, useMsg91Otp, etc.
  utils/                       AgoraManager, CustomCallManager (Ultravox), GeminiLiveManager, TTSPlayer, subscription.ts
  constants/                   languages.ts, msg91.ts, theme.ts

supabase/
  config.toml
  migrations/                  30+ SQL migration files (baseline: 20250930093646_remote_schema.sql)
  functions/                   30+ Deno Edge Functions (get-chat-answer, create-payment-session, stripe-webhook, ...)
```

Root also contains many one-off `.md`/`.sql` files documenting past fixes/debugging
(e.g. `PRICE_ID_LOGIC_FIX.md`, `AGORA_DEBUGGING_GUIDE.md`, `RAZORPAY_SETUP.md`). These are
historical notes, not living conventions — don't treat them as current instructions unless
verified against the actual code.

## Commands

```bash
npm install          # install deps
npm start            # dev server → http://localhost:3000 (react-app-rewired start)
npm run build        # production build (react-app-rewired build)
npm test             # Jest + React Testing Library (react-app-rewired test)
```

No dedicated lint script; ESLint runs inline via CRA (`extends: ["react-app", "react-app/jest"]`)
during start/build.

Edge Functions are deployed via Supabase CLI, not npm:
```bash
supabase functions deploy <function-name>                 # JWT-verified functions
supabase functions deploy <function-name> --no-verify-jwt  # webhooks (stripe-webhook, razorpay-webhook)
```

## Environment Variables

Frontend vars live in `.env` (copy from `.env.example`): `REACT_APP_SUPABASE_URL`,
`REACT_APP_SUPABASE_ANON_KEY`, `REACT_APP_ULTRAVOX_AGENT_ID`, `REACT_APP_STRIPE_PUBLISHABLE_KEY`,
`REACT_APP_CLEVERTAP_ACCOUNT_ID`, `REACT_APP_CLEVERTAP_REGION`, `REACT_APP_SW_DEV`,
`REACT_APP_AMPLITUDE_API_KEY`.

Backend secrets are set via Supabase Dashboard → Edge Functions → Secrets (not in `.env`):
`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SIGNING_SECRET`,
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `OPENAI_API_KEY`,
`VEDICASTRO_API_KEY`, `AGORA_APP_ID`, `AGORA_CUSTOMER_ID`, `AGORA_CUSTOMER_SECRET`.

**Note:** a populated `.env` exists in the repo root. Never echo its values or commit it —
treat all keys in it as secrets, referenced by name only.

## Architecture Notes

- Auth: Google OAuth via Supabase, JWT auto-attached to requests, global state in
  `src/context/AuthContext.tsx`. Admin access = DB flag `is_admin` OR hardcoded email allowlist
  in `AuthContext.tsx` (either grants admin — check both when debugging admin issues).
- Database access: no ORM — direct Supabase JS client queries plus Postgres RPC functions
  (`match_astro_chunks`, `update_user_subscription`, `get_recent_chats`,
  `upsert_increment_counter_normalized`). RLS policies gate access via `auth.uid()`.
- Chat flow: message → `get-chat-answer` edge function → OpenAI embedding → RAG search
  (`match_astro_chunks`) → AI completion → saved to `chat_history` → returns
  `{ answer, tts_content, language }`.
- Voice calls: dual-provider abstraction (Ultravox default, or Agora), selectable via
  `provider_settings` table or admin UI; real-time coin deduction via `deduct-call-coins`.
- Payments: geolocation-routed — India → Razorpay, else Stripe. Webhooks verify HMAC signatures
  before calling `update_user_subscription` RPC.
- Coin balance is cached in-memory in `AuthContext` — call `updateCoinBalance()` after
  deductions, or `refreshUserStatus()` for a full refresh. Don't assume it's live from the DB.

## Known Issues / Tech Debt

- Dasha dates from the VedicAstro API are `DD/MM/YYYY`, not ISO — parse explicitly
  (`date.split('/').map(Number)`, remember JS months are 0-indexed).

## Working Conventions

- Match existing patterns: functional React components with hooks, styled-components for
  styling, Supabase client calls via `supabase.functions.invoke(...)` or direct table queries.
- Edge functions are plain Deno `Deno.serve()` handlers, one per folder under
  `supabase/functions/`, each with its own `index.ts`.
- Schema changes go through new files in `supabase/migrations/`, not manual DB edits.
- Before making claims about DB schema, RPCs, or edge function behavior, check the actual
  migration files / function source rather than relying solely on `CLAUDE.md`, since it may
  drift from the code over time.
- Do NOT write comments in code. Keep the code itself clean and self-explanatory (use clear
  names) — no explanatory, sectioning, or "why" comments in the files you edit or create.
  Put any explanation in your chat response instead, not in the code.

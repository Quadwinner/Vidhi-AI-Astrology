# Supabase Edge Functions ("Fire Codes") Documentation

This document provides a technical deep-dive into the server-side logic of AuraAI. These functions run on the Supabase Edge Runtime (Deno).

## 1. Core Call System (Agora & AI)

### `initiate-ai-call`
**Endpoint:** `POST /initiate-ai-call`
**Description:** The primary router for starting voice calls. It abstracts the provider selection logic from the client.
- **Input:** `{ "profile_id": "uuid", "provider": "agora" | "custom" }`
- **Logic:**
  1. Verifies user authentication.
  2. Fetches the user profile.
  3. Checks if the `provider` is valid (currently enforces 'agora').
  4. Invokes `initiate-agora-call` to handle the specific setup.
- **Output:** Returns the payload from the specific provider function (e.g., Agora channel name, token).

### `manage-agora-ai`
**Endpoint:** `POST /manage-agora-ai`
**Description:** Responsible for connecting the AI agent to the Agora channel.
- **Critical Update:** This function now uses **OpenAI Realtime MLLM**. It does *not* use separate STT/TTS providers anymore. It connects directly to OpenAI's Realtime WebSocket via Agora.
- **Input:** `{ "channelName": "string", "systemPrompt": "string", "token": "string" }`
- **Output:** Success status of the Agora Agent API call.

### `start-call`
**Endpoint:** `POST /start-call`
**Description:** The "handshake" that begins a session reference.
- **Input:** `{ "profile_id": "uuid" }`
- **Logic:**
  1. Creates a new row in `call_logs` with status 'active'.
  2. Records the `started_at` timestamp.
  3. Returns the `call_log_id` which acts as the session key for all subsequent billing and logging.
- **Output:** `{ "call_log_id": "uuid", "coins_per_minute": 20 }`

### `end-call`
**Endpoint:** `POST /end-call`
**Description:** Official termination of a call session.
- **Input:** `{ "call_log_id": "uuid", "final_duration": number, "status": "completed" }`
- **Logic:**
  1. Updates `call_logs` with the final duration and status.
  2. Performs a final coin balance verification (though `deduct-call-coins` handles the bulk).
  3. Triggers any post-call analytics events.

### `submit-call-feedback`
**Endpoint:** `POST /submit-call-feedback`
**Description:** User sentiment data collection.
- **Input:** `{ "profile_id": "uuid", "rating": number, "comments": "string" }`
- **Logic:**
  1. Stores the rating in a dedicated feedback table.
  2. If rating < 3, may trigger an alert to the admin (via Slack/Email webhook).

### `deduct-call-coins`
**Endpoint:** `POST /deduct-call-coins`
**Description:** The billing engine. Called periodically during an active call.
- **Input:** `{ "call_log_id": "uuid", "duration_seconds": number }`
- **Logic:**
  1. Locks the user's wallet row.
  2. Calculates cost based on the user's plan/location price per minute.
  3. Deducts coins.
  4. **Critical:** If balance hits 0, returns `force_end: true` to signal the client to hang up immediately.

---

## 2. Astrology & AI Engine

### `generate-astro-data`
**Description:** The "Brain" of the astrology system.
- **Logic:**
  1. calls `VedicAstroAPI` to get planetary positions (Rasi, Navamsa).
  2. Formats this data into a JSON structure.
  3. Uses `OpenAI` or `Anthropic` (depending on config) to generate a textual interpretation of the chart/generate reports.
  4. Caches the result in Supabase Storage to avoid re-calculating for the same profile.

### `get-chat-answer`
**Description:** The Chatbot RAG pipeline.
- **Input:** `{ "message": "string", "history": [...] }`
- **Logic:**
  1. Fetches the user's birth chart from the database.
  2. Retrieves relevant astrological rules from the `rulebook` vector store (if enabled) or JSON file.
  3. Constructs a massive system prompt containing:
     - User's Birth Chart
     - Current Planetary Transits
     - The User's Question
  4. Streams the LLM response back to the client.

---

## 3. Payments (Stripe/Razorpay)

### `get-location-and-plans`
**Description:** Dynamic Pricing Engine.
- **Logic:**
  1. Uses GeoIP to detect user country.
  2. If India -> Returns INR plans (Razorpay).
  
### `razorpay-webhook`
**Description:** Payment Confirmation.
- **Logic:**
  1. Validates the webhook signature (security critical).
  2. Identifies the `order_id`.
  3. Updates `users` table:
     - Adds coins.
     - Updates `subscription_status` to 'active'.
     - Sets `subscription_end_date`.

### `cancel-subscription`
**Endpoint:** `POST /cancel-subscription`
**Description:** Churn management.
- **Input:** `{ "subscription_id": "string", "reason": "string" }`
- **Logic:**
  1. Interfaces with Stripe/Razorpay API to cancel the recurring billing.
  2. Updates the local `users` table to set `subscription_status` to 'canceled' (effective at period end).

---

## 4. Notifications & User Sync

### `sync-user-to-clevertap`
**Description:** CRM Sync
- **Logic:** Pushes data to CleverTap whenever a user updates their profile or performs an action. This allows for targeted campaigns (e.g., "You haven't checked your horoscope in 3 days!").

### `send-whatsapp-campaign`
**Description:** Marketing
- **Logic:** Interfaces with Interakt or Twilio API to send template-based WhatsApp messages. Used for retention and re-engagement.

### `send-web-push-campaign`
**Endpoint:** `POST /send-web-push-campaign`
**Description:** Browser Notification Broadcast.
- **Input:** `{ "title": "string", "body": "string", "target_url": "string" }`
- **Logic:**
  1. Fetches all valid push subscriptions from the database.
  2. Uses `web-push` library to blast the payload.
  3. Handles 410 Gone errors (removing expired subscriptions automatically).

### `get-daily-analytics`
**Endpoint:** `POST /get-daily-analytics`
**Description:** Executive Dashboard Data.
- **Input:** `{ "date": "YYYY-MM-DD" }`
- **Logic:**
  1. Aggregates `call_logs`, `coin_transactions`, and `users` tables.
  2. Returns specific metrics: "DAU" (Daily Active Users), "Total Revenue", "Average Call Duration".

### `admin-operations`
**Endpoint:** `POST /admin-operations`
**Description:** The "God Mode" function for the Admin Dashboard.
- **Input:** `{ "operation": "search_users" | "add_coins" | "ban_user", "payload": {...} }`
- **Logic:**
  1. **Strict Auth Check:** Verifies the caller has `is_admin: true` in their metadata.
  2. Executes privileged SQL queries that are blocked by RLS (Row Level Security) for normal users.
  3. Used for support tickets (e.g., refunding coins manually).

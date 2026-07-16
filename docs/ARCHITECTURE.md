# System Architecture Overview

## High-Level Design
AuraAI is a **Serverless, Real-time Astrology Application** that combines traditional Vedic calculation engines with modern Generative AI to provide personalized insights.

### Core Stack
- **Frontend:** React (Vite) + TypeScript.
- **Backend:** Supabase (PostgreSQL + Edge Functions + Realtime + Storage).
- **AI/LLM:** OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet), Gemini (Flash 2.0).
- **Real-time Comms:** Agora (WebRTC Audio/Video).
- **Payments:** Razorpay (India) + Stripe (International).

---

## Data Flow: Voice Call
1. **User** clicks "Call Astrologer".
2. **Frontend** calls `initiate-ai-call`.
3. **Edge Function** validates balance and routes to `initiate-agora-call`.
4. **Backend** generates an **Agora Token** and returns it.
5. **Frontend** joins the Agora Channel.
6. **Backend** (`manage-agora-ai`) spins up an AI Agent in the *same* channel using **OpenAI Realtime API**.
7. **Conversation** happens via WebRTC (Low Latency).
8. **Billing** happens in background (`deduct-call-coins` runs every 60s).

## Data Flow: Chat
1. **User** sends a text message.
2. **Frontend** calls `get-chat-answer`.
3. **Edge Function** fetches:
   - User's Birth Chart (Cached in DB).
   - Current Planetary Transits (Global Table).
   - Astrology Rulebook (Storage/Vector).
4. **LLM** generates a response based on this context.
5. **Response** is streamed back to the user.

## Database Schema Highlights
- **`users`**: Core identity, wallet balance, subscription status.
- **`user_profiles`**: Supports multiple profiles (self, partner, kids) per user.
- **`profile_astro_data`**: Stores the heavy JSON output of calculations to avoid re-fetching external APIs.
- **`call_logs`**: History of all calls, duration, and cost.
- **`global_planet_transits`**: Single source of truth for "Where are the planets right now?".

---

## Architecture Diagram (Mermaid)

```mermaid
graph TD
    User[User (React App)]
    
    subgraph "Supabase / Backend"
        Auth[Auth (Gotrue)]
        DB[(PostgreSQL)]
        Storage[File Storage]
        Edge[Edge Functions (Deno)]
    end
    
    subgraph "External Services"
        OpenAI[OpenAI / Gemini]
        Agora[Agora WebRTC]
        Vedic[VedicAstroAPI]
        Payment[Stripe/Razorpay]
    end

    User -->|Login| Auth
    User -->|Read/Write| DB
    User -->|API Calls| Edge
    
    Edge -->|Fetch Charts| Vedic
    Edge -->|Generate Text| OpenAI
    Edge -->|Process Payment| Payment
    
    User <-->|Voice Stream| Agora
    Edge -->|Manage Agent| Agora
    Agora <-->|Realtime Audio| OpenAI
```

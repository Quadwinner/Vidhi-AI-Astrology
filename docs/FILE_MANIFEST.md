# File Manifest & Documentation

This document provides a comprehensive overview of the codebase, detailing the purpose and functionality of each file.

## Frontend: React Application (`src/`)

#### Pages (`src/pages/`)
- **`src/pages/HomePage.tsx`**
  - **Purpose:** The main landing page.
  - **Details:** Handles fetching plans based on user location (via `get-location-and-plans`), displaying features, testimonials, and subscription options. Manages `auth` flow through `HeroSection`. Also handles "Pending Kundli Profile" creation if a user starts on the landing page.

- **`src/pages/ChatPage.tsx`**
  - **Purpose:** The core chat interface.
  - **Details:** Manages the chat session, `chat_history`, and real-time streaming of AI responses (`get-chat-answer`). Features include:
    - **Call Integration:** Launches `CustomAgoraCallScreen` when a call is initiated.
    - **Compatibility Mode:** Handles "Partner Details" widget and queries `get-compatibility-report`.
    - **Wallet Integration:** Optimistically deducts coins for questions and handles "Insufficient Funds" states.
    - **Sticky Context:** Remembers the active partner for compatibility chats.

- **`src/pages/ProfileDashboardPage.tsx`**
  - **Purpose:** User profile management hub.
  - **Details:** Lists all "Saved Profiles" (family/friends). Allows adding/editing profiles. Displays the "Upgrade for Profiles" modal if limits are reached.

- **`src/pages/WalletPage.tsx`**
  - **Purpose:** Dedicated wallet recharge page.
  - **Details:** Renders the `WalletRecharge` component to allow users to buy more coins.

- **`src/pages/SubscriptionManagementPage.tsx`**
  - **Purpose:** Manage active subscriptions.
  - **Details:** Allows users to view their current plan status and cancel subscriptions via the `cancel-subscription` edge function.


- **`src/pages/AdminPage.tsx`**
  - **Purpose:** Super-admin dashboard.
  - **Details:** Provides analytics (users, revenue), allows managing system prompts, and configuration settings.

- **`src/pages/ReportsPage.tsx`**
  - **Purpose:** Displays generated astrological reports.
  - **Details:** Lists available reports (Life, Career, Love) and allows users to unlock them using wallet.

- **`src/pages/DebugPage.tsx`**
  - **Purpose:** Developer utility.
  - **Details:** Used for testing notifications, deep links, and other internal features.

#### Hooks (`src/hooks/`)
- **`src/hooks/useCallProvider.ts`**
  - **Purpose:** Call provider configuration.
  - **Details:** Fetches the `default_call_provider` setting from Supabase. Defaults to 'agora' if not found. Subscribes to real-time updates for this setting.

- **`src/hooks/useAdminOperations.ts`**
  - **Purpose:** Admin data fetching and mutations.
  - **Details:** Encapsulates logic for exporting data (JSON/CSV), fetching analytics stats, and bulk updating users. tries `admin-operations` edge function first, falls back to direct DB queries.

- **`src/hooks/useNotificationPermission.ts`**
  - **Purpose:** Web Push Notification management.
  - **Details:** Manages browser permission request logic (CleverTap integration).

- **`src/hooks/useLoadScript.ts`**
  - **Purpose:** dynamic script loading.
  - **Details:** Used to load third-party SDKs like Razorpay lazily.

#### Components (`src/components/`)
*Detailed breakdown of props, state, and logic for key components.*

- **`src/components/AICallScreen.tsx`** (formerly `CustomAgoraCallScreen`)
  - **Purpose:** The main interface for an active Voice Call.
  - **Props:**
    - `profile`: `EnrichedProfile` object containing user details.
    - `onCallEnded`: Function to trigger when the call finishes.
  - **State:**
    - `callState`: 'connecting' | 'active' | 'error'.
    - `view`: 'call' (active call UI) | 'feedback' (post-call rating).
    - `isMuted`: Boolean toggling microphone status.
    - `callDuration`: Integer (seconds) for the on-screen timer.
  - **Key Logic:**
    - **Initialization:** Calls `start-call` (DB log) -> `initiate-ai-call` (Get Token) -> `AgoraManager.connectCall`.
    - **Billing Loop:** Uses `setInterval` (60s) to call `deduct-call-coins`. If bills fail or coins run out, it forces `handleEndCall`.
    - **Cleanup:** Ensures `disconnectCall` is called on unmount to prevent lingering connections.

- **`src/components/CallFeedback.tsx`**
  - **Purpose:** Post-call modal for user ratings.
  - **Props:** `profileName`, `onSubmit`, `onClose`.
  - **State:** `rating` (1-5), `comments` (text).
  - **Logic:** Submits data to `submit-call-feedback` edge function.

- **`src/components/ChatInput.tsx`**
  - **Purpose:** The input bar at the bottom of the Chat Page.
  - **Props:**
    - `onSendMessage`: Function to handle text submission.
    - `isLoading`: Disables input while AI is thinking.
    - `isPremiumUser`, `onUpgrade`, `onStartCall`.
  - **State:**
    - `currentInput`: The text being typed.
    - `isRecording`: Boolean for Whisper voice recording state.
    - `micState`: 'idle' | 'listening' | 'confirm'.
  - **Logic:**
    - **Text:** Standard form submission.
    - **Voice:** Uses `WhisperManager` to record audio, send to `transcribe-audio`, and populate the text field with the result.

- **`src/components/SubscriptionModal.tsx`**
  - **Purpose:** The "Upgrade Plan" popup.
  - **Props:** `isOpen`, `onClose`.
  - **State:** `plans` (array of prices), `activePlanId` (currently selected).
  - **Logic:**
    - **GeoIP:** Fetches user location to decide if `plans` should be INR (Razorpay) or USD (Stripe).
    - **Razorpay Integration:** Loads script dynamically. On `handleSubscribe`, opens Razorpay modal. On success, calls `supabase.from('users').upsert` to activate the plan immediately.

- **`src/components/HeroSection.tsx`**
  - **Purpose:** First screen users see on Home Page.
  - **Props:** `user`, `onGoogleSignIn`, `phoneAuth` handlers.
  - **Logic:**
    - Checks if `user` exists. If yes, shows "Start Chat". If no, shows "Login/Signup".
    - `HeroAnimation.tsx`: Renders the 3D interactive background.

- **`src/components/AuthModal.tsx`**
  - **Purpose:** Central login popup.
  - **Props:** `isOpen`, `onClose`, `phoneAuth` handlers.
  - **State:** `view` ('options' | 'phone_input' | 'otp_input').
  - **Logic:**
    - **Google:** Triggers Firebase Google Auth.
    - **Phone:** Uses `requestPhoneOtp` (Supabase or Msg91) -> `verifyOtp`. On success, updates global `AuthContext`.

- **`src/components/WalletRecharge.tsx`**
  - **Purpose:** Coin purchase component (embedded in WalletPage).
  - **Props:** None (uses `AuthContext`).
  - **State:** `packages` (list of coin bundles).
  - **Logic:**
    - Fetches packages from `coin_packages` table.
    - Similar payment flow to SubscriptionModal (Razorpay integration).

- **`src/components/AstrologyChart.tsx`**
  - **Purpose:** Renders the SVG Birth Chart.
  - **Props:** `svgString` (raw SVG from API), `title`.
  - **Logic:**
    - **Sanitization:** Removes "out of calls" error text if present.
    - **Theming:** Replaces black text with white (for dark mode).
    - **Scaling:** Increases font size of planetary labels for readability using Regex.

- **`src/components/AiInsightsDisplay.tsx`**
  - **Purpose:** Renders the Markdown text of an astrology report.
  - **Props:** `reportContent` (string).
  - **Logic:** Uses `react-markdown` to safely render headers, lists, and bold text from the AI response.

- **`src/components/KundliSection.tsx`**
  - **Purpose:** "Free Kundli" form on public pages.
  - **Logic:**
    - Captures birth details (Date, Time, Place).
    - Saves to `sessionStorage`.
    - Redirects to Login. After login, `HomePage` checks storage and creates the profile automatically.

#### UI Elements & Widgets
- **`src/components/LoadingSpinner.tsx`**: Standard SVG spinner for async states.
- **`src/components/LoadingPage.tsx`**: Full-screen loader with "Aura" branding.
- **`src/components/ConfirmationModal.tsx`**: Generic "Are you sure?" dialog used for destructive actions (deleting profiles, ending calls).
- **`src/components/CustomSelect.tsx`**: Styled Dropdown component used in forms (Gender, Status).
- **`src/components/DateScrollPicker.tsx`**: iOS-style scrollable date picker for mobile-friendly birth date input.
- **`src/components/Footer.tsx`**: Application footer with legal links and social icons.

#### Astrology Specifics
- **`src/components/AstroDataTables.tsx`**: Displays tabular planetary data (Degrees, Retrograde status).
- **`src/components/DashaTable.tsx`**: Renders the Vimshottari Dasha timeline.
- **`src/components/CompatibilityProfileForm.tsx`**: Form for adding a partner's details for Matchmaking usage.
- **`src/components/BirthDetailsForm.tsx`**: Reusable form for collecting Name/Date/Time/Place.

### Data & Content (`src/data/`)
- **`src/data/AstroDataTables.content.ts`**: Static definitions for table headers and column mappings for astrology views.
- **`src/data/faq.ts`**: Hardcoded JSON list of FAQ items for the landing page.
- **`src/data/testimonials.ts`**: Static user reviews showcased on the Home Page.

### Hooks (`src/hooks/`)

### Other Utilities
### Context (`src/context/`)
- **`src/context/AuthContext.tsx`**
  - **Purpose:** The central nervous system for User State.
  - **Details:**
    - Manages `session`, `user` object, and `wallet_balance`.
    - Handles **Login flows**: Google OAuth, Firebase Phone Auth, and MSG91 OTP.
    - **AB Testing:** Assigns `pricingVariant` ('control' vs 'test') for A/B experiments.
    - **CleverTap:** Syncs user login events to the CRM.
    - **Logic:** continuously monitors `supabase.auth.onAuthStateChange` to keep local state in sync with the server.

- **`src/context/PricingContext.tsx`**
  - **Purpose:** Dynamic Pricing Logic.
  - **Details:**
    - Fetches the correct `coins_per_minute` and subscription plans based on the user's `pricingVariant`.
    - Used by `SubscriptionModal` to display the correct currency (USD/INR/EUR) and price points.

### Utilities (`src/utils/`)
- **`src/utils/AgoraManager.ts`**
  - **Purpose:** Wrapper for the Agora Web SDK.
  - **Details:**
    - `connectCall(systemPrompt)`: Joins the RTC channel and instructs the AI agent to join.
    - `addAgoraEventListeners()`: Subscribes to remote audio streams (the AI).
    - `disconnectCall()`: Cleanly leaves channel and destroys local microphone tracks to prevent memory leaks.

- **`src/utils/analytics.ts`**
  - **Purpose:** Unified Analytics Dispatcher.
  - **Details:** `trackEvent(name, props)` sends events to **Amplitude** (Product Analytics) and **CleverTap** (Marketing CRM) simultaneously. Handles environment checks (dev vs prod).

- **`src/utils/WhisperManager.ts`**
  - **Purpose:** Voice Recording for Chat.
  - **Details:** Uses `MediaRecorder` content to capture audio blobs. Sends them to the `transcribe-audio` edge function for OpenAI Whisper transcription.

- **`src/utils/GeminiLiveManager.ts`**
  - **Purpose:** WebSocket Client for Gemini.
  - **Details:** Manages the direct WebSocket connection to Google's Gemini Multimodal Live API. Handles audio buffering and rate limiting.

### Admin Dashboard (`src/components/admin/`)
- **`src/components/admin/DailyAnalytics.tsx`**
  - **Purpose:** High-level metrics view.
  - **Details:** Fetches aggregated data (DAU, Revenue, Call Minutes) via `get-daily-analytics`. Renders charts/tables for business health monitoring.

- **`src/components/admin/CampaignManager.tsx`**
  - **Purpose:** WhatsApp Marketing Tool.
  - **Details:** Allows admins to select a template, upload a CSV of phone numbers, and trigger `send-whatsapp-campaign`.

- **`src/components/admin/WebPushCampaignManager.tsx`**
  - **Purpose:** Browser Notification Tool.
  - **Details:** Broadcasts push notifications to all subscribed users via `send-web-push-campaign`.

- **`src/components/admin/ProviderSettingsManager.tsx`**
  - **Purpose:** Call Provider Switches.
  - **Details:** UI to toggle the `default_call_provider` (Agora vs others). Currently hardcoded to enforce Agora but allows DB-level overrides.


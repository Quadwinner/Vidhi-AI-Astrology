# AuraAI Mobile App - React Native Expo Build Guide

A comprehensive guide to building an Android APK for AuraAI using React Native and Expo, while reusing the existing Supabase backend infrastructure.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture Differences: Web vs Mobile](#architecture-differences-web-vs-mobile)
4. [Project Setup](#project-setup)
5. [Environment Configuration](#environment-configuration)
6. [Project Structure](#project-structure)
7. [Authentication Implementation](#authentication-implementation)
8. [Reusing Backend Edge Functions](#reusing-backend-edge-functions)
9. [Component Migration Strategy](#component-migration-strategy)
10. [Voice Call Implementation](#voice-call-implementation)
11. [Payment Integration](#paymentintegration)
12. [Building the APK](#building-the-apk)
13. [Testing](#testing)
14. [Common Issues & Solutions](#common-issues--solutions)
15. [Deployment Checklist](#deployment-checklist)

---

## Overview

This guide helps you create a React Native mobile app using Expo that:
- **Shares the same Supabase backend** (database, auth, Edge Functions)
- **Reuses all existing Edge Function endpoints** (no backend changes needed!)
- **Maintains feature parity** with the web app
- **Builds as a standalone Android APK**

**Key Advantage:** No backend changes needed! All 30+ Edge Functions work as-is.

---

## Prerequisites

### Required Software

```bash
# Node.js (v18+ recommended, same as web app)
node --version

# npm (already installed)
npm --version

# Expo CLI (global installation)
npm install -g expo-cli

# EAS CLI for cloud builds (recommended)
npm install -g eas-cli

# Optional: Android Studio for local builds
# Download from: https://developer.android.com/studio
```

### Accounts Needed

- **Expo Account**: Sign up at https://expo.dev (free tier sufficient)
- **Google Play Console**: For publishing to Play Store ($25 one-time fee)
- **Supabase Project**: ✅ Already have this (no changes needed)
- **Payment Gateways**: ✅ Already configured (Stripe, Razorpay)

### Knowledge Requirements

- React Native basics (similar to React web)
- Expo workflow (managed vs bare)
- Mobile-specific considerations (permissions, navigation)
- Understanding of your existing web codebase

---

## Architecture Differences: Web vs Mobile

### What Stays the Same ✅

**Backend Infrastructure (100% reusable):**
- ✅ Supabase PostgreSQL database
- ✅ All 30+ Edge Functions (get-chat-answer, create-ultravox-call, etc.)
- ✅ Row-level security policies
- ✅ Authentication system (Google OAuth)
- ✅ Database schema, triggers, and RPCs
- ✅ Payment webhooks (Stripe, Razorpay)
- ✅ VedicAstro API integration
- ✅ OpenAI/Gemini AI integrations

**Business Logic (100% reusable):**
- ✅ Chat RAG pipeline
- ✅ Voice call integration
- ✅ Subscription management
- ✅ Coin deduction logic
- ✅ User counters and triggers

### What Changes ❌

**Frontend Technology:**

| Component | Web | Mobile (React Native) |
|-----------|-----|----------------------|
| **Rendering** | React DOM | React Native |
| **UI Components** | HTML (div, button, input) | Native (View, Text, TextInput) |
| **Styling** | CSS/styled-components | StyleSheet/styled-components/native |
| **Routing** | React Router v7 | React Navigation |
| **Storage** | localStorage | AsyncStorage / SecureStore |
| **Audio** | HTML5 Audio/MediaSource | expo-av |
| **OAuth** | Popup redirect | Deep linking + WebBrowser |
| **WebRTC** | Browser native | react-native-webrtc / Agora RN SDK |
| **Payments** | Stripe Checkout (redirect) | Stripe React Native SDK |

**Platform-Specific Adaptations:**

| Feature | Web Implementation | Mobile Alternative | Notes |
|---------|-------------------|-------------------|-------|
| **Google OAuth** | Popup redirect | Deep linking + expo-web-browser | Requires URL scheme config |
| **Audio Playback** | HTML5 Audio | expo-av | For TTS playback |
| **File Storage** | localStorage | AsyncStorage (data) + SecureStore (tokens) | Different APIs |
| **Voice Calls** | Browser WebRTC | Agora RN SDK (recommended) | Better mobile support |
| **Payments** | Stripe Checkout page | Stripe Payment Sheet | Native modal |
| **Push Notifications** | Web Push API | expo-notifications | Better reliability |

---

## Project Setup

### Step 1: Initialize Expo Project

```bash
# Create a separate directory for mobile app
# (Keep it separate from web app, but can be in same repo)
cd "/media/OS/for linux work"
mkdir Aura_Ai_mobile
cd Aura_Ai_mobile

# Initialize Expo app with TypeScript template
npx create-expo-app@latest . --template expo-template-blank-typescript

# Verify installation
npx expo --version
```

### Step 2: Initialize EAS for Cloud Builds

```bash
# Login to Expo (create account if needed)
eas login

# Initialize EAS in your project
eas init

# This creates:
# - eas.json (build configuration)
# - Updates app.json with project ID
```

### Step 3: Install Core Dependencies

```bash
# Supabase client (same as web)
npm install @supabase/supabase-js@^2

# Navigation (React Navigation is the standard)
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context

# Authentication & OAuth
npx expo install expo-auth-session expo-crypto expo-web-browser

# Secure storage for auth tokens
npx expo install expo-secure-store

# Audio playback (for TTS)
npx expo install expo-av

# Environment variables
npm install react-native-dotenv
npm install -D @types/react-native-dotenv

# AsyncStorage for data persistence
npm install @react-native-async-storage/async-storage

# Toast notifications
npm install react-native-toast-message

# Analytics (Amplitude - same as web)
npm install @amplitude/analytics-react-native

# Payment SDKs
npm install @stripe/stripe-react-native

# For Razorpay (if targeting India)
# Note: Requires custom dev client or bare workflow
# npm install react-native-razorpay
```

### Step 4: Configure TypeScript

Create/update `tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "jsx": "react-native",
    "types": ["react-native", "@types/react"]
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

Create `babel.config.js` for environment variables:

```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',
      }]
    ]
  };
};
```

---

## Environment Configuration

### Step 1: Create `.env` File

```bash
# In Aura_Ai_mobile directory
touch .env
```

**`.env` contents (copy from web app `.env`):**

```env
# Supabase (SAME AS WEB APP)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OAuth Redirect (MOBILE-SPECIFIC)
EXPO_PUBLIC_REDIRECT_URL=auraai://oauth-callback

# Stripe (mobile publishable key - same as web)
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Razorpay (if using)
RAZORPAY_KEY_ID=rzp_live_...

# Amplitude Analytics (same as web)
AMPLITUDE_API_KEY=your_amplitude_key
```

### Step 2: Configure `app.json`

```json
{
  "expo": {
    "name": "AuraAI",
    "slug": "auraai-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "scheme": "auraai",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.auraai"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.yourcompany.auraai",
      "permissions": [
        "CAMERA",
        "RECORD_AUDIO",
        "MODIFY_AUDIO_SETTINGS",
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "VIBRATE"
      ],
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "auraai",
              "host": "oauth-callback"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 21,
            "compileSdkVersion": 34,
            "targetSdkVersion": 34,
            "enableProguardInReleaseBuilds": true
          }
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id-from-eas-init"
      }
    }
  }
}
```

**Important:** The `scheme` and `intentFilters` are critical for OAuth to work!

### Step 3: Configure EAS Build (`eas.json`)

The `eas build:configure` command created this file. Update it:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

**Build Types:**
- `development`: For testing with custom dev client
- `preview`: APK for internal testing (use this for most testing)
- `production`: Final APK for Play Store or direct distribution

---

## Project Structure

Recommended file structure (mirrors web app structure):

```
Aura_Ai_mobile/
├── app.json
├── eas.json
├── package.json
├── tsconfig.json
├── babel.config.js
├── .env
├── .gitignore
│
├── App.tsx                    # Root component (entry point)
│
├── src/
│   ├── config/
│   │   └── supabase.ts       # Supabase client (adapted from web)
│   │
│   ├── context/
│   │   └── AuthContext.tsx   # Global auth state (adapted from web)
│   │
│   ├── navigation/
│   │   ├── RootNavigator.tsx      # Main navigation container
│   │   ├── AuthNavigator.tsx      # Auth flow (login, signup)
│   │   └── AppNavigator.tsx       # Main app (tabs/stack)
│   │
│   ├── screens/               # Page-level components (like web pages/)
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── OnboardingScreen.tsx
│   │   │
│   │   ├── chat/
│   │   │   ├── ChatScreen.tsx         # Main chat (from web ChatPage.tsx)
│   │   │   └── VoiceCallScreen.tsx    # Voice call UI
│   │   │
│   │   ├── profile/
│   │   │   ├── ProfileListScreen.tsx
│   │   │   ├── CreateProfileScreen.tsx
│   │   │   └── ProfileDetailsScreen.tsx
│   │   │
│   │   ├── reports/
│   │   │   └── ReportsScreen.tsx      # Astro data reports
│   │   │
│   │   ├── subscription/
│   │   │   └── SubscriptionScreen.tsx
│   │   │
│   │   └── account/
│   │       └── AccountScreen.tsx
│   │
│   ├── components/            # Reusable UI components
│   │   ├── chat/
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── TTSPlayer.tsx
│   │   │
│   │   ├── subscription/
│   │   │   ├── PlanCard.tsx
│   │   │   ├── CoinBalance.tsx
│   │   │   └── SubscriptionModal.tsx
│   │   │
│   │   ├── profile/
│   │   │   └── ProfileCard.tsx
│   │   │
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── Modal.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts         # Auth context hook (from web)
│   │   └── useCallProvider.ts # Call provider hook (from web)
│   │
│   ├── services/              # API layer (calls Edge Functions)
│   │   ├── api.ts             # Generic Edge Function caller
│   │   ├── auth.service.ts    # Auth operations
│   │   ├── chat.service.ts    # Chat operations
│   │   ├── voice.service.ts   # Voice call operations
│   │   ├── payment.service.ts # Payment operations
│   │   └── profile.service.ts # Profile CRUD
│   │
│   ├── utils/
│   │   ├── storage.ts         # AsyncStorage/SecureStore helpers
│   │   ├── analytics.ts       # Amplitude integration
│   │   └── helpers.ts
│   │
│   ├── types/
│   │   └── index.ts           # TypeScript interfaces (can copy from web)
│   │
│   └── constants/
│       ├── theme.ts           # Colors, fonts, spacing
│       └── config.ts
│
└── assets/                    # Images, fonts
    ├── icon.png
    ├── splash.png
    └── adaptive-icon.png
```

---

## Authentication Implementation

### Step 1: Supabase Client Setup

```typescript
// src/config/supabase.ts
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

// Custom storage adapter for mobile (replaces localStorage)
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

// Same interface as web, different storage
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Mobile doesn't use URL detection
    },
  }
);
```

### Step 2: Google OAuth for Mobile

```typescript
// src/services/auth.service.ts
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../config/supabase';
import { EXPO_PUBLIC_REDIRECT_URL } from '@env';

// Required for OAuth flow
WebBrowser.maybeCompleteAuthSession();

export const signInWithGoogle = async () => {
  try {
    // Step 1: Get OAuth URL from Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: EXPO_PUBLIC_REDIRECT_URL,
        skipBrowserRedirect: true, // We'll handle the browser ourselves
      },
    });

    if (error) throw error;

    // Step 2: Open in-app browser for OAuth
    const result = await WebBrowser.openAuthSessionAsync(
      data.url, // Google OAuth URL
      EXPO_PUBLIC_REDIRECT_URL // Where to return
    );

    // Step 3: Parse tokens from redirect URL
    if (result.type === 'success') {
      const url = result.url;
      // URL format: auraai://oauth-callback#access_token=xxx&refresh_token=yyy
      const params = new URLSearchParams(url.split('#')[1]);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        // Step 4: Set session in Supabase client
        const { data: sessionData, error: sessionError } =
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

        if (sessionError) throw sessionError;
        return sessionData;
      }
    }

    throw new Error('OAuth flow was cancelled or failed');
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};
```

### Step 3: Configure Supabase OAuth Redirect

1. Go to Supabase Dashboard
2. Navigate to: **Authentication → URL Configuration**
3. Add redirect URL: `auraai://oauth-callback`

### Step 4: AuthContext (Mobile Version)

```typescript
// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { signInWithGoogle as googleSignIn, signOut as authSignOut } from '../services/auth.service';

interface UserProfile {
  id: string;
  name: string;
  created_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  isSubscribed: boolean;
  coinBalance: number | null;
  planTier: 'free' | 'monthly' | 'yearly' | null;
  userProfiles: UserProfile[] | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserStatus: () => Promise<void>;
  updateCoinBalance: (newBalance: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [planTier, setPlanTier] = useState<'free' | 'monthly' | 'yearly' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [userProfiles, setUserProfiles] = useState<UserProfile[] | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        refreshUserStatus();
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        refreshUserStatus();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshUserStatus = async () => {
    if (!user) return;

    try {
      // Fetch user data from users table (SAME AS WEB)
      const { data: userData, error } = await supabase
        .from('users')
        .select('coin_balance, plan_tier, is_admin, subscription_status')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setCoinBalance(userData?.coin_balance ?? 0);
      setPlanTier(userData?.plan_tier ?? 'free');
      setIsAdmin(userData?.is_admin ?? false);
      setIsSubscribed(userData?.plan_tier !== 'free');

      // Fetch user profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setUserProfiles(profiles || []);
    } catch (error) {
      console.error('Error refreshing user status:', error);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    await googleSignIn();
  };

  const signOut = async () => {
    await authSignOut();
    setSession(null);
    setUser(null);
    setCoinBalance(null);
    setPlanTier(null);
    setIsAdmin(false);
    setIsSubscribed(false);
    setUserProfiles(null);
  };

  const updateCoinBalance = (newBalance: number) => {
    setCoinBalance(newBalance);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isAdmin,
        isSubscribed,
        coinBalance,
        planTier,
        userProfiles,
        loading,
        signInWithGoogle,
        signOut,
        refreshUserStatus,
        updateCoinBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

---

## Reusing Backend Edge Functions

### Generic API Service

```typescript
// src/services/api.ts
import { supabase } from '../config/supabase';

interface EdgeFunctionOptions {
  functionName: string;
  body?: any;
  method?: 'POST' | 'GET';
}

/**
 * Generic Edge Function caller
 * Works exactly the same as web app
 */
export const callEdgeFunction = async <T = any>({
  functionName,
  body,
  method = 'POST',
}: EdgeFunctionOptions): Promise<T> => {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      method,
    });

    if (error) throw error;
    return data as T;
  } catch (error) {
    console.error(`Error calling ${functionName}:`, error);
    throw error;
  }
};
```

### Chat Service (Reuses get-chat-answer Edge Function)

```typescript
// src/services/chat.service.ts
import { callEdgeFunction } from './api';

interface ChatAnswerRequest {
  profile_id: string;
  question_text: string;
  client_date: string;
}

interface ChatAnswerResponse {
  answer: string;
  tts_content: string;
  language: string;
}

export const getChatAnswer = async (
  request: ChatAnswerRequest
): Promise<ChatAnswerResponse> => {
  // Calls existing Edge Function - no changes needed!
  return callEdgeFunction<ChatAnswerResponse>({
    functionName: 'get-chat-answer',
    body: request,
  });
};

export const generateTTS = async (text: string, language: string) => {
  return callEdgeFunction({
    functionName: 'generate-tts',
    body: { text, language },
  });
};

export const updateMessageFeedback = async (
  messageId: string,
  feedback: 'like' | 'dislike'
) => {
  return callEdgeFunction({
    functionName: 'update-message-feedback',
    body: { message_id: messageId, feedback },
  });
};
```

### Voice Call Service

```typescript
// src/services/voice.service.ts
import { callEdgeFunction } from './api';

export const createUltravoxCall = async (
  systemPrompt: string,
  chartDetails: any,
  profileName: string
) => {
  return callEdgeFunction({
    functionName: 'create-ultravox-call',
    body: {
      systemPrompt,
      chartDetails,
      profileName,
      vedicAstrologyRulebook: '', // Load from storage or API
    },
  });
};

export const initiateAgoraCall = async (profileId: string) => {
  return callEdgeFunction({
    functionName: 'initiate-agora-call',
    body: { profile_id: profileId },
  });
};

export const endCall = async (
  callLogId: string,
  finalDuration: number,
  status: string
) => {
  return callEdgeFunction({
    functionName: 'end-call',
    body: {
      call_log_id: callLogId,
      final_duration: finalDuration,
      status,
    },
  });
};

export const deductCallCoins = async (
  callLogId: string,
  coinsToDeduct: number
) => {
  return callEdgeFunction({
    functionName: 'deduct-call-coins',
    body: {
      call_log_id: callLogId,
      coins_to_deduct: coinsToDeduct,
    },
  });
};
```

### Payment Service

```typescript
// src/services/payment.service.ts
import { callEdgeFunction } from './api';

export const getLocationAndPlans = async () => {
  return callEdgeFunction({
    functionName: 'get-location-and-plans',
    body: {},
  });
};

export const createPaymentSession = async (
  priceId: string,
  userId: string
) => {
  return callEdgeFunction({
    functionName: 'create-payment-session',
    body: { price_id: priceId, user_id: userId },
  });
};

export const cancelSubscription = async () => {
  return callEdgeFunction({
    functionName: 'cancel-subscription',
    body: {},
  });
};
```

---

## Component Migration Strategy

### Example: Chat Screen (Mobile Version)

```typescript
// src/screens/chat/ChatScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { getChatAnswer } from '../../services/chat.service';
import { supabase } from '../../config/supabase';
import ChatMessage from '../../components/chat/ChatMessage';
import ChatInput from '../../components/chat/ChatInput';
import CoinBalance from '../../components/subscription/CoinBalance';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  message_content: string;
  created_at: string;
}

export default function ChatScreen({ route, navigation }: any) {
  const { profileId } = route.params;
  const { user, coinBalance, updateCoinBalance } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadChatHistory();
  }, [profileId]);

  const loadChatHistory = async () => {
    // SAME QUERY AS WEB APP
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    // Add user message immediately (optimistic update)
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      message_content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    setLoading(true);
    try {
      // SAME EDGE FUNCTION AS WEB APP
      const response = await getChatAnswer({
        profile_id: profileId,
        question_text: text,
        client_date: new Date().toISOString().split('T')[0],
      });

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        message_content: response.answer,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update coin balance (same logic as web)
      if (coinBalance !== null) {
        updateCoinBalance(coinBalance - 1);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <CoinBalance balance={coinBalance} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatMessage message={item} />}
        contentContainerStyle={styles.messageList}
        inverted={false}
      />

      <ChatInput onSend={handleSendMessage} disabled={loading} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  messageList: {
    padding: 16,
  },
});
```

---

## Voice Call Implementation

### Recommended: Agora RTC for React Native

```bash
# Install Agora React Native SDK
npm install react-native-agora

# Or use Agora UI Kit (easier)
npm install agora-rn-uikit
```

```typescript
// src/screens/chat/VoiceCallScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AgoraUIKit from 'agora-rn-uikit';
import { initiateAgoraCall, endCall } from '../../services/voice.service';

export default function VoiceCallScreen({ route, navigation }: any) {
  const { profileId } = route.params;
  const [callData, setCallData] = useState<any>(null);
  const [videoCall, setVideoCall] = useState(true);

  useEffect(() => {
    startCall();
  }, []);

  const startCall = async () => {
    try {
      // SAME EDGE FUNCTION AS WEB
      const data = await initiateAgoraCall(profileId);
      setCallData(data);
    } catch (error) {
      console.error('Error starting call:', error);
    }
  };

  const callbacks = {
    EndCall: async () => {
      if (callData?.call_log_id) {
        // SAME EDGE FUNCTION AS WEB
        await endCall(callData.call_log_id, 120, 'completed');
      }
      setVideoCall(false);
      navigation.goBack();
    },
  };

  if (!callData) {
    return (
      <View style={styles.container}>
        <Text>Connecting...</Text>
      </View>
    );
  }

  return videoCall ? (
    <AgoraUIKit
      connectionData={{
        appId: callData.app_id,
        channel: callData.channel_name,
        token: callData.token,
      }}
      rtcCallbacks={callbacks}
      settings={{
        enableAudio: true,
        enableVideo: false, // Audio-only for astrology calls
      }}
    />
  ) : (
    <View style={styles.container}>
      <Text>Call Ended</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
```

---

## Payment Integration

### Stripe React Native SDK

```bash
npm install @stripe/stripe-react-native
```

```typescript
// src/screens/subscription/SubscriptionScreen.tsx
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { createPaymentSession } from '../../services/payment.service';
import { useAuth } from '../../hooks/useAuth';
import { STRIPE_PUBLISHABLE_KEY } from '@env';

export default function SubscriptionScreen() {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <SubscriptionContent />
    </StripeProvider>
  );
}

function SubscriptionContent() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user, refreshUserStatus } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (priceId: string) => {
    setLoading(true);
    try {
      // You may need to modify create-payment-session to return client_secret
      const { clientSecret } = await createPaymentSession(
        priceId,
        user?.id!
      );

      // Initialize Payment Sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'AuraAI',
      });

      if (initError) throw initError;

      // Present Payment Sheet
      const { error } = await presentPaymentSheet();

      if (error) {
        console.error('Payment error:', error);
      } else {
        console.log('Payment successful');
        await refreshUserStatus();
      }
    } catch (error) {
      console.error('Subscription error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Your Plan</Text>
      <Button
        title="Subscribe Monthly - $9.99"
        onPress={() => handleSubscribe('price_monthly_id')}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});
```

---

## Building the APK

### Method 1: EAS Build (Recommended - Cloud Build)

```bash
# Step 1: Ensure you're logged in
eas login

# Step 2: Build preview APK (for testing)
eas build --platform android --profile preview

# This will:
# - Upload your code to Expo servers
# - Build APK in the cloud (takes 10-20 minutes)
# - Provide download link when done

# Step 3: Download APK
# Visit: https://expo.dev/accounts/[your-account]/projects/auraai-mobile/builds
# Or scan QR code to install directly on device

# For production build:
eas build --platform android --profile production
```

**Build Output:**
- `preview` profile: Generates APK (for direct install)
- `production` profile: Generates APK or AAB (for Play Store)

**Monitoring Build:**
- Real-time logs in terminal
- Or visit Expo dashboard: https://expo.dev

### Method 2: Local Build (Advanced)

```bash
# Requires Android Studio and Android SDK installed

# Build locally
eas build --platform android --local --profile preview

# Or use Expo CLI (development build only)
npx expo run:android --variant release
```

### Build Optimization Tips

1. **Enable Hermes (Faster JavaScript execution):**

   In `app.json`:
   ```json
   {
     "expo": {
       "android": {
         "jsEngine": "hermes"
       }
     }
   }
   ```

2. **Enable Proguard (Code minification):**

   Already configured in the `app.json` example above via `enableProguardInReleaseBuilds: true`

3. **Optimize Images:**
   ```bash
   # Use optimized PNG/JPEG
   # Keep icon.png at 1024x1024
   # Keep splash.png at recommended size
   ```

---

## Testing

### Development Testing

```bash
# Method 1: Expo Go app (limited, doesn't support all native modules)
npx expo start

# Scan QR code with Expo Go app on Android device

# Method 2: Development build (recommended, supports all modules)
npx expo run:android

# This installs custom dev client on connected device
```

### Preview APK Testing

```bash
# After building with EAS
# Download APK from Expo dashboard
# Install on Android device:

# Via USB:
adb install path/to/build.apk

# Or send APK file to device and install manually
```

### Feature Testing Checklist

- [ ] **Authentication:**
  - [ ] Google OAuth login works
  - [ ] Session persists after app restart
  - [ ] Logout clears session

- [ ] **Chat:**
  - [ ] Send message → get response
  - [ ] Chat history loads
  - [ ] Coin balance updates after message
  - [ ] TTS plays (if implemented)

- [ ] **Profiles:**
  - [ ] Create new profile
  - [ ] View profile list
  - [ ] Switch between profiles

- [ ] **Voice Calls:**
  - [ ] Initiate call
  - [ ] Audio works both ways
  - [ ] End call properly
  - [ ] Coins deducted during call

- [ ] **Subscription:**
  - [ ] View plans
  - [ ] Payment flow works
  - [ ] Subscription activates after payment
  - [ ] Cancelled subscription reflected in UI

- [ ] **Offline Handling:**
  - [ ] App doesn't crash when offline
  - [ ] Shows appropriate error messages

---

## Common Issues & Solutions

### Issue 1: OAuth Redirect Not Working

**Symptoms:**
- After Google login, browser closes but app doesn't authenticate
- "OAuth flow cancelled" error

**Solution:**
```bash
# 1. Verify scheme in app.json
"scheme": "auraai"

# 2. Verify intentFilters in app.json
"intentFilters": [
  {
    "action": "VIEW",
    "data": [{ "scheme": "auraai", "host": "oauth-callback" }]
  }
]

# 3. Add redirect URL to Supabase Dashboard:
# Authentication → URL Configuration → Redirect URLs
# Add: auraai://oauth-callback

# 4. Test deep link manually:
adb shell am start -W -a android.intent.action.VIEW -d "auraai://oauth-callback#access_token=test"

# 5. Rebuild app after app.json changes
eas build --platform android --profile preview
```

### Issue 2: Edge Functions Return 401 Unauthorized

**Symptoms:**
- Chat, voice calls fail with 401
- "Unauthorized" or "JWT verification failed"

**Solution:**
```typescript
// Verify session is being sent
const session = await supabase.auth.getSession();
console.log('Session:', session.data.session?.access_token);

// Supabase client auto-attaches Authorization header
// No need to manually add it

// If still fails, check if token expired:
await supabase.auth.refreshSession();
```

### Issue 3: App Crashes on Startup

**Symptoms:**
- White screen or immediate crash

**Solution:**
```bash
# 1. Check logs
adb logcat | grep -i "ReactNative"

# 2. Common causes:
# - Missing environment variables (.env not loaded)
# - Native module not linked (rebuild app)
# - Incompatible package version

# 3. Clear cache and rebuild
rm -rf node_modules
npm install
eas build --platform android --profile preview --clear-cache
```

### Issue 4: Voice Calls Not Connecting

**Symptoms:**
- Call screen shows "Connecting..." indefinitely
- No audio

**Solution:**
```bash
# 1. Check permissions in app.json
"permissions": [
  "RECORD_AUDIO",
  "MODIFY_AUDIO_SETTINGS"
]

# 2. Request permissions at runtime (if needed)
import { PermissionsAndroid } from 'react-native';
await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);

# 3. Test on physical device (emulators may not support audio)

# 4. Verify Agora credentials
console.log('Agora call data:', callData);
```

### Issue 5: Payment Not Working

**Symptoms:**
- Payment sheet doesn't open
- Payment succeeds but subscription not activated

**Solution:**
```typescript
// 1. Verify Stripe publishable key
console.log('Stripe key:', STRIPE_PUBLISHABLE_KEY);

// 2. Ensure create-payment-session returns client_secret
// (May need to modify Edge Function for mobile)

// 3. Check webhook is firing
// Supabase Dashboard → Edge Functions → stripe-webhook logs

// 4. Test with Stripe test mode first
// Use test card: 4242 4242 4242 4242
```

### Issue 6: Build Fails on EAS

**Symptoms:**
- EAS build fails with dependency errors

**Solution:**
```bash
# 1. Check build logs on Expo dashboard

# 2. Common fixes:
# - Remove incompatible packages
# - Use --clear-cache flag
eas build --platform android --profile preview --clear-cache

# 3. Check eas.json configuration
# 4. Ensure all native modules are compatible with Expo
```

---

## Deployment Checklist

### Pre-Build Checklist

- [ ] **Environment Variables:**
  - [ ] All production keys in `.env`
  - [ ] Supabase URL and anon key
  - [ ] Stripe/Razorpay keys
  - [ ] Amplitude API key

- [ ] **App Configuration:**
  - [ ] Update version in `app.json`
  - [ ] Set correct package name (`com.yourcompany.auraai`)
  - [ ] Configure app icon (1024x1024 PNG)
  - [ ] Configure splash screen
  - [ ] Set permissions correctly

- [ ] **Feature Testing:**
  - [ ] All core features work (auth, chat, calls, payments)
  - [ ] No console errors
  - [ ] Offline handling works

- [ ] **Performance:**
  - [ ] Enable Hermes
  - [ ] Enable Proguard
  - [ ] Optimize images

### Production Build Checklist

- [ ] **Build APK:**
  ```bash
  eas build --platform android --profile production
  ```

- [ ] **Testing:**
  - [ ] Test on multiple devices (different Android versions)
  - [ ] Test with real payment (small amount)
  - [ ] Verify all Edge Functions work in production

- [ ] **Analytics:**
  - [ ] Amplitude tracking works
  - [ ] Error tracking set up (Sentry recommended)

### Google Play Store Checklist

- [ ] **Prepare Store Listing:**
  - [ ] App name and description
  - [ ] Screenshots (phone and tablet)
  - [ ] Feature graphic (1024x500)
  - [ ] Privacy policy URL

- [ ] **Upload:**
  - [ ] Create app in Play Console
  - [ ] Upload AAB (not APK for Play Store)
  - [ ] Set pricing (free)
  - [ ] Configure in-app purchases (if applicable)

- [ ] **Submit for Review:**
  - [ ] Complete all required fields
  - [ ] Submit for internal testing first
  - [ ] Then submit for production

### Post-Launch Checklist

- [ ] **Monitor:**
  - [ ] Crash reports (Play Console)
  - [ ] Supabase Edge Function logs
  - [ ] User reviews

- [ ] **Updates:**
  - [ ] Plan regular updates
  - [ ] Increment version in `app.json`
  - [ ] Build and submit via EAS

---

## Summary

### What You've Accomplished

✅ **Full mobile app** using React Native and Expo
✅ **Reused 100% of backend** (Supabase, Edge Functions)
✅ **Maintained feature parity** with web app
✅ **Standalone Android APK** ready for distribution

### Key Takeaways

1. **No Backend Changes:** All 30+ Edge Functions work as-is
2. **Service Layer Pattern:** Clean separation between UI and API
3. **Auth Flow:** Mobile OAuth requires deep linking setup
4. **Voice Calls:** Agora RN SDK recommended over WebRTC
5. **Payments:** Stripe Payment Sheet for mobile
6. **Build Process:** EAS Build simplifies cloud builds
7. **Testing:** Always test on physical devices

### Next Steps

1. **Complete mobile UI:** Migrate remaining screens from web
2. **Test thoroughly:** Edge cases, offline, errors
3. **Build and test:** Preview APK on multiple devices
4. **Polish:** Animations, loading states, error handling
5. **Deploy:** Submit to Play Store or distribute APK directly

### Resources

- **Expo Docs:** https://docs.expo.dev
- **React Navigation:** https://reactnavigation.org
- **Supabase JS Client:** https://supabase.com/docs/reference/javascript
- **Agora RN SDK:** https://docs.agora.io/en/video-calling/get-started/get-started-sdk?platform=react-native
- **Stripe RN:** https://stripe.dev/stripe-react-native

---

**Good luck building your AuraAI mobile app!** 🚀

Remember: You're reusing a proven backend. Focus on making the mobile UX great!

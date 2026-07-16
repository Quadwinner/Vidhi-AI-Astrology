// --- FINAL VERSION: GPT-4o Realtime MLLM ---
// This version uses Agora's MLLM feature with OpenAI's Realtime API for an integrated ASR, LLM, and TTS experience.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Helper function to require environment variables
function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Server configuration error: Missing required secret '${name}'`);
  }
  return value;
}

// Standard response helpers
function ok(data: any): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function err(msg: string): Response {
  return ok({ error: msg });
}

console.log("Loading 'manage-agora-ai' function (v-Final: OpenAI Realtime MLLM)...");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let channelName: string | undefined;

  try {
    // 1. Environment Validation (REMOVED: MICROSOFT_TTS_KEY is no longer needed)
    const APP_ID = requireEnv('AGORA_APP_ID');
    const CUSTOMER_ID = requireEnv('AGORA_CUSTOMER_ID');
    const CUSTOMER_SECRET = requireEnv('AGORA_CUSTOMER_SECRET');
    const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY_CALL');

    // 2. Request Parsing (REMOVED: 'gender' field is no longer used)
    const requestBody = await req.json();
    channelName = requestBody.channelName;
    const systemPrompt = requestBody.systemPrompt;
    const token = requestBody.token;

    if (!channelName || !systemPrompt || !token) {
      const missing = [!channelName && "channelName", !systemPrompt && "systemPrompt", !token && "token"].filter(Boolean).join(", ");
      return err(`Missing required parameters: ${missing}`);
    }

    // 3. API and Auth Setup
    const agoraApiUrl = `https://api.agora.io/api/conversational-ai-agent/v2/projects/${APP_ID}/join`;
    const authHeader = `Basic ${btoa(`${CUSTOMER_ID}:${CUSTOMER_SECRET}`)}`;
    const agentName = `aura-agent-${channelName}-${Date.now()}`;

    // 4. Construct the Request Body with the new MLLM block
    const startBody = {
      "name": agentName,
      "properties": {
        "channel": channelName,
        "token": token,
        "agent_rtc_uid": "0",
        "remote_rtc_uids": ["*"],
        "idle_timeout": 120,

        // NEW: Advanced features block to enable MLLM
        "advanced_features": {
          "enable_mllm": true
        },

        // NEW: MLLM block replaces the old 'llm' and 'tts' blocks
        "mllm": {
          "vendor": "openai",
          "style": "openai",
          "url": "wss://api.openai.com/v1/realtime",
          "api_key": OPENAI_API_KEY,
          "max_history": 32,
          // Greeting message in Hindi for an Indian accent
          "greeting_message": "मैं औरा एआई हूँ, बताइए आज मैं आपकी कैसे सहायता कर सकती हूँ?",
          "output_modalities": ["text", "audio"],
          "params": {
            "model": "gpt-realtime",
            // You can experiment with different voices like 'alloy', 'echo', 'onyx', 'shimmer' etc.
            "voice": "sage",
            "instructions": systemPrompt, // Use the system prompt from the request
            "input_audio_transcription": {
              // Set language to Hindi for better transcription accuracy
              "language": "hi",
              "model": "gpt-4o-mini-transcribe"
            }
          }
        }
        // REMOVED: The entire 'asr', 'llm', and 'tts' blocks are now replaced by 'mllm'.
      }
    };

    // 5. Send the request to Agora's API
    console.log(`[manage-agora-ai] Sending POST request to Agora API (using OpenAI Realtime MLLM)`);
    const response = await fetch(agoraApiUrl, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(startBody),
    });

    // 6. Handle the response
    if (response.ok) {
      const responseData = await response.json();
      console.log(`[manage-agora-ai] Success for channel: ${channelName}`);
      return ok({ success: true, data: responseData });
    } else {
      const errorBody = await response.text();
      console.error(`[manage-agora-ai] Agora API Error`, {
        channel_name: channelName,
        status: response.status,
        error_body: errorBody
      });
      return err(`Upstream error: Agora API failed with status ${response.status}`);
    }

  } catch (error) {
    console.error(`[CRITICAL ERROR] in manage-agora-ai: ${error.message}`);
    return err(error.message || 'An unexpected error occurred');
  }
});
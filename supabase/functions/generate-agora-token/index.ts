// --- FINAL, REFACTORED VERSION ---

import { RtcRole, RtcTokenBuilder } from "npm:agora-access-token";
// 1. Import the new wrapper function.
import { createCorsWrappedHandler, corsHeaders } from '../_shared/cors.ts';

// Helper functions for standardized error handling
function ok(data: any): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function err(msg: string): Response {
  return ok({ error: msg });
}

console.log("Loading 'generate-agora-token' function (v5 - Official Library)...");

// 2. Define your main logic inside a clean handler function.
async function handler(req: Request) {
  try {
    console.log("Received a new token generation request.");

    const APP_ID = Deno.env.get("AGORA_APP_ID");
    const APP_CERTIFICATE = Deno.env.get("AGORA_APP_CERTIFICATE");

    if (!APP_ID || !APP_CERTIFICATE) {
      console.error("❌ Missing Agora App ID or Certificate in Supabase secrets.");
      throw new Error("Server configuration error: Missing Agora credentials.");
    }

    const { channelName } = await req.json();
    if (!channelName) {
      console.error("❌ Bad Request: 'channelName' is required.");
      return err("'channelName' is required");
    }

    console.log(`Request received for channel: "${channelName}"`);
    
    const uid = 0;
    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    console.log("Building token with official Agora library...");

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      role,
      privilegeExpiredTs
    );

    console.log(`✅ Successfully generated valid token for channel "${channelName}".`);

    return ok({ token: token, appId: APP_ID });
    
  } catch (error) {
    console.error("❌ An unexpected error occurred during token generation:", error.message, error.stack);
    // Let the wrapper handle creating the final error response.
    throw error;
  }
}

// 3. Serve the main handler using the CORS wrapper.
Deno.serve(createCorsWrappedHandler(handler));
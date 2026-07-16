// File: supabase/functions/initiate-ai-call/index.ts
// This function acts as a router. The original Ultravox logic is preserved as the default path.
// If a request includes `provider: 'agora'`, it forwards the request to the dedicated `initiate-agora-call` function.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

// Helper functions for standardized error handling (from original file)
function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function getOrigin(req: Request): string {
  const fh = req.headers.get('x-forwarded-host');
  const fp = req.headers.get('x-forwarded-proto') || 'https';
  return fh ? `${fp}://${fh}` : new URL(req.url).origin;
}

function ok(data: any): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function err(msg: string): Response {
  return ok({ error: msg });
}

// --- Main Handler ---
async function handler(req: Request) {

  let user_id: string | undefined;
  let profile_id: string | undefined;

  try {
    // --- 1. COMMON SETUP: Authentication and Request Parsing ---
    const supabaseAdmin = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return err("Authentication failed: Missing Authorization header");
    }
    const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return err("Authentication failed: User not found");

    user_id = user.id;

    const requestBody = await req.json();
    profile_id = requestBody.profile_id;
    const provider = requestBody.provider; // Read the provider from the request
    if (!profile_id) return err("Missing profile_id");

    // --- 2. THE ROUTER LOGIC ---
    // If provider is explicitly 'agora' OR if no provider is specified (defaulting to Agora now), we route to Agora.
    // We are removing Ultravox support entirely.

    // --- AGORA PATH ---
    console.log(`[initiate-ai-call] Routing request to 'initiate-agora-call' for profile: ${profile_id}`);

    const { data, error } = await supabaseAdmin.functions.invoke(
      'initiate-agora-call',
      {
        body: { profile_id },
        headers: { Authorization: authHeader }
      }
    );

    if (error) {
      throw new Error(`Error invoking initiate-agora-call function: ${error.message}`);
    }

    console.log(`[initiate-ai-call] Successfully received response from 'initiate-agora-call'.`);
    return ok(data);

  } catch (error) {
    console.error(`[CRITICAL ERROR] in initiate-ai-call: ${error.message}`, {
      function_name: 'initiate-ai-call',
      user_id: user_id,
      profile_id: profile_id,
      error: error.message,
      stack: error.stack
    });
    return err(error.message || 'An unexpected error occurred');
  }
}

Deno.serve(createCorsWrappedHandler(handler));
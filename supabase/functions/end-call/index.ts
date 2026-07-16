// Edge Function: end-call
// Purpose: Finalize call log entry when call ends
// Called: When user manually ends call or call ends automatically

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

// --- CleverTap config ---
const CLEVERTAP_ACCOUNT_ID = Deno.env.get('CLEVERTAP_ACCOUNT_ID');
const CLEVERTAP_PASSCODE = Deno.env.get('CLEVERTAP_PASSCODE');
const CLEVERTAP_REGION = Deno.env.get('CLEVERTAP_REGION') || 'in1';
// For "global" region, use api.clevertap.com (no region prefix)
// For other regions, use {region}.api.clevertap.com
const CLEVERTAP_API_BASE = Deno.env.get('CLEVERTAP_API_BASE') || 
  (CLEVERTAP_REGION === 'global' 
    ? 'https://api.clevertap.com/1/upload'
    : `https://${CLEVERTAP_REGION}.api.clevertap.com/1/upload`);

async function trackCleverTapEvent(identity: string, evtName: string, evtData: Record<string, any>) {
  if (!CLEVERTAP_ACCOUNT_ID || !CLEVERTAP_PASSCODE) return;

  const payload = {
    d: [{ identity, type: 'event', evtName, evtData: { ...evtData, ts: Math.floor(Date.now() / 1000) } }],
  };

  try {
    await fetch(CLEVERTAP_API_BASE, {
      method: 'POST',
      headers: {
        'X-CleverTap-Account-Id': CLEVERTAP_ACCOUNT_ID,
        'X-CleverTap-Passcode': CLEVERTAP_PASSCODE,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('[end-call] CleverTap tracking error:', error);
  }
}

interface EndCallRequest {
  call_log_id: string;
  final_duration?: number;
  status?: 'completed' | 'interrupted' | 'insufficient_coins';
}

async function handler(req: Request): Promise<Response> {
  try {
    console.log('[end-call] Function invoked');

    // Parse request body
    const { call_log_id, final_duration, status }: EndCallRequest = await req.json();

    if (!call_log_id) {
      return new Response(
        JSON.stringify({ error: 'Missing call_log_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[end-call] Call log ID:', call_log_id);
    console.log('[end-call] Final duration:', final_duration);
    console.log('[end-call] Status:', status);

    // Initialize Supabase clients
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate user using Supabase Edge Function context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[end-call] Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract the JWT token from the Authorization header
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the JWT token and get user info
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      console.error('[end-call] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[end-call] User authenticated:', user.id);

    // Fetch call log
    const { data: callLog, error: callLogError } = await supabaseAdmin
      .from('call_logs')
      .select('*')
      .eq('id', call_log_id)
      .eq('user_id', user.id)
      .single();

    if (callLogError || !callLog) {
      console.error('[end-call] Call log not found:', callLogError);
      return new Response(
        JSON.stringify({ error: 'Call log not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If call is already ended, return success
    if (callLog.ended_at) {
      console.log('[end-call] Call already ended at:', callLog.ended_at);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Call already ended',
          call_log: callLog
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate final duration if not provided
    let finalDurationSeconds = final_duration;
    if (!finalDurationSeconds && callLog.started_at) {
      const startTime = new Date(callLog.started_at).getTime();
      const endTime = Date.now();
      finalDurationSeconds = Math.floor((endTime - startTime) / 1000);
    }

    // Determine final status
    const finalStatus = status || 'completed';

    // Update call log with end time and final status
    const { data: updatedCallLog, error: updateError } = await supabaseAdmin
      .from('call_logs')
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: finalDurationSeconds || callLog.duration_seconds,
        status: finalStatus
      })
      .eq('id', call_log_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('[end-call] Failed to update call log:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to finalize call log' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[end-call] Call log finalized:', updatedCallLog.id);
    console.log('[end-call] Final duration (seconds):', updatedCallLog.duration_seconds);
    console.log('[end-call] Total coins deducted:', updatedCallLog.coins_deducted);

    // Counter increment is now handled automatically by the database trigger
    // The trigger fires when ended_at is set, so no need to call RPC here
    const rawSeconds = Number(updatedCallLog.duration_seconds || 0);
    const minutes = rawSeconds > 0 ? Math.max(1, Math.ceil(rawSeconds / 60)) : 0;
    console.log('[end-call] Duration recorded:', rawSeconds, 'seconds =', minutes, 'minutes (trigger will increment counter)');

    // Track CleverTap event
    await trackCleverTapEvent(user.id, 'Voice Call Ended', {
      call_log_id: updatedCallLog.id,
      profile_id: updatedCallLog.profile_id,
      duration_seconds: rawSeconds,
      duration_minutes: minutes,
      coins_deducted: updatedCallLog.coins_deducted || 0,
      status: finalStatus,
      call_provider: updatedCallLog.call_provider
    });

    // Return success with finalized call log
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Call ended successfully',
        call_log: {
          id: updatedCallLog.id,
          duration_seconds: updatedCallLog.duration_seconds,
          coins_deducted: updatedCallLog.coins_deducted,
          status: updatedCallLog.status,
          started_at: updatedCallLog.started_at,
          ended_at: updatedCallLog.ended_at
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[end-call] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

Deno.serve(createCorsWrappedHandler(handler));


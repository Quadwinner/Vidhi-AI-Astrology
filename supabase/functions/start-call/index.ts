// Edge Function: start-call
// Purpose: Authorize a call based on Wallet Balance and create the call log.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

const CLEVERTAP_ACCOUNT_ID = Deno.env.get('CLEVERTAP_ACCOUNT_ID');
const CLEVERTAP_PASSCODE = Deno.env.get('CLEVERTAP_PASSCODE');
const CLEVERTAP_REGION = Deno.env.get('CLEVERTAP_REGION') || 'in1';
// For "global" region, use api.clevertap.com (no region prefix)
// For other regions, use {region}.api.clevertap.com
const CLEVERTAP_API_BASE = Deno.env.get('CLEVERTAP_API_BASE') || 
  (CLEVERTAP_REGION === 'global' 
    ? 'https://api.clevertap.com/1/upload'
    : `https://${CLEVERTAP_REGION}.api.clevertap.com/1/upload`);

// --- HELPER: CleverTap Tracking ---
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
    console.error('[start-call] CleverTap tracking error:', error);
  }
}

// --- HELPER: Wallet Check (Does NOT deduct, just verifies) ---
async function getPriceAndCheckBalance(supabaseAdmin: any, userId: string, serviceKey: string) {
  // 1. Get User's Currency & Balance
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('currency_code, wallet_balance')
    .eq('id', userId)
    .single();

  if (userError || !user) throw new Error(`User fetch failed: ${userError?.message}`);
  
  const currency = user.currency_code || 'USD'; 
  const currentBalance = user.wallet_balance || 0;

  // 2. Get Price for this Service + Currency.
  // Tolerant of duplicate rows: take the first match instead of .single()
  // (which errors when multiple rows exist for the same service/currency).
  const { data: priceRows, error: priceError } = await supabaseAdmin
    .from('service_prices')
    .select('price_amount')
    .eq('service_key', serviceKey)
    .eq('currency_code', currency)
    .order('price_amount', { ascending: true })
    .limit(1);

  if (priceError || !priceRows || priceRows.length === 0) {
    throw new Error(`Price configuration missing for ${serviceKey} in ${currency}`);
  }

  const costPerUnit = priceRows[0].price_amount;

  // 3. Balance Check
  if (currentBalance < costPerUnit) {
    return { success: false, required: costPerUnit, balance: currentBalance, currency };
  }

  return { success: true, cost: costPerUnit, balance: currentBalance, currency };
}

interface StartCallRequest {
  profile_id: string;
}

async function handler(req: Request): Promise<Response> {
  try {
    console.log('[start-call] Function invoked (Wallet Logic)');

    // --- 1. BOILERPLATE: Authentication ---
    const { profile_id }: StartCallRequest = await req.json();
    if (!profile_id) {
      return new Response(JSON.stringify({ error: 'Missing profile_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: 'Authentication failed' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    console.log('[start-call] User authenticated:', user.id);

    // --- 2. AUTHORIZATION CHECK: WALLET BALANCE ---
    // Check if user has enough for at least 1 minute of call
    
    const check = await getPriceAndCheckBalance(supabaseAdmin, user.id, 'voice_call_minute');

    if (!check.success) {
      await trackCleverTapEvent(user.id, 'Voice Call Blocked - Insufficient Funds', {
        profile_id,
        current_balance: check.balance,
        required_balance: check.required,
      });
      console.log('[start-call] Authorization failed: Insufficient funds.');
      
      const displayBal = (check.balance / 100).toFixed(2);
      const displayReq = (check.required / 100).toFixed(2);

      return new Response(
        JSON.stringify({
          error: 'Insufficient funds',
          message: `You need at least ${displayReq} ${check.currency} to start a call. Your balance is ${displayBal} ${check.currency}.`,
          current_balance: check.balance,
          required_balance: check.required
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const costPerMinute = check.cost;
    console.log(`[start-call] Authorized. Cost: ${costPerMinute} (Minor Units). Currency: ${check.currency}`);

    // --- 3. ACTION: Create the Call Log ---

    // Clean up any lingering 'active' calls
    await supabaseAdmin
      .from('call_logs')
      .update({ status: 'interrupted', ended_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('status', 'active');

    // Create the new call log.
    // Note: 'coins_per_minute' column now stores 'cost_per_minute' (minor units).
    const { data: callLog, error: callLogError } = await supabaseAdmin
      .from('call_logs')
      .insert({
        user_id: user.id,
        profile_id: profile_id,
        status: 'active',
        coins_per_minute: costPerMinute, // Storing PRICE, not coins
        coins_deducted: 0
      })
      .select()
      .single();

    if (callLogError || !callLog) {
      console.error('[start-call] Failed to create call log:', callLogError);
      return new Response(JSON.stringify({ error: 'Failed to initialize call session' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await trackCleverTapEvent(user.id, 'Voice Call Started', {
      call_log_id: callLog.id,
      profile_id,
      cost_per_minute: costPerMinute,
      currency: check.currency,
      current_balance: check.balance,
    });

    // --- 4. SUCCESS RESPONSE ---
    return new Response(
      JSON.stringify({
        success: true,
        call_log_id: callLog.id,
        coins_per_minute: costPerMinute, // Used by frontend for tracking if needed
        message: 'Call initialized successfully.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[start-call] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

Deno.serve(createCorsWrappedHandler(handler));
// Edge Function: deduct-call-coins
// Purpose: Deduct configured coins per minute during active call
// Called: Every 60 seconds by frontend during active call

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

const DEFAULT_COINS_PER_MINUTE = 30;

interface DeductCoinsRequest {
  call_log_id: string;
  duration_seconds: number;
  coins_deducted: number;
}

async function handler(req: Request): Promise<Response> {
  try {
    console.log('[deduct-call-coins] Function invoked');

    // Parse request body
    const { call_log_id, duration_seconds, coins_deducted }: DeductCoinsRequest = await req.json();

    if (!call_log_id) {
      return new Response(
        JSON.stringify({ error: 'Missing call_log_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[deduct-call-coins] Call log ID:', call_log_id);
    console.log('[deduct-call-coins] Duration seconds:', duration_seconds);
    console.log('[deduct-call-coins] Coins already deducted:', coins_deducted);

    // Initialize Supabase clients
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate user using Supabase Edge Function context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[deduct-call-coins] Missing Authorization header');
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
      console.error('[deduct-call-coins] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[deduct-call-coins] User authenticated:', user.id);

    // Verify call log belongs to user
    const { data: callLog, error: callLogError } = await supabaseAdmin
      .from('call_logs')
      .select('*')
      .eq('id', call_log_id)
      .eq('user_id', user.id)
      .single();

    if (callLogError || !callLog) {
      console.error('[deduct-call-coins] Call log not found:', callLogError);
      return new Response(
        JSON.stringify({ error: 'Call log not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine coins per minute for this call
    const coinsPerMinute = (() => {
      const value = callLog.coins_per_minute;
      if (typeof value === 'number' && !Number.isNaN(value) && value >= 0) {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = parseInt(value, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          return parsed;
        }
      }
      return DEFAULT_COINS_PER_MINUTE;
    })();

    // Check if call is still active
    if (callLog.status !== 'active') {
      console.log('[deduct-call-coins] Call is no longer active, status:', callLog.status);
      return new Response(
        JSON.stringify({
          success: false,
          should_end_call: true,
          message: 'Call is no longer active'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch current coin balance and plan info
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('coin_balance, plan_tier, subscription_start_date')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('[deduct-call-coins] Failed to fetch user data:', userError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[deduct-call-coins] Current balance:', userData.coin_balance);

    // --- NEW WALLET DEDUCTION LOGIC ---
    
    // Attempt to deduct for 1 minute of 'voice_call_minute'
    const deduction = await processWalletDeduction(supabaseAdmin, user.id, 'voice_call_minute', 1);

    if (!deduction.success) {
      console.log('[deduct-call-coins] Insufficient funds, ending call');
      
      // Update call log to closed
      await supabaseAdmin
        .from('call_logs')
        .update({
          status: 'insufficient_funds',
          ended_at: new Date().toISOString(),
          duration_seconds: duration_seconds 
        })
        .eq('id', call_log_id);

      return new Response(
        JSON.stringify({
          success: false,
          should_end_call: true,
          message: 'Insufficient funds'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update tracking
    // Note: We are reusing the 'coins_deducted' column to store 'minor units of currency' for now
    const newTotalDeducted = (callLog.coins_deducted || 0) + deduction.deducted;
    
    await supabaseAdmin
      .from('call_logs')
      .update({ 
        duration_seconds: duration_seconds, 
        coins_deducted: newTotalDeducted 
      })
      .eq('id', call_log_id);

    // Check if user can afford the NEXT minute to give a warning
    // We do a "Dry Run" check logic here
    const nextMinuteCheck = deduction.newBalance < deduction.deducted;

    return new Response(
      JSON.stringify({
        success: true,
        should_end_call: nextMinuteCheck,
        coin_balance: deduction.newBalance, // Returns wallet balance in minor units
        coins_deducted: newTotalDeducted,
        message: 'Deduction successful'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[deduct-call-coins] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Universal Wallet Deduction Helper
 * 1. Fetches user's currency and balance.
 * 2. Looks up the price for the specific service (SKU) in that currency.
 * 3. Deducts the amount if sufficient funds exist.
 */
async function processWalletDeduction(
  supabaseAdmin: any, 
  userId: string, 
  serviceKey: string, 
  quantity: number = 1
) {
  // 1. Get User's Currency & Balance
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('currency_code, wallet_balance')
    .eq('id', userId)
    .single();

  if (userError || !user) throw new Error(`User fetch failed: ${userError?.message}`);
  
  // Default to USD if migration failed
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
    // Fallback/Safety: If price is missing, block usage or assume free? 
    // Blocking is safer for business.
    throw new Error(`Price configuration missing for ${serviceKey} in ${currency}`);
  }

  const costPerUnit = priceRows[0].price_amount;
  const totalCost = costPerUnit * quantity;

  // 3. Balance Check
  if (currentBalance < totalCost) {
    return { success: false, error: 'Insufficient funds', required: totalCost, balance: currentBalance };
  }

  // 4. Deduct (Atomic Update is ideal, but straight update is fine for now)
  const newBalance = currentBalance - totalCost;
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ wallet_balance: newBalance })
    .eq('id', userId);

  if (updateError) throw new Error(`Deduction failed: ${updateError.message}`);

  return { success: true, deducted: totalCost, newBalance, currency };
}

Deno.serve(createCorsWrappedHandler(handler));


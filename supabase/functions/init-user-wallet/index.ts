// src/supabase/functions/init-user-wallet/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const GEOAPIFY_API_URL = 'https://api.geoapify.com/v1/ipinfo';

// Resilient country detection.
// Order: Geoapify (if key present) -> ipwho.is (keyless, HTTPS) -> ipapi.co -> 'US' fallback.
// Never throws: currency detection must not block wallet initialization.
async function detectCountryCode(clientIp: string): Promise<string> {
  const apiKey = Deno.env.get('GEOAPIFY_API_KEY');

  // 1. Geoapify (only if configured)
  if (apiKey) {
    try {
      const res = await fetch(`${GEOAPIFY_API_URL}?ip=${clientIp}&apiKey=${apiKey}`);
      if (res.ok) {
        const data = await res.json();
        const code = data?.country?.iso_code;
        if (code) {
          console.log(`[init-user-wallet] Country via Geoapify: ${code}`);
          return code.toUpperCase();
        }
      }
    } catch (e) {
      console.warn('[init-user-wallet] Geoapify lookup failed:', e?.message || e);
    }
  }

  // 2. ipwho.is (keyless, HTTPS). Requires a client IP to avoid geolocating the edge server.
  if (clientIp) {
    try {
      const res = await fetch(`https://ipwho.is/${clientIp}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success !== false && data?.country_code) {
          console.log(`[init-user-wallet] Country via ipwho.is: ${data.country_code}`);
          return String(data.country_code).toUpperCase();
        }
      }
    } catch (e) {
      console.warn('[init-user-wallet] ipwho.is lookup failed:', e?.message || e);
    }

    // 3. ipapi.co (keyless, HTTPS) as a second fallback
    try {
      const res = await fetch(`https://ipapi.co/${clientIp}/country/`);
      if (res.ok) {
        const code = (await res.text()).trim();
        if (code && code.length === 2) {
          console.log(`[init-user-wallet] Country via ipapi.co: ${code}`);
          return code.toUpperCase();
        }
      }
    } catch (e) {
      console.warn('[init-user-wallet] ipapi.co lookup failed:', e?.message || e);
    }
  }

  console.warn('[init-user-wallet] All geo lookups failed; defaulting to US');
  return 'US';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    // NEW: Get the variant name from the request body
    const requestBody = await req.json();
    const variant_name = requestBody.variant_name || 'control'; // Default to 'control' for safety

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Invalid Token')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // maybeSingle(): tolerate a missing row. On fresh OAuth signup the
    // handle_new_user trigger may not have created the public.users row yet;
    // in that case we create it below via upsert instead of erroring out
    // (which previously left the user stuck on the USD default).
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('currency_code, wallet_balance')
      .eq('id', user.id)
      .maybeSingle()

    if (userProfile?.currency_code) {
      return new Response(
        JSON.stringify({
          success: true,
          is_new_setup: false,
          currency: userProfile.currency_code,
          balance: userProfile.wallet_balance || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[init-user-wallet] Setting up user ${user.id} for variant '${variant_name}'...`)

    // A. Detect Country (resilient: works even without GEOAPIFY_API_KEY)
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      ''
    if (!clientIp) console.warn('[init-user-wallet] Could not detect Client IP from headers')
    const detectedCountry = await detectCountryCode(clientIp)
    console.log(`[init-user-wallet] Detected Country: ${detectedCountry}`)

    // B. Determine Currency
    let targetCurrency = 'USD';
    if (detectedCountry === 'IN') targetCurrency = 'INR';
    else if (detectedCountry === 'GB') targetCurrency = 'GBP';
    else if (detectedCountry === 'AE') targetCurrency = 'AED';

    // C. --- PROMOTION: welcome credit ---
    // During the promotion phase every new user starts with 300 coins.
    // Balances are stored in minor units where 1 coin = 100 units (so the UI,
    // which divides by 100, shows "300"). 300 coins => 30000 minor units.
    const PROMO_WELCOME_COINS = 300;
    const startingBalance = PROMO_WELCOME_COINS * 100;
    console.log(`[init-user-wallet] Promo welcome credit: ${PROMO_WELCOME_COINS} coins (${startingBalance} units) for ${targetCurrency}.`);

    // D. Upsert User in DB (creates the row if the trigger hasn't yet)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: user.id,
        currency_code: targetCurrency,
        wallet_balance: startingBalance,
        country: detectedCountry,
        is_migrated: true,
        coin_balance: 0, // Reset legacy coins
        pricing_variant: variant_name
      }, { onConflict: 'id' })

    if (updateError) throw new Error(`Update failed: ${updateError.message}`)

    return new Response(
      JSON.stringify({
        success: true,
        is_new_setup: true,
        country_detected: detectedCountry,
        currency: targetCurrency,
        balance: startingBalance
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(`[init-user-wallet] Error:`, error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
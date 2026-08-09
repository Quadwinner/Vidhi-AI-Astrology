import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface TopupRequestBody {
  package_id?: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function buildSuccessUrl(siteUrl: string) {
  const url = new URL(siteUrl);
  url.pathname = '/payment-success';
  url.searchParams.set('type', 'topup');
  return url.toString();
}

function buildCancelUrl(siteUrl: string) {
  const url = new URL(siteUrl);
  url.pathname = '/wallet'; 
  return url.toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // 1. Auth Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: userResult, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userResult?.user) {
      return jsonResponse({ error: 'Authentication failed: User not found' }, 401);
    }
    const userId = userResult.user.id;

    // 2. Parse Body
    const raw = await req.text();
    let body: TopupRequestBody;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const packageId = body?.package_id?.trim();
    if (!packageId) {
      return jsonResponse({ error: 'A wallet package is required' }, 400);
    }

    const { data: userProfile, error: userProfileError } = await supabase
      .from('users')
      .select('currency_code, pricing_variant')
      .eq('id', userId)
      .maybeSingle();

    if (userProfileError || !userProfile?.currency_code) {
      return jsonResponse({ error: 'Wallet currency is not configured' }, 400);
    }

    const currency = userProfile.currency_code.toUpperCase();
    const variant = userProfile.pricing_variant || 'control';
    const { data: walletPackage, error: packageError } = await supabase
      .from('wallet_packages')
      .select('id, amount, price, currency_code, variant_name')
      .eq('id', packageId)
      .eq('currency_code', currency)
      .eq('variant_name', variant)
      .eq('is_active', true)
      .maybeSingle();

    if (packageError || !walletPackage) {
      return jsonResponse({ error: 'Wallet package is unavailable' }, 400);
    }

    const amountToPay = Number(walletPackage.price);
    const amountToCredit = Number(walletPackage.amount);
    if (
      !Number.isSafeInteger(amountToPay) ||
      !Number.isSafeInteger(amountToCredit) ||
      amountToPay <= 0 ||
      amountToCredit <= 0
    ) {
      return jsonResponse({ error: 'Wallet package is invalid' }, 400);
    }

    // 3. Setup Gateway Config
    const forwardedHost = req.headers.get('x-forwarded-host');
    const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
    const derivedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined;
    const siteUrl = derivedOrigin || Deno.env.get('SITE_URL') || new URL(req.url).origin;

    // ---------------------------------------------------------
    // RAZORPAY FLOW
    // ---------------------------------------------------------
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    
    if (keyId && keySecret) {
      const credentials = btoa(`${keyId}:${keySecret}`);
      const shortUser = userId.replace(/-/g, '').slice(0, 8);
      const receipt = `top_${shortUser}_${Date.now().toString().slice(-8)}`.slice(0, 40);

      const orderPayload = {
        amount: amountToPay, // <--- CHARGE THIS (e.g. 9000)
        currency: currency,
        receipt,
        notes: {
          user_id: userId,
          // <--- CREDIT THIS (e.g. 12000). 
          // The webhook will read this note to update the database.
          topup_amount: String(amountToCredit), 
          currency: currency
        }
      };

      const orderResp = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${credentials}`
        },
        body: JSON.stringify(orderPayload)
      });

      const orderJson = await orderResp.json();
      if (!orderResp.ok) {
        return jsonResponse({ error: orderJson?.error?.description || 'Failed to create Razorpay order' }, 400);
      }

      return jsonResponse({
        gateway: 'razorpay',
        key_id: keyId,
        order: {
          id: orderJson.id,
          amount: orderJson.amount,
          currency: orderJson.currency,
          notes: orderJson.notes
        },
        return_url: buildSuccessUrl(siteUrl),
        cancel_url: buildCancelUrl(siteUrl)
      });
    }

    return jsonResponse({ error: 'Payment gateway not configured' }, 400);

  } catch (error) {
    return jsonResponse({ error: error?.message || 'Unexpected error' }, 400);
  }
});
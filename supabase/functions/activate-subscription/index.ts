import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ActivateSubscriptionBody {
  razorpay_payment_id: string;
  price_id: number;
  plan_type: 'monthly' | 'yearly';
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: userResult, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userResult?.user) {
      return jsonResponse({ error: 'Authentication failed' }, 401);
    }

    const user = userResult.user;
    const body: ActivateSubscriptionBody = await req.json();

    const { razorpay_payment_id, price_id, plan_type } = body;
    if (!razorpay_payment_id || !price_id || !plan_type) {
      return jsonResponse({ error: 'Missing razorpay_payment_id, price_id, or plan_type' }, 400);
    }

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!razorpayKeyId || !razorpayKeySecret) {
      return jsonResponse({ error: 'Razorpay credentials not configured' }, 500);
    }

    const credentials = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const paymentRes = await fetch(
      `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
      { headers: { Authorization: `Basic ${credentials}` } }
    );

    if (!paymentRes.ok) {
      const errText = await paymentRes.text();
      console.error('[activate-subscription] Razorpay verify failed:', errText);
      return jsonResponse({ error: 'Could not verify payment' }, 400);
    }

    const payment = await paymentRes.json();
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return jsonResponse({ error: `Payment not successful: ${payment.status}` }, 400);
    }

    const periodDays = plan_type === 'monthly' ? 30 : 365;
    const subscriptionEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString();

    const { error: upsertError } = await supabaseAdmin.from('users').upsert({
      id: user.id,
      email: user.email,
      plan_tier: plan_type,
      subscription_status: 'active',
      subscription_start_date: new Date().toISOString(),
      subscription_end_date: subscriptionEnd,
    }, { onConflict: 'id' });

    if (upsertError) {
      console.error('[activate-subscription] users upsert failed:', upsertError);
      return jsonResponse({ error: upsertError.message }, 500);
    }

    const { error: rpcError } = await supabaseAdmin.rpc('update_user_subscription', {
      p_user_id: user.id,
      p_price_id: price_id,
      p_gateway_subscription_id: razorpay_payment_id,
      p_management_url: null,
    });

    if (rpcError) {
      console.warn('[activate-subscription] update_user_subscription failed (user row updated):', rpcError.message);
    }

    return jsonResponse({
      success: true,
      plan_tier: plan_type,
      subscription_status: 'active',
    });
  } catch (err) {
    console.error('[activate-subscription] error:', err);
    return jsonResponse({ error: (err as Error).message || 'Internal error' }, 500);
  }
});

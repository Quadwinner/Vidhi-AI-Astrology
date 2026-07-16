// supabase/functions/create-subscription-session/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface SubscriptionRequestBody {
  priceId: number | string;
}

// A consistent JSON response helper, just like in your top-up function
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authenticate the user (copied directly from your working top-up function)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ error: 'Authentication failed: User not found' }, 401);
    }

    // 2. Get the priceId from the request
    const body: SubscriptionRequestBody = await req.json();
    const { priceId } = body;
    if (!priceId) {
      return jsonResponse({ error: 'Missing priceId in request body' }, 400);
    }

    // 3. Look up the Razorpay Plan ID from your database (the dynamic part)
    const { data: priceData, error: priceError } = await supabase
      .from('prices')
      .select('gateway_price_id')
      .eq('id', priceId)
      .single();

    if (priceError || !priceData || !priceData.gateway_price_id) {
      console.error('DB Error: Plan not found for priceId:', priceId, priceError);
      return jsonResponse({ error: `Subscription plan configuration not found.` }, 404);
    }
    const razorpayPlanId = priceData.gateway_price_id;

    // 4. Create the subscription on Razorpay (the core logic)
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!;
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const credentials = btoa(`${keyId}:${keySecret}`);

    const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${credentials}` },
      body: JSON.stringify({
        plan_id: razorpayPlanId,
        total_count: 60,
        customer_notify: 1,
        notes: { user_id: user.id }
      })
    });

    const responseData = await response.json();
    if (!response.ok) {
      console.error("Razorpay API Error:", responseData);
      return jsonResponse({ error: responseData?.error?.description || 'Failed to create subscription.' }, 500);
    }

    // 5. Return a complete response to the frontend, just like the top-up function does
    return jsonResponse({
      gateway: 'razorpay',
      key_id: keyId,
      subscription_id: responseData.id
    });

  } catch (error) {
    console.error('Critical Error in create-subscription-session:', error);
    return jsonResponse({ error: error?.message || 'An unexpected error occurred.' }, 500);
  }
});
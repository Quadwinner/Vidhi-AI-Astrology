import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = authData.user.id;

    // Load user row
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, subscription_id, gateway_customer_id, subscription_status, plan_tier')
      .eq('id', userId)
      .single();

    if (userErr || !userRow) {
      throw new Error('User record not found');
    }

    // Validate
    if (userRow.subscription_status !== 'active') {
      return new Response(JSON.stringify({ error: 'No active subscription to cancel' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Attempt Razorpay cancel if we have a subscription id
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    let gatewayResult: Record<string, unknown> | null = null;

    if (keyId && keySecret && userRow.subscription_id) {
      const credentials = btoa(`${keyId}:${keySecret}`);
      const resp = await fetch(`https://api.razorpay.com/v1/subscriptions/${userRow.subscription_id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_at_cycle_end: 1 })
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Razorpay cancel failed: ${text}`);
      }
      gatewayResult = await resp.json();
    }

    // Mark as cancelled locally; keep tier until webhook downgrades on actual end
    const { error: updateErr } = await supabase
      .from('users')
      .update({ subscription_status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ success: true, gatewayResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Cancel subscription error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Cancellation failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});




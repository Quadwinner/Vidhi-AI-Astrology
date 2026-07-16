// supabase/functions/create-customer-portal-session/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    console.log('=== Create Customer Portal Session ===');

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse JWT to get user ID
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    console.log('User ID:', user.id);

    // Get user subscription details
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('plan_tier, subscription_status, subscription_id, subscription_start_date, subscription_end_date, gateway_customer_id')
      .eq('id', user.id)
      .single();

    if (dbError || !userData) {
      throw new Error('User subscription data not found');
    }

    console.log('User subscription data:', userData);

    // Check if user has an active subscription
    if (!userData.subscription_status || userData.subscription_status !== 'active') {
      return new Response(
        JSON.stringify({
          error: 'No active subscription found. Please subscribe first.',
          redirect_to_pricing: true
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // For Razorpay subscriptions, create a simple management page URL
    // Since Razorpay doesn't have a built-in customer portal like Stripe,
    // we'll return a URL to a subscription management page

    const forwardedHost = req.headers.get('x-forwarded-host');
    const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
    const derivedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined;
    const siteUrl = derivedOrigin || Deno.env.get('SITE_URL') || new URL(req.url).origin;
    const managementUrl = `${siteUrl}/subscription-management`;

    console.log('Returning management URL:', managementUrl);

    return new Response(
      JSON.stringify({
        url: managementUrl,
        subscription_details: {
          plan_tier: userData.plan_tier,
          status: userData.subscription_status,
          start_date: userData.subscription_start_date,
          end_date: userData.subscription_end_date
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Customer portal session creation failed:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
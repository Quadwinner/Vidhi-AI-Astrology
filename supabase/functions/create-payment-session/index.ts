// supabase/functions/create-payment-session/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders as sharedCors } from '../_shared/cors.ts';

const corsHeaders: Record<string, string> = {
  ...sharedCors,
  'Access-Control-Allow-Methods': '*',
};

interface RequestBody {
  price_id: string | number;
  user_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== Create Payment Session Started ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));

    // Parse request body with better error handling
    let requestBody;
    try {
      const bodyText = await req.text();
      console.log('Raw request body:', bodyText);

      if (!bodyText || bodyText.trim() === '') {
        throw new Error('Request body is empty');
      }

      requestBody = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      throw new Error(`Invalid JSON in request body: ${parseError.message}`);
    }

    const { price_id, user_id }: RequestBody = requestBody;
    console.log('Request received:', { price_id, user_id });

    if (!price_id || !user_id) {
      throw new Error('Missing required parameters: price_id and user_id');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Getting user details...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single();

    console.log('Available user columns:', user ? Object.keys(user) : 'No user found');

    if (userError || !user) {
      throw new Error(`User not found: ${userError?.message}`);
    }

    // Get user email from auth.users table if not in custom users table
    let userEmail = user.email;
    if (!userEmail) {
      console.log('Email not found in users table, checking auth.users...');
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user_id);
      if (authError || !authUser) {
        throw new Error(`Could not get user email: ${authError?.message}`);
      }
      userEmail = authUser.user?.email;
      console.log('Found email in auth.users:', userEmail);
    }

    console.log('Getting price details...');
    const { data: price, error: priceError } = await supabase
      .from('prices')
      .select('*')
      .eq('id', price_id)
      .single();

    if (priceError || !price) {
      throw new Error(`Price not found: ${priceError?.message}`);
    }

    console.log('Price details:', {
      id: price.id,
      amount: price.amount,
      currency: price.currency,
      gateway_price_id: price.gateway_price_id
    });

    // Determine gateway based on currency
    const isRazorpay = price.currency.toLowerCase() === 'inr';

    if (isRazorpay) {
      return await handleRazorpayPayment(supabase, user, price, userEmail);
    } else {
      return await handleStripePayment(supabase, user, price, userEmail);
    }

  } catch (error) {
    console.error('Payment session creation failed:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function handleRazorpayPayment(supabase: any, user: any, price: any, userEmail: string) {
  console.log('=== Processing Razorpay Payment ===');

  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials not configured');
  }

  const credentials = btoa(`${keyId}:${keySecret}`);

  // Smart customer handling - search first, create only if needed
  let customerId = user.gateway_customer_id;

  if (!customerId || !customerId.startsWith('cust_')) {
    console.log('Looking for existing customer with email:', userEmail);
    // First, try to find existing customer by listing customers
    let foundExisting = false;
    try {
      const listCustomersRes = await fetch('https://api.razorpay.com/v1/customers', {
        method: 'GET',
        headers: { 'Authorization': `Basic ${credentials}` }
      });
      if (listCustomersRes.ok) {
        const customersList = await listCustomersRes.json();
        const existingCustomer = customersList.items?.find((c: any) => c?.email === userEmail);
        if (existingCustomer?.id) {
          console.log('Found existing customer:', existingCustomer.id);
          customerId = existingCustomer.id;
          foundExisting = true;
          const { error: updateError } = await supabase
            .from('users')
            .update({ gateway_customer_id: customerId })
            .eq('id', user.id);
          if (updateError) console.error('Failed to save existing customer ID:', updateError);
        }
      }
    } catch (e) { /* ignore */ }

    // Only create new customer if we didn't find an existing one
    if (!foundExisting) {
      console.log('Creating new customer for email:', userEmail);
      const customerResponse = await fetch('https://api.razorpay.com/v1/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${credentials}`
        },
        body: JSON.stringify({
          email: userEmail,
          name: (userEmail || 'User').split('@')[0]
        })
      });
      const customerPayload = await customerResponse.json();
      if (!customerResponse.ok) {
        console.error('Customer creation failed:', customerPayload);
        throw new Error(`Failed to create payment profile: ${customerPayload?.error?.description || 'Unknown error'}`);
      }
      customerId = customerPayload.id;
      console.log('Created new customer:', customerId);
      const { error: updateError } = await supabase
        .from('users')
        .update({ gateway_customer_id: customerId })
        .eq('id', user.id);
      if (updateError) {
        console.error('Failed to save new customer ID:', updateError.message);
        throw new Error('Could not save payment profile. Please try again.');
      }
    }
  } else {
    console.log('Using existing customer:', customerId);
  }

  // Create or get plan
  let planId = price.gateway_price_id;

  // Helper to create a new plan on Razorpay and persist in DB
  async function createAndSavePlan() {
    console.log('Creating new Razorpay plan for price:', {
      amount: price.amount,
      currency: price.currency,
      interval: price.interval_unit
    });

    const planResponse = await fetch('https://api.razorpay.com/v1/plans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify({
        period: price.interval_unit === 'year' ? 'yearly' : 'monthly',
        interval: 1,
        item: {
          name: `AuraAI ${price.interval_unit === 'year' ? 'Yearly' : 'Monthly'} Plan`,
          amount: price.amount,
          currency: price.currency.toUpperCase()
        }
      })
    });

    if (!planResponse.ok) {
      const errorText = await planResponse.text();
      console.error('Plan creation failed:', errorText);
      throw new Error(`Failed to create Razorpay plan: ${errorText}`);
    }

    const planData = await planResponse.json();
    console.log('Created Razorpay plan:', planData.id);
    await supabase
      .from('prices')
      .update({ gateway_price_id: planData.id })
      .eq('id', price.id);
    return planData.id;
  }

  if (!planId || !planId.startsWith('plan_')) {
    console.log('Creating new Razorpay plan for price:', {
      amount: price.amount,
      currency: price.currency,
      interval: price.interval_unit
    });

    planId = await createAndSavePlan();
  } else {
    console.log('Using existing plan (will validate):', planId);
    // Validate the existing plan_id in LIVE Razorpay; if not found, create a fresh one
    try {
      const checkRes = await fetch(`https://api.razorpay.com/v1/plans/${planId}`, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${credentials}` }
      });
      if (!checkRes.ok) {
        const body = await checkRes.text();
        console.warn('Existing plan validation failed, will recreate:', body);
        planId = await createAndSavePlan();
      }
    } catch (e) {
      console.warn('Plan validation exception, will recreate plan:', String(e));
      planId = await createAndSavePlan();
    }
  }

  // Create subscription
  console.log('Creating Razorpay subscription...');
  const subscriptionResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`
    },
    body: JSON.stringify({
      plan_id: planId,
      customer_id: customerId,
      total_count: 120, // 10 years worth of billing cycles
      customer_notify: 1
    })
  });

  if (!subscriptionResponse.ok) {
    const errorText = await subscriptionResponse.text();
    console.error('Subscription creation failed:', errorText);
    throw new Error(`Failed to create Razorpay subscription: ${errorText}`);
  }

  const subscriptionData = await subscriptionResponse.json();
  console.log('Created subscription:', subscriptionData.id);

  return new Response(
    JSON.stringify({
      gateway: 'razorpay',
      subscription_id: subscriptionData.id,
      key_id: keyId
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

async function handleStripePayment(supabase: any, user: any, price: any, userEmail: string) {
  console.log('=== Processing Stripe Payment ===');

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    throw new Error('Stripe secret key not configured');
  }

  // Create Stripe checkout session
  const forwardedHost = (globalThis as any).__request_headers?.get?.('x-forwarded-host');
  const forwardedProto = (globalThis as any).__request_headers?.get?.('x-forwarded-proto') || 'https';
  const derivedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined;
  const siteUrl = derivedOrigin || Deno.env.get('SITE_URL') || 'http://localhost:3000';

  const checkoutResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${stripeKey}`
    },
    body: new URLSearchParams({
      'payment_method_types[]': 'card',
      'mode': 'subscription',
      'customer_email': userEmail,
      'line_items[0][price]': price.gateway_price_id || String(price.id),
      'line_items[0][quantity]': '1',
      'success_url': `${siteUrl}/payment-success`,
      'cancel_url': `${siteUrl}/pricing`,
    })
  });

  if (!checkoutResponse.ok) {
    const errorText = await checkoutResponse.text();
    console.error('Stripe session creation failed:', errorText);
    throw new Error(`Failed to create Stripe session: ${errorText}`);
  }

  const sessionData = await checkoutResponse.json();
  console.log('Created Stripe session:', sessionData.id);

  return new Response(
    JSON.stringify({
      gateway: 'stripe',
      sessionId: sessionData.id
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}
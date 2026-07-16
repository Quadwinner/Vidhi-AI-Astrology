// Direct Razorpay Subscription Creation
// This function creates subscriptions directly without complex validation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders as sharedCors } from '../_shared/cors.ts';

const corsHeaders: Record<string, string> = {
  ...sharedCors,
  'Access-Control-Allow-Methods': '*',
};

interface RequestBody {
  plan_type: 'monthly' | 'yearly';
  user_id: string;
  country?: string; // Optional country code for location-based pricing
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== Direct Subscription Creation Started ===');
    
    const { plan_type, user_id, country }: RequestBody = await req.json();
    console.log('Request:', { plan_type, user_id, country });

    if (!plan_type || !user_id) {
      throw new Error('Missing plan_type or user_id');
    }

    // Determine currency based on location
    let currency = 'inr'; // Default to INR
    let countryCode = country || 'IN'; // Default to India
    
    // Use Vercel header if available (more reliable)
    const vercelCountry = req.headers.get('x-vercel-ip-country');
    if (vercelCountry) {
      countryCode = vercelCountry;
    }
    
    const countryUpper = countryCode.toUpperCase();
    
    // Currency mapping (same as get-location-and-plans)
    const currencyMap: { [countryCode: string]: string } = {
      'IN': 'inr', 'AE': 'aed', 'GB': 'gbp', 'US': 'usd',
    };
    
    // European countries check
    const europeanCountries = new Set(['AL', 'AD', 'AM', 'AT', 'BY', 'BE', 'BA', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FO', 'FI', 'FR', 'GR', 'GE', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MK', 'MT', 'NO', 'NL', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SK', 'SM', 'TR', 'UA', 'VA']);
    
    if (currencyMap[countryUpper]) {
      currency = currencyMap[countryUpper];
    } else if (europeanCountries.has(countryUpper)) {
      currency = 'gbp';
    }
    
    console.log(`Location-based pricing: Country ${countryUpper} → Currency ${currency}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header (Supabase automatically adds this)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error(`Authentication failed: ${userError?.message}`);
    }

    // Verify the user_id matches the authenticated user
    if (user.id !== user_id) {
      console.warn('User ID mismatch, but continuing with authenticated user');
    }

    const userEmail = user.email;
    console.log('User email:', userEmail);

    // Razorpay credentials
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    const credentials = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // Define plan details based on currency and location
    const getPlanDetails = (currency: string) => {
      const plans = {
        inr: {
          monthly: { amount: 29900, period: 'monthly', interval: 1, name: 'AuraAI Monthly Plan' }, // ₹299
          yearly: { amount: 299000, period: 'yearly', interval: 1, name: 'AuraAI Yearly Plan' }   // ₹2,990
        },
        usd: {
          monthly: { amount: 999, period: 'monthly', interval: 1, name: 'AuraAI Monthly Plan' },    // $9.99
          yearly: { amount: 9999, period: 'yearly', interval: 1, name: 'AuraAI Yearly Plan' }     // $99.99
        },
        gbp: {
          monthly: { amount: 799, period: 'monthly', interval: 1, name: 'AuraAI Monthly Plan' },  // £7.99
          yearly: { amount: 7999, period: 'yearly', interval: 1, name: 'AuraAI Yearly Plan' }    // £79.99
        },
        aed: {
          monthly: { amount: 3699, period: 'monthly', interval: 1, name: 'AuraAI Monthly Plan' },  // AED 36.99
          yearly: { amount: 36999, period: 'yearly', interval: 1, name: 'AuraAI Yearly Plan' }    // AED 369.99
        }
      };
      
      return plans[currency as keyof typeof plans] || plans.inr; // Fallback to INR
    };
    
    const planDetails = getPlanDetails(currency);

    const plan = planDetails[plan_type];
    console.log('Plan details:', plan);

    // Create Razorpay plan
    console.log('Creating Razorpay plan...');
    const planResponse = await fetch('https://api.razorpay.com/v1/plans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify({
        period: plan.period,
        interval: plan.interval,
        item: {
          name: plan.name,
          amount: plan.amount,
          currency: currency.toUpperCase()
        }
      })
    });

    if (!planResponse.ok) {
      const errorText = await planResponse.text();
      console.error('Plan creation failed:', errorText);
      throw new Error(`Failed to create Razorpay plan: ${errorText}`);
    }

    const planData = await planResponse.json();
    console.log('Created plan:', planData.id);

    // Create Razorpay customer
    console.log('Creating Razorpay customer...');
    const customerResponse = await fetch('https://api.razorpay.com/v1/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify({
        name: userEmail.split('@')[0],
        email: userEmail,
        contact: '9999999999' // Default contact
      })
    });

    if (!customerResponse.ok) {
      const errorText = await customerResponse.text();
      console.error('Customer creation failed:', errorText);
      throw new Error(`Failed to create Razorpay customer: ${errorText}`);
    }

    const customerData = await customerResponse.json();
    console.log('Created customer:', customerData.id);

    // Create Razorpay subscription
    console.log('Creating Razorpay subscription...');
    const subscriptionResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify({
        plan_id: planData.id,
        customer_id: customerData.id,
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

    // Update user record
    await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: userEmail,
        plan_tier: plan_type === 'monthly' ? 'monthly' : 'yearly',
        subscription_status: 'active',
        gateway_customer_id: customerData.id,
        subscription_id: subscriptionData.id,
        subscription_start_date: new Date().toISOString(),
        subscription_end_date: new Date(Date.now() + (plan_type === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString()
      });

    console.log('Updated user record');

    return new Response(
      JSON.stringify({
        success: true,
        gateway: 'razorpay',
        subscription_id: subscriptionData.id,
        customer_id: customerData.id,
        plan_id: planData.id,
        key_id: razorpayKeyId,
        amount: plan.amount,
        currency: currency.toUpperCase(),
        country: countryUpper
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Direct subscription creation failed:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

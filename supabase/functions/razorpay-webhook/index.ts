// supabase/functions/razorpay-webhook/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// --- CleverTap config ---
const CLEVERTAP_ACCOUNT_ID = Deno.env.get('CLEVERTAP_ACCOUNT_ID');
const CLEVERTAP_PASSCODE = Deno.env.get('CLEVERTAP_PASSCODE');
const CLEVERTAP_REGION = Deno.env.get('CLEVERTAP_REGION') || 'in1';
// For "global" region, use api.clevertap.com (no region prefix)
// For other regions, use {region}.api.clevertap.com
const CLEVERTAP_API_BASE = Deno.env.get('CLEVERTAP_API_BASE') || 
  (CLEVERTAP_REGION === 'global' 
    ? 'https://api.clevertap.com/1/upload'
    : `https://${CLEVERTAP_REGION}.api.clevertap.com/1/upload`);

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
    console.error('[razorpay-webhook] CleverTap tracking error:', error);
  }
}

async function createPaymentRecord(supabase: any, details: {
  userId: string;
  amount: number;
  currency: string;
  productType: 'subscription' | 'wallet_recharge';
  productDetails: Record<string, any>;
  gatewayPaymentId: string;
  gatewayOrderId: string;
  status: 'succeeded' | 'failed';
}) {
  try {
    const { error } = await supabase.from('payments').insert({
      user_id: details.userId,
      amount: details.amount,
      currency: details.currency.toUpperCase(),
      product_type: details.productType,
      product_details: details.productDetails,
      gateway_payment_id: details.gatewayPaymentId,
      gateway_order_id: details.gatewayOrderId,
      status: details.status,
    });
    if (error) {
      console.error(`Failed to create payment record for ${details.gatewayPaymentId}:`, error);
    } else {
      console.log(`Successfully created payment record for ${details.gatewayPaymentId}.`);
    }
  } catch (e) {
    console.error('CRITICAL: createPaymentRecord crashed:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    console.log('=== Razorpay Webhook Started ===');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json();
    console.log(`Event: ${payload.event}`);

    switch(payload.event){
      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.authenticated':
        await handleSubscriptionSuccess(supabase, payload);
        break;
      case 'subscription.cancelled':
      case 'subscription.completed':
      case 'subscription.halted':
        await handleSubscriptionEnd(supabase, payload);
        break;
      case 'payment.authorized':
        await handlePaymentAuthorized(supabase, payload);
        break;
      case 'payment.captured':
        await handlePaymentCaptured(supabase, payload);
        break;
      case 'payment.failed':
        await handlePaymentFailed(supabase, payload);
        break;
      default:
        console.log(`Unhandled: ${payload.event}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Webhook failed:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// --- 1. SUBSCRIPTION SUCCESS ---
async function handleSubscriptionSuccess(supabase: any, payload: any) {
  if (!payload.payload.subscription) return;
  const subscription = payload.payload.subscription.entity;
  const payment = payload.payload.payment?.entity;
  console.log(`Processing Subscription: ${subscription.id} | Plan: ${subscription.plan_id}`);

  try {
    // 1. Find User (Standard Lookups)
    let { data: user } = await supabase.from('users').select('*').eq('gateway_customer_id', subscription.customer_id).single();

    if (!user) {
        // Fallback: Link via subscription_id
        const { data: userBySub } = await supabase.from('users').select('*').eq('subscription_id', subscription.id).single();
        user = userBySub;
    }

    if (!user) {
      console.log(`User not found for Sub ID: ${subscription.id}. Waiting for payment.captured to link via Email/Phone.`);
      return;
    }

    // 2. Process Wallet/Coins Logic
    await updateWalletAndCoins(supabase, user, subscription.plan_id, subscription.id, payment);
    
    // Track CleverTap events
    await trackCleverTapEvent(user.id, 'Payment Success', {
      gateway: 'razorpay',
      payment_type: 'subscription',
      subscription_id: subscription.id,
      plan_tier: planTier,
      amount: cashToCredit / 100
    });
    
    await trackCleverTapEvent(user.id, 'Subscription Succeeded', {
      gateway: 'razorpay',
      subscription_id: subscription.id,
      plan_tier: planTier
    });

  } catch (error) {
    console.error('Error handling subscription success:', error);
  }
}

// --- 2. SUBSCRIPTION END ---
async function handleSubscriptionEnd(supabase: any, payload: any) {
  if (!payload.payload.subscription) return;
  const subscription = payload.payload.subscription.entity;
  try {
    const { data: user } = await supabase.from('users').select('id').eq('subscription_id', subscription.id).single();
    
    await supabase.from('users').update({
      plan_tier: 'free',
      subscription_status: 'cancelled',
      subscription_end_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('subscription_id', subscription.id);
    
    console.log('Subscription Ended:', subscription.id);
    
    // Track CleverTap event
    if (user?.id) {
      await trackCleverTapEvent(user.id, 'Subscription Cancelled', {
        gateway: 'razorpay',
        subscription_id: subscription.id
      });
    }
  } catch (error) { 
    console.error('Error ending subscription:', error); 
  }
}

// --- 3. PAYMENT AUTHORIZED (Auto-Capture) ---
async function handlePaymentAuthorized(supabase: any, payload: any) {
  if (!payload.payload.payment) return;
  const payment = payload.payload.payment.entity;
  if (payment.captured) return;

  const notes = payment.notes || {};
  const isSub = payment.description && (
    payment.description.toLowerCase().includes('subscription') || 
    payment.description.toLowerCase().includes('monthly') || 
    payment.description.toLowerCase().includes('yearly')
  );
  const isTopup = notes.topup_amount || notes.topup_coins;

  if (isSub || isTopup) {
    console.log('Auto-capturing Payment:', payment.id);
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const credentials = btoa(`${keyId}:${keySecret}`);
    await fetch(`https://api.razorpay.com/v1/payments/${payment.id}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${credentials}` },
      body: JSON.stringify({ amount: payment.amount })
    });
  }
}

// --- 4. PAYMENT CAPTURED (WITH ROBUST FALLBACKS) ---
async function handlePaymentCaptured(supabase: any, payload: any) {
  if (!payload.payload.payment) return;
  const payment = payload.payload.payment.entity;
  const notes = payment.notes || {};
  console.log(`Payment Captured: ${payment.id} | Amount: ${payment.amount}`);

  // --- STEP 1: USER LOOKUP ---
  let user = null;

  // A. Try User ID in Notes
  if (notes.user_id) {
    const { data: u } = await supabase.from('users').select('*').eq('id', notes.user_id).single();
    user = u;
  }
  
  // B. Try Subscription ID
  const possibleSubId = notes.subscription_id || (payment.order_id && payment.order_id.startsWith('sub_') ? payment.order_id : null);
  if (!user && possibleSubId) {
     const { data: u } = await supabase.from('users').select('*').eq('subscription_id', possibleSubId).single();
     if (u) {
         console.log('Found user via Subscription ID:', possibleSubId);
         user = u;
     }
  }

  // C. Try Customer ID
  if (!user && payment.customer_id) {
    const { data: u } = await supabase.from('users').select('*').eq('gateway_customer_id', payment.customer_id).single();
    user = u;
  }

  // D. Try EMAIL
  if (!user && payment.email) {
    const { data: userByEmail } = await supabase.from('users').select('*').eq('email', payment.email).maybeSingle();
    if (userByEmail) {
        console.log(`Found user via Email: ${payment.email}`);
        await supabase.from('users').update({ 
            gateway_customer_id: payment.customer_id,
            updated_at: new Date().toISOString()
        }).eq('id', userByEmail.id);
        user = userByEmail;
    }
  }

  // E. Try MSG91 PHONE
  if (!user && payment.contact) {
    const cleanPayPhone = String(payment.contact).replace(/\D/g, '').slice(-10);
    const { data: userByPhone } = await supabase.from('users').select('*').ilike('msg91_phone_number', `%${cleanPayPhone}`).maybeSingle();
    if (userByPhone) {
        console.log(`Found user via MSG91 Phone: ${userByPhone.msg91_phone_number}`);
        await supabase.from('users').update({ 
            gateway_customer_id: payment.customer_id,
            updated_at: new Date().toISOString()
        }).eq('id', userByPhone.id);
        user = userByPhone;
    }
  }

  if (!user) {
    console.error('CRITICAL: User not found for payment:', payment.id);
    return;
  }

  // --- STEP 2: SUBSCRIPTION LOGIC ---
  const isSubscriptionPayment = (payment.description && payment.description.toLowerCase().includes('subscription')) 
    || notes.subscription_id || (payment.order_id && payment.order_id.startsWith('sub_'));

  if (isSubscriptionPayment) {
      console.log('Subscription payment detected. Updating Wallet...');
      
      const subscriptionId = notes.subscription_id || payment.order_id;
      let planIdToUse = null;

      // Plan A: Fetch from Razorpay API
      if (subscriptionId) {
        try {
            const keyId = Deno.env.get('RAZORPAY_KEY_ID');
            const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
            const credentials = btoa(`${keyId}:${keySecret}`);
            
            const subRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
                method: 'GET',
                headers: { 'Authorization': `Basic ${credentials}` }
            });

            if (subRes.ok) {
                const subData = await subRes.json();
                console.log(`Razorpay API confirms Plan ID: ${subData.plan_id}`);
                planIdToUse = subData.plan_id;
            } else {
                console.error(`Razorpay API Fetch Failed: ${subRes.status}`);
            }
        } catch (e) {
            console.error('Fetch error:', e);
        }
      }

      // Plan B: Fallback by Matching Amount (CRITICAL FIX)
      if (!planIdToUse) {
          console.log(`Plan ID not found via API. Attempting DB lookup by Amount: ${payment.amount}`);
          const { data: priceMatch } = await supabase.from('prices')
              .select('*')
              .eq('amount', payment.amount) // e.g. 500
              .limit(1)
              .maybeSingle();
          
          if (priceMatch) {
              console.log(`Fallback Success: Matched Amount ${payment.amount} to Gateway Price ID: ${priceMatch.gateway_price_id}`);
              planIdToUse = priceMatch.gateway_price_id;
          }
      }

      // Execute Update
      if (planIdToUse) {
          await updateWalletAndCoins(supabase, user, planIdToUse, subscriptionId, payment);
      } else {
          console.error(`FAILED: Could not determine Plan ID for payment ${payment.amount}. Wallet not updated.`);
      }
      return;
  }

  // --- STEP 3: TOP-UP LOGIC ---
  try {
    const topupAmountRaw = notes.topup_amount;
    const topupCoinsRaw = notes.topup_coins;

    if (topupAmountRaw || topupCoinsRaw) {
        const { data: freshUser } = await supabase.from('users').select('wallet_balance, coin_balance').eq('id', user.id).single();
        let newWallet = Number(freshUser?.wallet_balance) || 0;
        let newCoins = Number(freshUser?.coin_balance) || 0;
        let updated = false;

        if (topupAmountRaw) { const amount = Number(topupAmountRaw); if (amount > 0) { newWallet += amount; updated = true; } }
        if (topupCoinsRaw) { const coins = Number(topupCoinsRaw); if (coins > 0) { newCoins += coins; updated = true; } }

        if (updated) {
            await supabase.from('users').update({ wallet_balance: newWallet, coin_balance: newCoins, updated_at: new Date().toISOString() }).eq('id', user.id);
            console.log('Topup successful.');

            // --- NEW ---
            // Create the payment record for this successful wallet recharge.
            await createPaymentRecord(supabase, {
                userId: user.id,
                amount: payment.amount, // The amount the user PAID
                currency: payment.currency,
                productType: 'wallet_recharge',
                productDetails: {
                    credits_granted: Number(topupAmountRaw) || 0, // The amount CREDITED to wallet
                    // coins_granted: Number(topupCoinsRaw) || 0,
                },
                gatewayPaymentId: payment.id,
                gatewayOrderId: payment.order_id,
                status: 'succeeded',
            });

            // --- CLEVERTAP CHARGED EVENT ---
            // Send revenue tracking event to CleverTap
            await trackCleverTapEvent(user.id, 'Charged', {
                'Amount': payment.amount / 100, // Convert paise to rupees
                'Currency': payment.currency?.toUpperCase() || 'INR',
                'Payment ID': payment.id,
                'Gateway': 'razorpay',
                'Product Type': 'wallet_recharge',
                'Credits Granted': (Number(topupAmountRaw) || 0) / 100,
            });
            console.log('CleverTap Charged event sent for wallet recharge');
        }
    }
  } catch (err) { console.error('Topup Error:', err); }
}

async function handlePaymentFailed(supabase: any, payload: any) {
  const payment = payload.payload.payment?.entity;
  if(!payment) return;

  console.log(`Logging Failed Payment: ${payment.id}`);
  const notes = payment.notes || {};
  let user = null;

  // Attempt to find the user to associate the failed payment correctly.
  if (notes.user_id) {
    const { data: u } = await supabase.from('users').select('*').eq('id', notes.user_id).single();
    user = u;
  } else if (payment.email) {
    const { data: userByEmail } = await supabase.from('users').select('*').eq('email', payment.email).maybeSingle();
    user = userByEmail;
  }

  // --- NEW ---
  // Create a payment record even for failed payments for auditing.
  if (user) {
    await createPaymentRecord(supabase, {
        userId: user.id,
        amount: payment.amount,
        currency: payment.currency,
        productType: notes.topup_amount ? 'wallet_recharge' : 'subscription',
        productDetails: {
            error_code: payment.error_code,
            error_description: payment.error_description,
            ...notes
        },
        gatewayPaymentId: payment.id,
        gatewayOrderId: payment.order_id,
        status: 'failed',
    });
  }
}

// --- HELPER: CENTRALIZED UPDATE LOGIC (CORRECTED VERSION) ---
async function updateWalletAndCoins(supabase: any, user: any, planId: string, subscriptionId: string, payment: any | null = null) {
    // 1. Fetch Price Details
    const { data: priceData } = await supabase
      .from('prices')
      .select('*')
      .eq('gateway_price_id', planId)
      .single();

    let planTier = 'monthly';
    let walletCashToCredit = 0;

    if (priceData) {
        console.log(`DB Price Found! Adding ${priceData.wallet_credit_amount} to Wallet.`);
        if (priceData.interval === 'year' || planId.includes('yearly')) planTier = 'yearly';
        walletCashToCredit = Number(priceData.wallet_credit_amount) || 0;
    } else {
        console.error(`MISMATCH: Plan ID [${planId}] not found in prices table. Wallet Credit = 0.`);
    }

    // 2. Determine Coins
    let coinsToCredit = planTier === 'yearly' ? 2500 : 100;
    try {
      const { data: ent } = await supabase.from('plan_entitlements').select('coins_granted_on_subscription').eq('plan_id', planTier).single();
      if (ent) coinsToCredit = ent.coins_granted_on_subscription;
    } catch (e) {}

    // 3. Update User
    const { data: freshUser } = await supabase.from('users').select('wallet_balance, coin_balance').eq('id', user.id).single();
    const currentWallet = Number(freshUser?.wallet_balance) || 0;
    const currentCoins = Number(freshUser?.coin_balance) || 0;

    const endDate = planTier === 'yearly'
        ? new Date(Date.now() + 365 * 24 * 3600 * 1000)
        : new Date(Date.now() + 30 * 24 * 3600 * 1000);

    await supabase.from('users').update({
      plan_tier: planTier,
      subscription_status: 'active',
      subscription_id: subscriptionId,
      wallet_balance: currentWallet + walletCashToCredit,
      coin_balance: currentCoins + coinsToCredit,
      subscription_start_date: new Date().toISOString(),
      subscription_end_date: endDate.toISOString(),
      gateway_customer_id: user.gateway_customer_id,
      updated_at: new Date().toISOString()
    }).eq('id', user.id);

    // 4. Update Subscription Record
    await supabase.from('users_subscriptions').upsert({
      user_id: user.id,
      gateway_subscription_id: subscriptionId,
      status: 'active',
      current_period_end: endDate.toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    console.log(`User ${user.id} Updated. New Wallet: ${currentWallet + walletCashToCredit}`);

    // --- NEW LOGIC ---
    // 5. Create the payment record for this successful subscription charge.
    //    This part will now work because the function can receive the `payment` object.
    if (payment && priceData) {
        await createPaymentRecord(supabase, {
            userId: user.id,
            amount: payment.amount, // The actual amount charged in this transaction
            currency: payment.currency,
            productType: 'subscription',
            productDetails: {
                plan_name: priceData.name || planTier,
                plan_interval: priceData.interval || planTier,
                credits_granted: walletCashToCredit,
                // coins_granted: coinsToCredit
            },
            gatewayPaymentId: payment.id,
            gatewayOrderId: payment.order_id,
            status: 'succeeded',
        });
    } else {
        console.log(`Skipping payment record creation for subscription ${subscriptionId} because payment details were not available in this event.`);
    }

    // --- CLEVERTAP LOGIC (MOVED TO END) ---
    // It's better to run tracking events after all database operations are complete.
    await trackCleverTapEvent(user.id, 'Payment Success', {
      gateway: 'razorpay',
      payment_type: 'subscription',
      plan_tier: planTier,
      subscription_id: subscriptionId,
      amount: priceData ? priceData.amount / 100 : 0
    });

    // --- CLEVERTAP CHARGED EVENT FOR REVENUE TRACKING ---
    if (payment && priceData) {
        await trackCleverTapEvent(user.id, 'Charged', {
            'Amount': payment.amount / 100, // Convert paise to rupees
            'Currency': payment.currency?.toUpperCase() || 'INR',
            'Payment ID': payment.id,
            'Gateway': 'razorpay',
            'Product Type': 'subscription',
            'Plan': priceData.name || planTier,
            'Plan Interval': priceData.interval || planTier,
        });
        console.log('CleverTap Charged event sent for subscription');
    }

    await trackCleverTapEvent(user.id, 'Subscription Succeeded', {
      gateway: 'razorpay',
      plan_tier: planTier,
      subscription_id: subscriptionId
    });
}
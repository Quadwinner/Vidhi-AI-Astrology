// File: supabase/functions/stripe-webhook/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@11.1.0';

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
    console.error('[stripe-webhook] CleverTap tracking error:', error);
  }
}

async function verifySignature(signature: string, body: string, secret: string): Promise<boolean> {
  const parts = signature.split(',');
  const timestamp = parts.find(part => part.startsWith('t='))?.split('=')[1];
  const stripeSignature = parts.find(part => part.startsWith('v1='))?.split('=')[1];

  if (!timestamp || !stripeSignature) {
    throw new Error('Invalid signature header format.');
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signedPayload = `${timestamp}.${body}`;
  const signatureBuffer = new Uint8Array(stripeSignature.match(/../g)!.map(h => parseInt(h, 16)));
  
  return await crypto.subtle.verify('HMAC', key, signatureBuffer, encoder.encode(signedPayload));
}

const manageSubscriptionStatusChange = async (supabaseAdmin: any, subscriptionId: string, status: 'active' | 'past_due' | 'cancelled', periodEnd?: number) => {
  const updateData: { status: string, current_period_end?: string } = { status };
  if (periodEnd) {
    updateData.current_period_end = new Date(periodEnd * 1000).toISOString();
  }

  const { error } = await supabaseAdmin
    .from('users_subscriptions')
    .update(updateData)
    .eq('gateway_subscription_id', subscriptionId);
  
  if (error) throw error;
  console.log(`Subscription ${subscriptionId} status updated to ${status}.`);
};

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const signingSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');

  try {
    if (!signature || !signingSecret) {
      throw new Error('Webhook Error: Missing stripe-signature or signing secret.');
    }

    const body = await req.text();
    const isValid = await verifySignature(signature, body, signingSecret);
    if (!isValid) throw new Error('Webhook signature verification failed.');
    
    console.log('Stripe signature verified successfully.');
    const event = JSON.parse(body) as Stripe.Event;
    
    const supabaseAdmin = createClient(
      Deno.env.get('APP_SUPABASE_URL')!,
      Deno.env.get('APP_SUPABASE_SERVICE_ROLE_KEY')!
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const priceId = session.metadata?.price_id;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (!userId || !priceId || !subscriptionId || !customerId) {
          throw new Error('Webhook error: Missing metadata in checkout session.');
        }

        const { error: userUpdateError } = await supabaseAdmin
          .from('users')
          .update({ gateway_customer_id: customerId })
          .eq('id', userId);
        if (userUpdateError) throw new Error(`Failed to update user with customer ID: ${userUpdateError.message}`);
        console.log(`User ${userId} updated with Stripe customer ID ${customerId}`);

        const { error: rpcError } = await supabaseAdmin.rpc('update_user_subscription', {
          p_user_id: userId,
          p_price_id: priceId,
          p_gateway_subscription_id: subscriptionId,
        });
        if (rpcError) throw new Error(`Supabase RPC Error: ${rpcError.message}`);
        
        console.log(`Successfully processed initial subscription for user ${userId}`);
        
        // Track CleverTap events
        await trackCleverTapEvent(userId, 'Payment Success', {
          gateway: 'stripe',
          payment_type: 'subscription',
          price_id: priceId,
          subscription_id: subscriptionId,
          customer_id: customerId
        });
        
        await trackCleverTapEvent(userId, 'Subscription Succeeded', {
          gateway: 'stripe',
          price_id: priceId,
          subscription_id: subscriptionId
        });
        
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        const subscription = await new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!).subscriptions.retrieve(subscriptionId);
        
        await manageSubscriptionStatusChange(supabaseAdmin, subscriptionId, 'active', subscription.current_period_end);
        
        // Get user_id from subscription metadata or users_subscriptions table
        const { data: subData } = await supabaseAdmin
          .from('users_subscriptions')
          .select('user_id')
          .eq('gateway_subscription_id', subscriptionId)
          .single();
        
        if (subData?.user_id) {
          await trackCleverTapEvent(subData.user_id, 'Payment Success', {
            gateway: 'stripe',
            payment_type: 'subscription_renewal',
            subscription_id: subscriptionId,
            invoice_id: invoice.id,
            amount: invoice.amount_paid / 100
          });
        }
        
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        await manageSubscriptionStatusChange(supabaseAdmin, subscriptionId, 'past_due');
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await manageSubscriptionStatusChange(supabaseAdmin, subscription.id, 'cancelled');
        
        // Get user_id from subscription metadata or users_subscriptions table
        const { data: subData } = await supabaseAdmin
          .from('users_subscriptions')
          .select('user_id')
          .eq('gateway_subscription_id', subscription.id)
          .single();
        
        if (subData?.user_id) {
          await trackCleverTapEvent(subData.user_id, 'Subscription Cancelled', {
            gateway: 'stripe',
            subscription_id: subscription.id
          });
        }
        
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error('[FATAL] Stripe webhook processing failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});
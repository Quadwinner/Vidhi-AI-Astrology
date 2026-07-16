import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface TopupRequestBody {
  amount: number;        // Amount to PAY (Minor units, e.g., 9000 = ₹90.00)
  credit_amount?: number;// Amount to CREDIT (Minor units, e.g., 12000 = ₹120.00)
  currency: string;      // 'INR', 'USD'
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

    // Amount to Charge the User
    const amountToPay = Number(body.amount);
    
    // Amount to Add to Wallet (Fallback to pay amount if no bonus specified)
    const amountToCredit = body.credit_amount ? Number(body.credit_amount) : amountToPay;
    
    const currency = body.currency || 'USD';

    if (!Number.isFinite(amountToPay) || amountToPay <= 0) {
      return jsonResponse({ error: 'Invalid amount' }, 400);
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
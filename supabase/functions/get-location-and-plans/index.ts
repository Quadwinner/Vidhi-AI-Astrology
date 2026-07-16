import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createCorsWrappedHandler } from '../_shared/cors.ts';

// 1. UPDATE INTERFACE: Added 'wallet_credit_amount'
interface PlanWithPrice {
  id: string; 
  name: string; 
  description: string; 
  interval: 'month' | 'year';
  price: { 
    id: number; 
    amount: number; 
    currency: string; 
    gateway_price_id: string; 
    wallet_credit_amount: number; // <--- ADDED THIS
  };
  entitlements?: {
    questions_per_month: number;
    daily_horoscope_enabled: boolean;
    divisional_charts_enabled: boolean;
    ai_call_talk_minutes: number;
    weekly_forecasts_enabled: boolean;
    max_profiles: number;
    max_saved_threads: number;
    coins_granted_on_subscription: number;
  };
}

// Helper function to detect Europe
function isEuropeanCountry(countryCode: string): boolean {
  const europeanCountries = new Set(['AL', 'AD', 'AM', 'AT', 'BY', 'BE', 'BA', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FO', 'FI', 'FR', 'GR', 'GE', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MK', 'MT', 'NO', 'NL', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SK', 'SM', 'TR', 'UA', 'VA']);
  return europeanCountries.has(countryCode);
}

async function handler(req: Request) {
  try {
  
    let userCountry = 'US'; // Default

    // 1. First, try to get Physical Location from Header
    const vercelCountry = req.headers.get('x-vercel-ip-country');
    if (vercelCountry) {
      userCountry = vercelCountry;
    }

    // 2. Second, CHECK THE BODY. This must run REGARDLESS of the header.
    // This allows the frontend to OVERRIDE physical location.
    try {
      const body = await req.json();
      if (body.country && typeof body.country === 'string') {
        userCountry = body.country; // <--- Override happens here
        console.log('Overriding location with user preference:', userCountry);
      }
    } catch (e) {
      console.warn('No body provided or invalid JSON');
    }

    const country = userCountry.toUpperCase();


    // 2. Determine Currency
    let currency = 'usd'; // Fallback
    
    const currencyMap: { [countryCode: string]: string } = {
      'IN': 'inr', // India -> Rupee
      'AE': 'aed', // UAE -> Dirham
      'GB': 'gbp', // UK -> Pound
      'UK': 'gbp', // Catch alias for UK if provider sends it
      'US': 'usd', // USA -> Dollar
      'CA': 'usd', // Canada -> Dollar (fallback)
      'AU': 'usd', // Australia -> Dollar (fallback)
    };

    if (currencyMap[country]) {
      currency = currencyMap[country];
    } else if (isEuropeanCountry(country)) {
      // Since we don't have EUR tables yet, default Europe to GBP
      currency = 'gbp';
    }

    console.log(`Received request for country: ${country}. Responding with currency: ${currency}.`);

    // 3. Database Query
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Explicitly select wallet_credit_amount
    const { data, error } = await supabaseAdmin.from('prices').select(
      `id, amount, currency, gateway_price_id, wallet_credit_amount, subscription_plans(id, name, description, interval)`
    ).eq('currency', currency);

    if (error) throw error;

    // 4. Format Response
    const formattedPlans: PlanWithPrice[] = data.map((price: any) => ({
      id: price.subscription_plans.id, 
      name: price.subscription_plans.name,
      description: price.subscription_plans.description, 
      interval: price.subscription_plans.interval,
      price: { 
        id: price.id, 
        amount: price.amount, 
        currency: price.currency, 
        gateway_price_id: price.gateway_price_id,
        // Ensure this is passed to frontend
        wallet_credit_amount: price.wallet_credit_amount 
      },
    }));

    // 5. Fetch Entitlements (Merge Logic)
    const planIds = formattedPlans.map(p => p.id);
    if (planIds.length > 0) {
      const { data: entitlementsRows, error: entError } = await supabaseAdmin
        .from('plan_entitlements')
        .select('plan_id, questions_per_month, daily_horoscope_enabled, divisional_charts_enabled, ai_call_talk_minutes, weekly_forecasts_enabled, max_profiles, max_saved_threads, coins_granted_on_subscription')
        .in('plan_id', planIds);
        
      if (entError) throw entError;
      
      const byPlan: Record<string, any> = Object.create(null);
      for (const row of entitlementsRows || []) {
        byPlan[row.plan_id] = {
          questions_per_month: row.questions_per_month,
          daily_horoscope_enabled: row.daily_horoscope_enabled,
          divisional_charts_enabled: row.divisional_charts_enabled,
          ai_call_talk_minutes: row.ai_call_talk_minutes,
          weekly_forecasts_enabled: row.weekly_forecasts_enabled,
          max_profiles: row.max_profiles,
          max_saved_threads: row.max_saved_threads,
          coins_granted_on_subscription: row.coins_granted_on_subscription,
        };
      }
      
      for (const plan of formattedPlans) {
        // Map 'month'/'year' interval to plan ID keys
        const entitlementKey = plan.interval === 'month' ? 'monthly' : 'yearly';
        if (byPlan[entitlementKey]) {
          plan.entitlements = byPlan[entitlementKey];
        }
      }
    }

    return new Response(JSON.stringify({ plans: formattedPlans }), {
      headers: { 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (error) {
    console.error('--- GET LOCATION AND PLANS FAILED ---', error.message);
    throw error;
  }
}

Deno.serve(createCorsWrappedHandler(handler));
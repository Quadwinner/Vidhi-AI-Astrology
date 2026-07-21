import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

const VEDIC_BASE = 'https://api.vedicastroapi.com/v3-json';
const DEFAULT_FREE_DRAWS = 50;

const ENDPOINTS: Record<string, string> = {
  daily: '/tarot/daily',
  'yes-no': '/tarot/yes-no',
  love: '/tarot/in-depth-love',
  career: '/tarot/career-select',
  fortune: '/tarot/fortune-cookie',
};

async function handler(req: Request): Promise<Response> {
  const json = (obj: any, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const type = typeof body?.type === 'string' ? body.type : 'daily';
    const lang = body?.lang === 'hi' ? 'hi' : 'en';

    const endpoint = ENDPOINTS[type];
    if (!endpoint) return json({ error: 'invalid_type' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Authentication failed' }, 401);

    const { data: dbUser, error: userError } = await admin
      .from('users')
      .select('currency_code, wallet_balance, subscription_status, tarot_free_draws_used')
      .eq('id', user.id)
      .single();
    if (userError || !dbUser) return json({ error: 'User fetch failed' }, 500);

    const currency = dbUser.currency_code || 'USD';
    const balance = dbUser.wallet_balance || 0;
    const isPremium = dbUser.subscription_status === 'active';
    const freeUsed = dbUser.tarot_free_draws_used || 0;

    const { data: freeSetting } = await admin
      .from('settings').select('value').eq('key', 'tarot_free_draws_premium').maybeSingle();
    const freeLimit = Number.parseInt(freeSetting?.value ?? '', 10) || DEFAULT_FREE_DRAWS;

    const useFreeDraw = isPremium && freeUsed < freeLimit;

    let cost = 0;
    if (!useFreeDraw) {
      const { data: priceRows } = await admin
        .from('service_prices')
        .select('price_amount')
        .eq('service_key', 'tarot_draw')
        .eq('currency_code', currency)
        .order('price_amount', { ascending: true })
        .limit(1);
      if (!priceRows || priceRows.length === 0) return json({ error: 'price_missing' }, 500);
      cost = priceRows[0].price_amount;
      if (balance < cost) {
        return json({
          error: 'insufficient_funds',
          message: 'You don\u2019t have enough balance for a tarot reading. Please recharge and try again.',
          required: cost, balance, currency,
        }, 402);
      }
    }

    const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
    if (!apiKey) return json({ error: 'VEDICASTRO_API_KEY not set' }, 500);

    const params = new URLSearchParams({ lang, api_key: apiKey });
    const isFreshDraw = type !== 'daily';
    if (isFreshDraw) {
      params.set('_ts', `${Date.now()}-${crypto.randomUUID()}`);
      const question = typeof body?.question === 'string' ? body.question.trim() : '';
      if (question) params.set('question', question.slice(0, 200));
    }

    const url = `${VEDIC_BASE}${endpoint}?${params.toString()}`;
    const r = await fetch(url, {
      cache: isFreshDraw ? 'no-store' : 'default',
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json().catch(() => null);

    if (!j || j.status !== 200 || j.response === undefined) {
      console.error(`[get-tarot-reading] ${type} failed: ${JSON.stringify(j).slice(0, 160)}`);
      return json({ error: 'source_unavailable', message: 'The cards are unavailable right now. Please try again shortly.' }, 200);
    }

    if (type === 'yes-no') {
      const resp = j.response ?? {};
      console.log(`[get-tarot-reading] yes-no name=${resp?.name} direction=${resp?.direction} meaning=${resp?.meaning} answer=${resp?.answer}`);
    }

    let newBalance = balance;
    let newFreeUsed = freeUsed;
    if (useFreeDraw) {
      newFreeUsed = freeUsed + 1;
      await admin.from('users').update({ tarot_free_draws_used: newFreeUsed }).eq('id', user.id);
    } else {
      newBalance = balance - cost;
      await admin.from('users').update({ wallet_balance: newBalance }).eq('id', user.id);
    }

    return json({
      type,
      response: j.response,
      meta: {
        charged: !useFreeDraw,
        cost: useFreeDraw ? 0 : cost,
        currency,
        wallet_balance: newBalance,
        is_premium: isPremium,
        free_draws_limit: freeLimit,
        free_draws_used: newFreeUsed,
        free_draws_remaining: isPremium ? Math.max(0, freeLimit - newFreeUsed) : 0,
      },
    });
  } catch (err: any) {
    console.error(`[get-tarot-reading] ${err.message}`);
    return json({ error: err.message }, 200);
  }
}

Deno.serve(createCorsWrappedHandler(handler));

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';
import { checkGate, commitGate, getUserFromAuth } from '../_shared/monetize.ts';
import { checkRateLimit } from '../_shared/ratelimit.ts';

const VEDIC_BASE = 'https://api.vedicastroapi.com/v3-json';
const FEATURE = 'gemstone';
const FREE_KEY = 'gemstone_free_premium';

async function handler(req: Request): Promise<Response> {
  const json = (obj: any, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const bd = body?.birth || {};
    const lang = body?.lang === 'hi' ? 'hi' : 'en';
    for (const k of ['dob', 'tob', 'lat', 'lon', 'tz']) {
      if (bd[k] === undefined || bd[k] === null || bd[k] === '') return json({ error: 'validation', message: `Missing birth.${k}` }, 400);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { user, error: authErr } = await getUserFromAuth(admin, req);
    if (!user) return json({ error: authErr }, 401);

    const rl = await checkRateLimit(admin, user.id, FEATURE, 15, 60);
    if (!rl.ok) return json({ error: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.', retry_after: rl.retryAfter }, 429);

    const gate = await checkGate(admin, user.id, FEATURE, FREE_KEY, 10);
    if (!gate.ok) return json(gate.payload, gate.status);

    const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
    if (!apiKey) return json({ error: 'VEDICASTRO_API_KEY not set' }, 500);

    const q = new URLSearchParams({ dob: bd.dob, tob: bd.tob, lat: String(bd.lat), lon: String(bd.lon), tz: String(bd.tz), lang, api_key: apiKey }).toString();

    const [gemR, rudR] = await Promise.allSettled([
      fetch(`${VEDIC_BASE}/extended-horoscope/gem-suggestion?${q}`, { signal: AbortSignal.timeout(15000) }).then((r) => r.json()),
      fetch(`${VEDIC_BASE}/extended-horoscope/rudraksh-suggestion?${q}`, { signal: AbortSignal.timeout(15000) }).then((r) => r.json()),
    ]);

    const gem = gemR.status === 'fulfilled' && gemR.value?.status === 200 ? gemR.value.response : null;
    const rudraksha = rudR.status === 'fulfilled' && rudR.value?.status === 200 ? rudR.value.response : null;
    if (!gem && !rudraksha) {
      return json({ error: 'source_unavailable', message: 'Recommendations are unavailable right now. Please try again shortly.' }, 200);
    }

    const meta = await commitGate(admin, user.id, FEATURE, gate);
    return json({ response: { gem, rudraksha }, meta });
  } catch (err: any) {
    console.error(`[get-gemstone] ${err.message}`);
    return json({ error: err.message }, 200);
  }
}

Deno.serve(createCorsWrappedHandler(handler));

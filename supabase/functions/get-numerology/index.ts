import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';
import { checkGate, commitGate, getUserFromAuth } from '../_shared/monetize.ts';
import { checkRateLimit } from '../_shared/ratelimit.ts';

const VEDIC_BASE = 'https://api.vedicastroapi.com/v3-json';
const FEATURE = 'numerology';
const FREE_KEY = 'numerology_free_premium';

async function handler(req: Request): Promise<Response> {
  const json = (obj: any, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const date = typeof body?.date === 'string' ? body.date.trim() : '';
    const lang = body?.lang === 'hi' ? 'hi' : 'en';
    if (!name) return json({ error: 'validation', message: 'Missing name' }, 400);
    if (!date) return json({ error: 'validation', message: 'Missing date' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { user, error: authErr } = await getUserFromAuth(admin, req);
    if (!user) return json({ error: authErr }, 401);

    const rl = await checkRateLimit(admin, user.id, FEATURE, 15, 60);
    if (!rl.ok) return json({ error: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.', retry_after: rl.retryAfter }, 429);

    const gate = await checkGate(admin, user.id, FEATURE, FREE_KEY, 10);
    if (!gate.ok) return json(gate.payload, gate.status);

    const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
    if (!apiKey) return json({ error: 'VEDICASTRO_API_KEY not set' }, 500);

    const params = new URLSearchParams({ name, date, lang, api_key: apiKey });
    const r = await fetch(`${VEDIC_BASE}/prediction/numerology?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => null);
    if (!j || j.status !== 200 || j.response === undefined) {
      console.error(`[get-numerology] failed: ${JSON.stringify(j).slice(0, 160)}`);
      return json({ error: 'source_unavailable', message: 'Numerology is unavailable right now. Please try again shortly.' }, 200);
    }

    const meta = await commitGate(admin, user.id, FEATURE, gate);
    return json({ response: j.response, meta });
  } catch (err: any) {
    console.error(`[get-numerology] ${err.message}`);
    return json({ error: err.message }, 200);
  }
}

Deno.serve(createCorsWrappedHandler(handler));

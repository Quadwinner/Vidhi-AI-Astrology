import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';
import { checkGate, commitGate, getUserFromAuth } from '../_shared/monetize.ts';

const VEDIC_BASE = 'https://api.vedicastroapi.com/v3-json';
const FEATURE = 'kundli_matching';
const FREE_KEY = 'kundli_matching_free_premium';

function required(p: any, keys: string[]): string | null {
  for (const k of keys) if (p[k] === undefined || p[k] === null || p[k] === '') return k;
  return null;
}

async function handler(req: Request): Promise<Response> {
  const json = (obj: any, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const boy = body?.boy || {};
    const girl = body?.girl || {};
    const lang = body?.lang === 'hi' ? 'hi' : 'en';

    const boyMissing = required(boy, ['dob', 'tob', 'lat', 'lon', 'tz']);
    const girlMissing = required(girl, ['dob', 'tob', 'lat', 'lon', 'tz']);
    if (boyMissing) return json({ error: 'validation', message: `Missing boy.${boyMissing}` }, 400);
    if (girlMissing) return json({ error: 'validation', message: `Missing girl.${girlMissing}` }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { user, error: authErr } = await getUserFromAuth(admin, req);
    if (!user) return json({ error: authErr }, 401);

    const gate = await checkGate(admin, user.id, FEATURE, FREE_KEY, 10);
    if (!gate.ok) return json(gate.payload, gate.status);

    const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
    if (!apiKey) return json({ error: 'VEDICASTRO_API_KEY not set' }, 500);

    const params = new URLSearchParams({
      boy_dob: boy.dob, boy_tob: boy.tob, boy_tz: String(boy.tz), boy_lat: String(boy.lat), boy_lon: String(boy.lon),
      girl_dob: girl.dob, girl_tob: girl.tob, girl_tz: String(girl.tz), girl_lat: String(girl.lat), girl_lon: String(girl.lon),
      lang, api_key: apiKey,
    });
    const r = await fetch(`${VEDIC_BASE}/matching/ashtakoot?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => null);
    if (!j || j.status !== 200 || j.response === undefined) {
      console.error(`[get-kundli-matching] failed: ${JSON.stringify(j).slice(0, 160)}`);
      return json({ error: 'source_unavailable', message: 'Matching is unavailable right now. Please try again shortly.' }, 200);
    }

    const meta = await commitGate(admin, user.id, FEATURE, gate);
    return json({ response: j.response, meta });
  } catch (err: any) {
    console.error(`[get-kundli-matching] ${err.message}`);
    return json({ error: err.message }, 200);
  }
}

Deno.serve(createCorsWrappedHandler(handler));

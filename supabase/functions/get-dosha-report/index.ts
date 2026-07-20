import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';
import { checkGate, commitGate, getUserFromAuth } from '../_shared/monetize.ts';

const VEDIC_BASE = 'https://api.vedicastroapi.com/v3-json';
const FEATURE = 'dosha_report';
const FREE_KEY = 'dosha_report_free_premium';

const DOSHAS = [
  { key: 'mangal', path: '/dosha/mangal-dosh' },
  { key: 'kaalsarp', path: '/dosha/kaalsarp-dosh' },
  { key: 'pitra', path: '/dosha/pitra-dosh' },
  { key: 'sade_sati', path: '/extended-horoscope/current-sade-sati' },
];

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

    const gate = await checkGate(admin, user.id, FEATURE, FREE_KEY, 10);
    if (!gate.ok) return json(gate.payload, gate.status);

    const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
    if (!apiKey) return json({ error: 'VEDICASTRO_API_KEY not set' }, 500);

    const base = (extra: Record<string, string> = {}) => {
      const p = new URLSearchParams({ dob: bd.dob, tob: bd.tob, lat: String(bd.lat), lon: String(bd.lon), tz: String(bd.tz), lang, api_key: apiKey, ...extra });
      return p.toString();
    };

    const settled = await Promise.allSettled(DOSHAS.map(async (d) => {
      const r = await fetch(`${VEDIC_BASE}${d.path}?${base()}`, { signal: AbortSignal.timeout(15000) });
      const j = await r.json().catch(() => null);
      if (!j || j.status !== 200 || j.response === undefined) throw new Error('bad');
      return { key: d.key, response: j.response };
    }));

    const doshas: Record<string, any> = {};
    let okCount = 0;
    settled.forEach((s, i) => {
      const key = DOSHAS[i].key;
      if (s.status === 'fulfilled') { doshas[key] = s.value.response; okCount++; }
      else doshas[key] = { error: true };
    });

    if (okCount === 0) {
      return json({ error: 'source_unavailable', message: 'Dosha analysis is unavailable right now. Please try again shortly.' }, 200);
    }

    const meta = await commitGate(admin, user.id, FEATURE, gate);
    return json({ response: doshas, meta });
  } catch (err: any) {
    console.error(`[get-dosha-report] ${err.message}`);
    return json({ error: err.message }, 200);
  }
}

Deno.serve(createCorsWrappedHandler(handler));

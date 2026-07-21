import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';
import { getUserFromAuth } from '../_shared/monetize.ts';
import { checkRateLimit } from '../_shared/ratelimit.ts';

const VEDIC_BASE = 'https://api.vedicastroapi.com/v3-json';

function todayDmyIST(): string {
  const iso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

async function handler(req: Request): Promise<Response> {
  const json = (obj: any, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const date = (typeof body?.date === 'string' && body.date) || todayDmyIST();
    const lat = body?.lat ?? 28.6139;
    const lon = body?.lon ?? 77.2090;
    const tz = body?.tz ?? 5.5;
    const lang = body?.lang === 'hi' ? 'hi' : 'en';

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { user, error: authErr } = await getUserFromAuth(admin, req);
    if (!user) return json({ error: authErr }, 401);

    const rl = await checkRateLimit(admin, user.id, 'panchang', 30, 60);
    if (!rl.ok) return json({ error: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.', retry_after: rl.retryAfter }, 429);

    const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
    if (!apiKey) return json({ error: 'VEDICASTRO_API_KEY not set' }, 500);

    const q = new URLSearchParams({ date, lat: String(lat), lon: String(lon), tz: String(tz), lang, api_key: apiKey }).toString();

    const [panR, horaR] = await Promise.allSettled([
      fetch(`${VEDIC_BASE}/panchang/panchang?${q}`, { signal: AbortSignal.timeout(15000) }).then((r) => r.json()),
      fetch(`${VEDIC_BASE}/panchang/hora-muhurta?${q}`, { signal: AbortSignal.timeout(15000) }).then((r) => r.json()),
    ]);

    const panchang = panR.status === 'fulfilled' && panR.value?.status === 200 ? panR.value.response : null;
    const hora = horaR.status === 'fulfilled' && horaR.value?.status === 200 ? horaR.value.response : null;

    if (!panchang) {
      return json({ error: 'source_unavailable', message: 'Panchang is unavailable right now. Please try again shortly.' }, 200);
    }

    return json({ date, panchang, hora });
  } catch (err: any) {
    console.error(`[get-panchang] ${err.message}`);
    return json({ error: err.message }, 200);
  }
}

Deno.serve(createCorsWrappedHandler(handler));

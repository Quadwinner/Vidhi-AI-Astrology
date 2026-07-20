import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

const VEDIC_BASE = 'https://api.vedicastroapi.com/v3-json';

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

    const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
    if (!apiKey) return json({ error: 'VEDICASTRO_API_KEY not set' }, 500);

    const url = `${VEDIC_BASE}${endpoint}?lang=${lang}&api_key=${apiKey}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => null);

    if (!j || j.status !== 200 || j.response === undefined) {
      console.error(`[get-tarot-reading] ${type} failed: ${JSON.stringify(j).slice(0, 160)}`);
      return json({ error: 'source_unavailable', message: 'The cards are unavailable right now. Please try again shortly.' }, 200);
    }

    return json({ type, response: j.response });
  } catch (err: any) {
    console.error(`[get-tarot-reading] ${err.message}`);
    return json({ error: err.message }, 200);
  }
}

Deno.serve(createCorsWrappedHandler(handler));

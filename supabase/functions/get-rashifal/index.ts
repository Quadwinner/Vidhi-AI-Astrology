// supabase/functions/get-rashifal/index.ts
// Public daily rashifal for all 12 rashis, sourced from the VedicAstro daily-sun
// endpoint (authentic, transit-based) and cached once per day per language in
// daily_rashifal. Users read from the DB cache — the API is called at most once
// per (day, language), not per user.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

const VEDIC_BASE = 'https://api.vedicastroapi.com/v3-json';

// zodiac index 1..12 -> labels
const SIGNS = [
  { key: 'aries', en: 'Aries', hi: 'मेष' },
  { key: 'taurus', en: 'Taurus', hi: 'वृषभ' },
  { key: 'gemini', en: 'Gemini', hi: 'मिथुन' },
  { key: 'cancer', en: 'Cancer', hi: 'कर्क' },
  { key: 'leo', en: 'Leo', hi: 'सिंह' },
  { key: 'virgo', en: 'Virgo', hi: 'कन्या' },
  { key: 'libra', en: 'Libra', hi: 'तुला' },
  { key: 'scorpio', en: 'Scorpio', hi: 'वृश्चिक' },
  { key: 'sagittarius', en: 'Sagittarius', hi: 'धनु' },
  { key: 'capricorn', en: 'Capricorn', hi: 'मकर' },
  { key: 'aquarius', en: 'Aquarius', hi: 'कुम्भ' },
  { key: 'pisces', en: 'Pisces', hi: 'मीन' },
];

function todayIso(): string { return new Date().toLocaleDateString('en-CA'); }
function toDmy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function ratingFromScore(score: number): number {
  if (!score && score !== 0) return 3;
  return Math.max(1, Math.min(5, Math.round(score / 20)));
}

async function fetchSign(apiKey: string, zodiac: number, dmy: string, lang: string) {
  const url = `${VEDIC_BASE}/prediction/daily-sun?zodiac=${zodiac}&date=${dmy}&show_same=true&split=true&type=big&lang=${lang}&api_key=${apiKey}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  if (j?.status !== 200 || !j?.response) throw new Error(`daily-sun ${zodiac}: ${JSON.stringify(j).slice(0, 120)}`);
  const resp = j.response;
  const b = resp.bot_response || {};
  const meta = SIGNS[zodiac - 1];
  const luckyNum = Array.isArray(resp.lucky_number) ? resp.lucky_number[0] : resp.lucky_number;
  return {
    key: meta.key, en: meta.en, hi: meta.hi, sign: meta.en,
    overall: b.total_score?.split_response || '',
    love: b.relationship?.split_response || '',
    career: b.career?.split_response || '',
    health: b.health?.split_response || '',
    finance: b.finances?.split_response || '',
    family: b.family?.split_response || '',
    lucky_color: resp.lucky_color || '',
    lucky_color_code: resp.lucky_color_code || '',
    lucky_number: luckyNum ?? '',
    rating: ratingFromScore(b.total_score?.score),
  };
}

async function handler(req: Request): Promise<Response> {
  const json = (obj: any, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const lang = body?.lang === 'hi' ? 'hi' : 'en';
    const date = (typeof body?.date === 'string' && body.date) || todayIso();

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 1. Serve cache
    const { data: cached } = await admin.from('daily_rashifal')
      .select('data').eq('rashi_date', date).eq('lang', lang).maybeSingle();
    if (cached?.data) return json({ date, lang, cached: true, signs: cached.data });

    // 2. Fetch all 12 from VedicAstro
    const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
    if (!apiKey) return json({ error: 'VEDICASTRO_API_KEY not set' }, 500);
    const dmy = toDmy(date);

    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) => fetchSign(apiKey, i + 1, dmy, lang))
    );
    const signs = results.map((res, i) =>
      res.status === 'fulfilled' ? res.value : { ...SIGNS[i], sign: SIGNS[i].en, overall: '', rating: 3 }
    );

    const okCount = results.filter(r => r.status === 'fulfilled').length;
    if (okCount === 0) {
      const firstErr = (results[0] as PromiseRejectedResult)?.reason?.message || 'unknown';
      console.error(`[get-rashifal] all VedicAstro calls failed: ${firstErr}`);
      return json({ error: 'source_unavailable', message: 'Rashifal source is temporarily unavailable. Please try again shortly.' }, 200);
    }

    // 3. Cache only if we got a complete set (avoid caching partial days)
    if (okCount === 12) {
      await admin.from('daily_rashifal').upsert({ rashi_date: date, lang, data: signs }, { onConflict: 'rashi_date,lang' });
    }

    return json({ date, lang, cached: false, signs });
  } catch (err: any) {
    console.error(`[get-rashifal] ${err.message}`);
    return json({ error: err.message }, 200);
  }
}

Deno.serve(createCorsWrappedHandler(handler));

// supabase/functions/get-rashifal/index.ts
// Public daily rashifal for all 12 rashis. Generated once per day per language
// via the configured Fireworks model and cached in daily_rashifal. Free content.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

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

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}

async function handler(req: Request): Promise<Response> {
  const json = (obj: any, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const lang = body?.lang === 'hi' ? 'hi' : 'en';
    const date = (typeof body?.date === 'string' && body.date) || todayIso();

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 1. Serve from cache if present
    const { data: cached } = await admin.from('daily_rashifal')
      .select('data').eq('rashi_date', date).eq('lang', lang).maybeSingle();
    if (cached?.data) return json({ date, lang, cached: true, signs: cached.data });

    // 2. Generate via LLM (reuse configured chat model)
    const { data: promptRow } = await admin.from('system_prompts')
      .select('model_name, secret_name').eq('prompt_name', 'text_chat_default').eq('is_active', true).maybeSingle();
    const modelName = promptRow?.model_name || 'accounts/fireworks/models/gpt-oss-120b';
    const secretName = promptRow?.secret_name || 'FIREWORKS_API_KEY';
    const apiKey = Deno.env.get(secretName);
    if (!apiKey) return json({ error: 'LLM key not set' }, 500);

    const langName = lang === 'hi' ? 'Hindi' : 'English';
    const signList = SIGNS.map(s => `${s.en} (${s.hi})`).join(', ');
    const systemPrompt =
`You are a warm, insightful Vedic astrologer writing the DAILY RASHIFAL (horoscope) for ${date}.
Write all text in ${langName}. Cover ALL 12 rashis: ${signList}.

Return ONLY a valid JSON object (no markdown/code fences) shaped as { "signs": [ ...12 objects... ] }, with the 12 objects in this exact order (Aries first ... Pisces last). Each object:
{
  "sign": "English sign name",
  "overall": "2-3 sentence general outlook for the day",
  "love": "1-2 sentences",
  "career": "1-2 sentences",
  "health": "1 sentence",
  "finance": "1 sentence",
  "lucky_color": "one color",
  "lucky_number": "a number 1-9",
  "rating": 4  // overall day rating 1-5 integer
}
Keep it positive, practical, non-fear-based. Vary the guidance meaningfully between signs. Text values in ${langName}; keep JSON keys in English.`;

    const isFireworks = modelName.toLowerCase().startsWith('accounts/fireworks/');
    const apiUrl = isFireworks ? 'https://api.fireworks.ai/inference/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Give today's rashifal for all 12 signs in ${langName}.` }],
        temperature: 0.7, max_tokens: 3500, reasoning_effort: 'low',
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[get-rashifal] LLM error ${res.status}: ${errText}`);
      return json({ error: 'llm_error', message: 'Could not prepare rashifal right now.' }, 200);
    }
    const data = await res.json();
    let content = data.choices?.[0]?.message?.content || '';
    // extract array (some models wrap in an object)
    let signs: any = null;
    try {
      const parsed = JSON.parse(content);
      signs = Array.isArray(parsed)
        ? parsed
        : (parsed.signs || parsed.rashifal || parsed.horoscopes || parsed.predictions || parsed.data || parsed.result || null);
    } catch {
      const start = content.indexOf('['); const end = content.lastIndexOf(']');
      if (start !== -1 && end !== -1) { try { signs = JSON.parse(content.slice(start, end + 1)); } catch { /* noop */ } }
    }
    if (!Array.isArray(signs) || signs.length === 0) return json({ error: 'parse_error', message: 'Could not prepare rashifal right now.' }, 200);

    // attach hindi labels for UI convenience
    const enriched = signs.map((s: any, i: number) => ({ ...s, key: SIGNS[i]?.key, hi: SIGNS[i]?.hi, en: SIGNS[i]?.en }));

    // 3. Cache (ignore conflict if another request beat us)
    await admin.from('daily_rashifal').upsert({ rashi_date: date, lang, data: enriched }, { onConflict: 'rashi_date,lang' });

    return json({ date, lang, cached: false, signs: enriched });
  } catch (err: any) {
    console.error(`[get-rashifal] ${err.message}`);
    return json({ error: err.message }, 200);
  }
}

Deno.serve(createCorsWrappedHandler(handler));

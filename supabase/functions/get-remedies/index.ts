// supabase/functions/get-remedies/index.ts
// Returns STRUCTURED, chart-grounded Vedic remedies as JSON so the client can
// render visually rich cards. Falls back to { raw } text if JSON parsing fails.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

async function processWalletDeduction(supabaseAdmin: any, userId: string, serviceKey: string, quantity = 1, variantName = 'control') {
  const { data: user, error: userError } = await supabaseAdmin
    .from('users').select('currency_code, wallet_balance').eq('id', userId).single();
  if (userError || !user) throw new Error(`User fetch failed: ${userError?.message}`);
  const currency = user.currency_code || 'USD';
  const currentBalance = user.wallet_balance || 0;
  const pick = async (variant: string) => {
    const { data } = await supabaseAdmin.from('service_prices').select('price_amount')
      .eq('service_key', serviceKey).eq('currency_code', currency).eq('variant_name', variant)
      .order('price_amount', { ascending: true }).limit(1);
    return data && data.length ? data[0].price_amount : null;
  };
  const price = (await pick(variantName)) ?? (await pick('control'));
  if (price == null) throw new Error(`Price configuration missing for '${serviceKey}' in '${currency}'`);
  const totalCost = price * quantity;
  if (currentBalance < totalCost) return { success: false, required: totalCost, balance: currentBalance, currency };
  const { error: updateError } = await supabaseAdmin.from('users').update({ wallet_balance: currentBalance - totalCost }).eq('id', userId);
  if (updateError) throw new Error(`Deduction failed: ${updateError.message}`);
  return { success: true, deducted: totalCost, newBalance: currentBalance - totalCost, currency };
}

function extractJson(text: string): any | null {
  if (!text) return null;
  let s = text.trim();
  // strip code fences
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}

async function handler(req: Request): Promise<Response> {
  const json = (obj: any, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { profile_id, problem_area, problem_text, client_date, monetization_variant } = await req.json();
    if (!profile_id) return json({ error: 'Missing profile_id' }, 400);

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Authentication failed' }, 401);

    const deduction = await processWalletDeduction(supabaseAdmin, user.id, 'remedy', 1, monetization_variant || 'control');
    if (!deduction.success) {
      return json({ error: 'insufficient_funds', required: deduction.required, balance: deduction.balance, currency: deduction.currency }, 402);
    }

    // Chart data
    const [profileRes, astroDataRes] = await Promise.allSettled([
      supabaseAdmin.from('user_profiles').select('name, user_birth_details(gender, date_of_birth)').eq('id', profile_id).single(),
      supabaseAdmin.from('profile_astro_data').select('processed_tables_path, vimshottari_dasha, yogas_llm').eq('profile_id', profile_id).single(),
    ]);
    if (profileRes.status === 'rejected') return json({ error: 'Failed to fetch profile.' }, 400);
    const profileName = (profileRes.value.data as any)?.name || 'the user';
    if (astroDataRes.status === 'rejected' || !(astroDataRes.value.data as any)?.processed_tables_path) {
      return json({ error: 'no_chart', message: 'Astrological data has not been generated for this profile yet.' }, 200);
    }
    const astroData: any = astroDataRes.value.data;
    const { data: blob, error: dErr } = await supabaseAdmin.storage.from('astro-data').download(astroData.processed_tables_path);
    if (dErr) return json({ error: 'Failed to load chart data.' }, 400);
    const t = JSON.parse(await blob.text());

    const d1 = JSON.stringify(t.d1_planets || []);
    const houses = JSON.stringify(t.houses || []);
    const doshas = JSON.stringify(t.doshas || []);
    const dasha = JSON.stringify(t.vimshottari_dasha || astroData.vimshottari_dasha || []);
    let yogas = 'Not available';
    if (Array.isArray(t.yogas) && t.yogas.length && !t.yogas[0].Error) {
      yogas = JSON.stringify(t.yogas.map((y: any) => ({ name: y['Yoga Name'], description: y['Description'] })));
    } else if (astroData.yogas_llm?.yogas) yogas = JSON.stringify(astroData.yogas_llm.yogas);

    const { data: promptRow } = await supabaseAdmin.from('system_prompts')
      .select('model_name, secret_name').eq('prompt_name', 'text_chat_default').eq('is_active', true).maybeSingle();
    const modelName = promptRow?.model_name || 'accounts/fireworks/models/gpt-oss-120b';
    const secretName = promptRow?.secret_name || 'FIREWORKS_API_KEY';
    const apiKey = Deno.env.get(secretName);
    if (!apiKey) return json({ error: `API key '${secretName}' not set.` }, 500);

    const focus = (problem_text && String(problem_text).trim()) || problem_area || 'overall life';

    const systemPrompt =
`You are an expert, compassionate male Vedic astrologer. Using ONLY the real birth-chart data below for ${profileName}, produce personalized Vedic REMEDIES (upaay) for their concern: "${focus}".

CURRENT DATE: ${new Date(client_date || Date.now()).toDateString()}

CHART DATA (JSON):
D1 Planets: ${d1}
Houses: ${houses}
Doshas: ${doshas}
Vimshottari Dasha: ${dasha}
Yogas: ${yogas}

Return ONLY a valid JSON object (no markdown, no code fences, no commentary) with EXACTLY this shape:
{
  "intro": "1-2 sentence personalized summary that names the responsible planet(s)/house(s)/dasha for the concern",
  "focus_planets": ["planet names most relevant"],
  "gemstones": [ { "stone": "", "planet": "", "finger": "", "metal": "", "day": "", "note": "short reason/how to wear" } ],
  "mantras": [ { "mantra": "transliteration", "for": "planet/deity", "count": "e.g. 108 daily", "day": "best day" } ],
  "rudraksha": { "mukhi": "e.g. 3 Mukhi", "note": "" },
  "charity": [ { "item": "what to donate", "day": "weekday" } ],
  "practices": [ "short daily spiritual practices, e.g. light a diya, Hanuman Chalisa" ],
  "lifestyle": [ "practical, non-superstitious tips" ],
  "closing": "one encouraging sentence"
}

RULES:
- Ground each remedy in the chart (reflect the responsible planet). Do NOT invent chart facts. If a section doesn't apply, use an empty array or null.
- Only recommend gemstones genuinely supportive for THIS chart.
- Address the person as ${profileName}. NEVER call them "Ravi" — Ravi/Surya is the Sun (a planet), not the user.
- LANGUAGE: write ALL text VALUES in the SAME language as the user's request (English request -> English; Hindi -> Hindi; Hinglish -> Hinglish). Keep JSON keys in English.
- Keep values concise and speakable. Safe, optional, respectful. No medical/legal/financial guarantees.`;

    const userMsg = problem_text && String(problem_text).trim()
      ? String(problem_text).trim()
      : `Give me Vedic remedies for: ${problem_area || 'my overall life'}.`;

    const isFireworks = modelName.toLowerCase().startsWith('accounts/fireworks/');
    const apiUrl = isFireworks ? 'https://api.fireworks.ai/inference/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        temperature: 0.5, max_tokens: 2600, reasoning_effort: 'low',
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[get-remedies] LLM error ${res.status}: ${errText}`);
      return json({ error: 'llm_error', message: 'Could not prepare remedies right now. Please try again.' }, 200);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);

    // Persist (best-effort)
    try {
      const summary = parsed?.intro || content.slice(0, 400);
      await supabaseAdmin.from('chat_history').insert({
        profile_id, user_id: user.id, message_content: `[Remedy: ${focus}] ${summary}`, role: 'assistant', question_category: 'remedy',
      });
    } catch { /* noop */ }

    if (parsed) return json({ profile_name: profileName, focus, remedies: parsed });
    return json({ profile_name: profileName, focus, raw: content });
  } catch (err: any) {
    console.error(`[get-remedies] ${err.message}`);
    return json({ error: err.message }, 200);
  }
}

Deno.serve(createCorsWrappedHandler(handler));

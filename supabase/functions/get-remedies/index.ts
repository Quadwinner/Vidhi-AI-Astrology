// supabase/functions/get-remedies/index.ts
// Streams personalized Vedic remedies for a given problem area, grounded in the
// profile's real chart data (planets, houses, dasha, yogas, doshas). Reuses the
// same Fireworks model configured for text chat. Language mirrors the user.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

// --- Wallet deduction (mirrors get-chat-answer) ---
async function processWalletDeduction(supabaseAdmin: any, userId: string, serviceKey: string, quantity = 1, variantName = 'control') {
  const { data: user, error: userError } = await supabaseAdmin
    .from('users').select('currency_code, wallet_balance').eq('id', userId).single();
  if (userError || !user) throw new Error(`User fetch failed: ${userError?.message}`);
  const currency = user.currency_code || 'USD';
  const currentBalance = user.wallet_balance || 0;
  const { data: priceRows, error: priceError } = await supabaseAdmin
    .from('service_prices').select('price_amount')
    .eq('service_key', serviceKey).eq('currency_code', currency).eq('variant_name', variantName)
    .order('price_amount', { ascending: true }).limit(1);
  if (priceError || !priceRows || priceRows.length === 0) {
    // Fallback to control pricing if the variant has no row
    const { data: ctrl } = await supabaseAdmin.from('service_prices').select('price_amount')
      .eq('service_key', serviceKey).eq('currency_code', currency).eq('variant_name', 'control')
      .order('price_amount', { ascending: true }).limit(1);
    if (!ctrl || ctrl.length === 0) throw new Error(`Price configuration missing for '${serviceKey}' in '${currency}'`);
    priceRows.push(ctrl[0]);
  }
  const totalCost = priceRows[0].price_amount * quantity;
  if (currentBalance < totalCost) return { success: false, required: totalCost, balance: currentBalance, currency };
  const newBalance = currentBalance - totalCost;
  const { error: updateError } = await supabaseAdmin.from('users').update({ wallet_balance: newBalance }).eq('id', userId);
  if (updateError) throw new Error(`Deduction failed: ${updateError.message}`);
  return { success: true, deducted: totalCost, newBalance, currency };
}

async function handler(req: Request) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  (async () => {
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

      const { profile_id, problem_area, problem_text, client_date, monetization_variant } = await req.json();
      if (!profile_id) throw new Error('Missing profile_id');

      const authHeader = req.headers.get('Authorization')!;
      const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication failed');

      // Charge same as a chat message.
      const deduction = await processWalletDeduction(supabaseAdmin, user.id, 'chat_message', 1, monetization_variant || 'control');
      if (!deduction.success) {
        const bal = (deduction.balance / 100).toFixed(2);
        const req_ = (deduction.required / 100).toFixed(2);
        await writer.write(encoder.encode(`Insufficient funds. Balance: ${bal} ${deduction.currency}. Required: ${req_}. Please recharge your wallet.`));
        return;
      }

      // --- Fetch profile + chart data ---
      const [profileRes, astroDataRes] = await Promise.allSettled([
        supabaseAdmin.from('user_profiles').select('name, user_birth_details(gender, date_of_birth)').eq('id', profile_id).single(),
        supabaseAdmin.from('profile_astro_data').select('processed_tables_path, vimshottari_dasha, yogas_llm').eq('profile_id', profile_id).single(),
      ]);
      if (profileRes.status === 'rejected') throw new Error('Failed to fetch profile.');
      const profileData: any = profileRes.value.data;
      const profileName = profileData?.name || 'the user';

      if (astroDataRes.status === 'rejected' || !astroDataRes.value.data?.processed_tables_path) {
        await writer.write(encoder.encode('Astrological data has not been generated for this profile yet. Please generate the chart first.'));
        return;
      }
      const astroData: any = astroDataRes.value.data;
      const { data: blob, error: dErr } = await supabaseAdmin.storage.from('astro-data').download(astroData.processed_tables_path);
      if (dErr) throw new Error('Failed to load chart data.');
      const t = JSON.parse(await blob.text());

      const d1 = JSON.stringify(t.d1_planets || []);
      const houses = JSON.stringify(t.houses || []);
      const doshas = JSON.stringify(t.doshas || []);
      const dasha = JSON.stringify(t.vimshottari_dasha || astroData.vimshottari_dasha || []);
      let yogas = 'Not available';
      if (Array.isArray(t.yogas) && t.yogas.length && !t.yogas[0].Error) {
        yogas = JSON.stringify(t.yogas.map((y: any) => ({ name: y['Yoga Name'], description: y['Description'] })));
      } else if (astroData.yogas_llm?.yogas) {
        yogas = JSON.stringify(astroData.yogas_llm.yogas);
      }

      // --- Model config (reuse the text chat model) ---
      const { data: promptRow } = await supabaseAdmin.from('system_prompts')
        .select('model_name, secret_name').eq('prompt_name', 'text_chat_default').eq('is_active', true).maybeSingle();
      const modelName = promptRow?.model_name || 'accounts/fireworks/models/gpt-oss-120b';
      const secretName = promptRow?.secret_name || 'FIREWORKS_API_KEY';
      const apiKey = Deno.env.get(secretName);
      if (!apiKey) throw new Error(`API key '${secretName}' not set.`);

      const focus = (problem_text && String(problem_text).trim()) || problem_area || 'overall life';

      const systemPrompt =
`You are an expert, compassionate male Vedic astrologer. Based ONLY on the real birth-chart data provided below for ${profileName}, suggest practical Vedic REMEDIES (upaay) for the user's concern.

CURRENT DATE: ${new Date(client_date || Date.now()).toDateString()}

# CHART DATA (JSON):
D1 Planets: ${d1}
Houses: ${houses}
Doshas: ${doshas}
Vimshottari Dasha timeline: ${dasha}
Yogas: ${yogas}

# WHAT TO DO:
Identify the planet(s)/house(s)/dasha responsible for the user's concern ("${focus}"), then give clear, doable remedies. Cover, where relevant:
- Gemstone (stone, finger, metal, weight, day/time to wear) — only if genuinely supportive for THIS chart.
- Mantra (name + simple transliteration + daily count + best day).
- Rudraksha (mukhi) if suitable.
- Charity/donation (item + weekday) and fasting day.
- Deity worship / simple daily practice (e.g., 5-min meditation, Hanuman Chalisa).
- One practical, non-superstitious lifestyle tip.

# RULES:
- Ground every remedy in the chart data above (mention the planet/house/dasha reason briefly). Do NOT invent chart facts.
- Use the person's name (${profileName}). Never call them "Ravi" — Ravi/Surya is the Sun (a planet), not the user.
- Keep remedies safe, optional, and respectful. No fear-mongering, no medical/legal/financial guarantees.
- LANGUAGE: reply in the SAME language as the user's request. English request -> English; Hindi -> Hindi; Hinglish -> Hinglish.
- Speakable, conversational prose. No markdown, no bullet symbols, no tables. Short-to-medium sentences. About 10-16 sentences.`;

      const userMsg = problem_text && String(problem_text).trim()
        ? String(problem_text).trim()
        : `Please give me Vedic remedies for: ${problem_area || 'my overall life'}.`;

      const isFireworks = modelName.toLowerCase().startsWith('accounts/fireworks/');
      const apiUrl = isFireworks
        ? 'https://api.fireworks.ai/inference/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
          stream: true, stream_options: { include_usage: true }, reasoning_effort: 'low', max_tokens: 2600,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[get-remedies] LLM error ${res.status}: ${errText}`);
        await writer.write(encoder.encode('Vidhi could not prepare remedies right now. Please try again in a few moments.'));
        return;
      }

      let full = '';
      let sseBuf = '';
      for await (const chunk of res.body!) {
        const text = sseBuf + decoder.decode(chunk, { stream: true });
        const lines = text.split('\n');
        sseBuf = lines.pop() || '';
        for (const line of lines) {
          const l = line.trim();
          if (!l.startsWith('data:')) continue;
          const dataStr = l.substring(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) { full += content; await writer.write(encoder.encode(content)); }
          } catch { /* ignore partial */ }
        }
      }

      // Persist for history (best-effort)
      if (full && profile_id && user.id) {
        await supabaseAdmin.from('chat_history').insert({
          profile_id, user_id: user.id, message_content: `[Remedy: ${focus}] ${full}`,
          role: 'assistant', question_category: 'remedy',
        });
      }
    } catch (err: any) {
      console.error(`[get-remedies] ${err.message}`);
      await writer.write(encoder.encode(`Error: ${err.message}`));
    } finally {
      try { await writer.close(); } catch { /* noop */ }
    }
  })();

  return new Response(readable, { headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } });
}

Deno.serve(createCorsWrappedHandler(handler));

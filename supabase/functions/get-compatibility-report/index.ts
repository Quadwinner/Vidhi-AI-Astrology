import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@^0.22.0';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

// --- CONFIGURATION ---
const VEDICASTRO_API_BASE_URL = "https://api.vedicastroapi.com/v3-json";
const LANGUAGE = "en";

// --- HELPERS ---

function getTimezoneOffset(ianaTimezone: string, dateString: string): number {
  try {
    if (!ianaTimezone) return 5.5; 
    const date = new Date(`${dateString}T12:00:00Z`);
    try { new Intl.DateTimeFormat('en-US', { timeZone: ianaTimezone }); } catch (e) { return 5.5; }
    
    const formatter = new Intl.DateTimeFormat('en-US', { 
      timeZone: ianaTimezone, hour12: false, year: 'numeric', month: 'numeric', day: 'numeric', 
      hour: 'numeric', minute: 'numeric', second: 'numeric' 
    });
    const parts = formatter.formatToParts(date);
    const targetDate = new Date(
      parseInt(parts.find(p => p.type === 'year')?.value || '0'), 
      parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1, 
      parseInt(parts.find(p => p.type === 'day')?.value || '1'), 
      parseInt(parts.find(p => p.type === 'hour')?.value || '0'), 
      parseInt(parts.find(p => p.type === 'minute')?.value || '0'), 
      parseInt(parts.find(p => p.type === 'second')?.value || '0')
    );
    const offsetInMinutes = (date.getTime() - targetDate.getTime()) / (1000 * 60);
    return -offsetInMinutes / 60;
  } catch (err) { return 5.5; }
}

async function makeVedicastroRequest(endpoint: string, params: object) {
  const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
  if (!apiKey) throw new Error("CRITICAL: VEDICASTRO_API_KEY secret is not set.");
  
  const url = new URL(VEDICASTRO_API_BASE_URL + endpoint);
  const allParams: Record<string, any> = { api_key: apiKey, lang: LANGUAGE, ...params };
  
  Object.keys(allParams).forEach(key => url.searchParams.append(key, allParams[key]));
  
  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) { 
      console.error(`VedicAstro API Error: ${response.status} ${await response.text()}`);
      return null;
  }
  const data = await response.json();
  return data.response;
}

// Minifier for PARTNER data (Raw API format)
function minifyPartnerChartData(apiData: any, type: 'D1' | 'Divisional') {
    if (!apiData || typeof apiData !== 'object') return [];
    const formatPlanet = (p: any, name: string) => ({
        Pl: name.substring(0, 2), Sgn: p.zodiac, H: p.house, Deg: typeof p.local_degree === 'number' ? p.local_degree.toFixed(1) : p.local_degree
    });
    return Object.keys(apiData).map(key => {
        const p = apiData[key];
        const name = p.full_name || p.name;
        if (!name) return null; 
        return formatPlanet(p, name);
    }).filter(p => p);
}

// Minifier for USER data (Processed Table format)
function minifyUserProcessedData(tableData: any[]) {
    if (!Array.isArray(tableData)) return [];
    return tableData.map((p: any) => ({
        Pl: p.Planet.substring(0, 2),
        Sgn: p.Sign,
        H: p.House,
        Deg: p.Degree
    }));
}

async function processWalletDeduction(supabaseAdmin: any, userId: string, serviceKey: string, quantity: number = 1, variantName: string = 'control') {
  const { data: user, error: userError } = await supabaseAdmin.from('users').select('currency_code, wallet_balance').eq('id', userId).single();
  if (userError || !user) throw new Error(`User fetch failed: ${userError?.message}`);
  
  const currency = user.currency_code || 'USD';
  const currentBalance = user.wallet_balance || 0;
  
  const { data: priceData, error: priceError } = await supabaseAdmin.from('service_prices').select('price_amount').eq('service_key', serviceKey).eq('currency_code', currency).eq('variant_name', variantName).single();
  if (priceError || !priceData) throw new Error(`Price missing for '${serviceKey}' in '${currency}' ('${variantName}')`);
  
  const totalCost = priceData.price_amount * quantity;
  if (currentBalance < totalCost) return { success: false, error: 'Insufficient funds', required: totalCost, balance: currentBalance, currency };
  
  const { error: updateError } = await supabaseAdmin.from('users').update({ wallet_balance: currentBalance - totalCost }).eq('id', userId);
  if (updateError) throw new Error(`Deduction failed: ${updateError.message}`);
  
  return { success: true, deducted: totalCost, newBalance: currentBalance - totalCost, currency };
}

// --- MAIN HANDLER ---
async function handler(req: Request) {
  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication failed");

    const { profile_id, partner_name_hint, partner_profile_id, monetization_variant, question_text } = await req.json();
    if (!profile_id) throw new Error("Missing user profile_id");

    // --- 1. RESOLVE PARTNER PROFILE ---
    let partnerProfile;
    if (partner_profile_id) {
        const { data } = await supabaseAdmin.from('compatibility_profiles').select('*').eq('id', partner_profile_id).single();
        if (data) partnerProfile = data;
    }
    if (!partnerProfile) {
        // Fallback search logic
        const { data: matchedProfiles } = await supabaseAdmin.from('compatibility_profiles').select('*').eq('user_id', user.id).eq('source_profile_id', profile_id).ilike('partner_name', `%${partner_name_hint || ''}%`);
        if (!matchedProfiles || matchedProfiles.length === 0) return new Response(JSON.stringify({ status: 'needs_partner_details', partner_name_hint }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        if (matchedProfiles.length > 1) {
            const uniqueNames = new Set(matchedProfiles.map(p => p.partner_name));
            if (uniqueNames.size > 1) {
                const options = matchedProfiles.map(p => ({ id: p.id, name: p.partner_name }));
                return new Response(JSON.stringify({ status: 'needs_clarification', options }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            partnerProfile = matchedProfiles[matchedProfiles.length - 1];
        } else {
            partnerProfile = matchedProfiles[0];
        }
    }

    // --- 2. WALLET DEDUCTION ---
    const deduction = await processWalletDeduction(supabaseAdmin, user.id, 'chat_message', 1, monetization_variant || 'control');
    if (!deduction.success) {
        return new Response(JSON.stringify({ error: "Insufficient funds" }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- 3. FETCH USER & PARTNER CHARTS ---
    
    // A. FETCH USER CHARTS (From Storage)
    let userD1 = [], userD9 = [], userD10 = [];
    try {
        const { data: userAstroData } = await supabaseAdmin.from('profile_astro_data').select('processed_tables_path').eq('profile_id', profile_id).single();
        if (userAstroData && userAstroData.processed_tables_path) {
            const { data: blob } = await supabaseAdmin.storage.from('astro-data').download(userAstroData.processed_tables_path);
            if (blob) {
                const userTables = JSON.parse(await blob.text());
                userD1 = minifyUserProcessedData(userTables.d1_planets);
                userD9 = minifyUserProcessedData(userTables.divisional_charts?.D9);
                userD10 = minifyUserProcessedData(userTables.divisional_charts?.D10);
            }
        }
    } catch (e) {
        console.error("Error fetching user charts:", e);
    }

    // B. FETCH PARTNER CHARTS (Lazy Load from API)
    let d1Data = partnerProfile.d1_chart;
    let d9Data = partnerProfile.d9_chart;
    let d10Data = partnerProfile.d10_chart;

    if (!d1Data || !d9Data) {
        const formatApiDate = (dateStr: string) => { const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}`; };
        const tzOffset = getTimezoneOffset(partnerProfile.birth_timezone, partnerProfile.date_of_birth);
        const baseParams = { dob: formatApiDate(partnerProfile.date_of_birth), tob: partnerProfile.time_of_birth.substring(0, 5), lat: partnerProfile.birth_lat, lon: partnerProfile.birth_lng, tz: tzOffset };

        const [d1Res, d9Res, d10Res] = await Promise.all([
            makeVedicastroRequest("/horoscope/planet-details", baseParams),
            makeVedicastroRequest("/horoscope/divisional-charts", { ...baseParams, div: "D9" }),
            makeVedicastroRequest("/horoscope/divisional-charts", { ...baseParams, div: "D10" })
        ]);

        if (d1Res) d1Data = minifyPartnerChartData(d1Res, 'D1');
        if (d9Res) d9Data = minifyPartnerChartData(d9Res, 'Divisional');
        if (d10Res) d10Data = minifyPartnerChartData(d10Res, 'Divisional');

        if (d1Data) {
            await supabaseAdmin.from('compatibility_profiles').update({ d1_chart: d1Data, d9_chart: d9Data, d10_chart: d10Data }).eq('id', partnerProfile.id);
        }
    }

    // --- 4. PREPARE STREAMING ---
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    (async () => {
        try {
            if (question_text) {
                await supabaseAdmin.from('chat_history').insert({ profile_id, user_id: user.id, message_content: question_text, role: 'user', question_category: 'love_compatibility' });
            }

            const { data: userProfileData } = await supabaseAdmin.from('user_profiles').select('name, user_birth_details(*)').eq('id', profile_id).single();
            const userBirthDetails = Array.isArray(userProfileData.user_birth_details) ? userProfileData.user_birth_details[0] : userProfileData.user_birth_details;

            const formatApiDate = (dateStr: string) => { const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}`; };
            const partnerTimezoneOffset = getTimezoneOffset(partnerProfile.birth_timezone, partnerProfile.date_of_birth);
            
            const apiParams = new URLSearchParams({
              boy_dob: formatApiDate(userBirthDetails.date_of_birth), boy_tob: userBirthDetails.time_of_birth.substring(0, 5),
              boy_tz: userBirthDetails.timezone_offset, boy_lat: userBirthDetails.birth_lat, boy_lon: userBirthDetails.birth_lng,
              girl_dob: formatApiDate(partnerProfile.date_of_birth), girl_tob: partnerProfile.time_of_birth.substring(0, 5),
              girl_tz: partnerTimezoneOffset.toString(), girl_lat: partnerProfile.birth_lat, girl_lon: partnerProfile.birth_lng,
              lang: 'en', api_key: Deno.env.get('VEDICASTRO_API_KEY')!
            });

            const ashtakootResponse = await fetch(`https://api.vedicastroapi.com/v3-json/matching/ashtakoot?${apiParams.toString()}`);
            let safeAshtakootJson = "{}";
            if (ashtakootResponse.ok) {
                const ashtakootData = await ashtakootResponse.json();
                safeAshtakootJson = JSON.stringify(ashtakootData.response || ashtakootData, null, 2);
            }

            // --- 5. LLM PROMPT INJECTION ---
            const { data: promptData } = await supabaseAdmin.from('system_prompts').select('*').eq('prompt_name', 'love_compatibility_ashtakoot').single();
            
            let finalPrompt = promptData.prompt_text
              .replace('{{USER_PROFILE_NAME}}', userProfileData.name)
              .replace('{{PARTNER_PROFILE_NAME}}', partnerProfile.partner_name)
              .replace('{{CURRENT_DATE}}', new Date().toDateString())
              .replace('{{ASHTAKOOT_JSON_FROM_API}}', safeAshtakootJson);

            // INJECT USER CHARTS
            finalPrompt += `\n\n### USER'S CHART DATA:\n`;
            finalPrompt += `D1 (Rasi): ${JSON.stringify(userD1 || 'Not Available')}\n`;
            finalPrompt += `D9 (Navamsa): ${JSON.stringify(userD9 || 'Not Available')}\n`;
            finalPrompt += `D10 (Dasamsa): ${JSON.stringify(userD10 || 'Not Available')}\n`;

            // INJECT PARTNER CHARTS
            finalPrompt += `\n\n### PARTNER'S CHART DATA:\n`;
            finalPrompt += `D1 (Rasi): ${JSON.stringify(d1Data || 'Not Available')}\n`;
            finalPrompt += `D9 (Navamsa): ${JSON.stringify(d9Data || 'Not Available')}\n`;
            finalPrompt += `D10 (Dasamsa): ${JSON.stringify(d10Data || 'Not Available')}\n`;
            
            finalPrompt += `\nINSTRUCTION: Perform Planetary Synastry by comparing the User's charts with the Partner's charts. Look for overlay (conjunctions) and mutual aspects.`;

            const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": Deno.env.get(promptData.secret_name), "anthropic-version": "2023-06-01" },
                body: JSON.stringify({
                    model: promptData.model_name, 
                    system: finalPrompt,
                    messages: [{ role: 'user', content: question_text || `Analyze compatibility for ${userProfileData.name} and ${partnerProfile.partner_name}.`}],
                    stream: true, 
                    max_tokens: 4096,
                })
            });

            // Pipe Stream
            let fullResponseContent = '', inputTokens = 0, outputTokens = 0;
            for await (const chunk of anthropicResponse.body) {
                const lines = decoder.decode(chunk).split('\n');
                for (const line of lines) {
                    if (line.trim().startsWith('data:')) {
                        try {
                            const data = JSON.parse(line.substring(5));
                            if (data.type === 'message_start') inputTokens = data.message.usage.input_tokens;
                            if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
                                const content = data.delta.text || '';
                                fullResponseContent += content;
                                await writer.write(encoder.encode(content));
                            }
                            if (data.type === 'message_delta') outputTokens = data.usage.output_tokens;
                        } catch { }
                    }
                }
            }

            if (fullResponseContent) {
                const { data: msg } = await supabaseAdmin.from('chat_history').insert({
                    profile_id, 
                    user_id: user.id, 
                    message_content: fullResponseContent, 
                    role: 'assistant', 
                    question_category: 'love_compatibility'
                }).select('id').single();
                if (msg) await calculateAndStoreCost(supabaseAdmin, { userId: user.id, profileId: profile_id, chatHistoryId: msg.id, modelName: promptData.model_name, inputTokens, outputTokens });
            }

        } catch (err) {
            console.error(err);
            const userMsg = `Error generating report: ${err.message}`;
            await writer.write(encoder.encode(userMsg));
        } finally {
            await writer.close();
        }
    })();

    return new Response(readable, { headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

async function calculateAndStoreCost(supabaseAdmin: any, usageData: any) {
  const PRICING = { INPUT_USD_PER_MILLION: 3.00, OUTPUT_USD_PER_MILLION: 15.00, USD_TO_INR_RATE: 90.0 };
  try {
    const inputCost = (usageData.inputTokens / 1_000_000) * PRICING.INPUT_USD_PER_MILLION;
    const outputCost = (usageData.outputTokens / 1_000_000) * PRICING.OUTPUT_USD_PER_MILLION;
    const totalCostUsd = inputCost + outputCost;
    await supabaseAdmin.from('llm_api_costs').insert({
      user_id: usageData.userId, profile_id: usageData.profileId, chat_history_id: usageData.chatHistoryId,
      model_name: usageData.modelName, input_tokens: usageData.inputTokens, output_tokens: usageData.outputTokens,
      total_cost_usd: totalCostUsd.toFixed(8), total_cost_inr: (totalCostUsd * PRICING.USD_TO_INR_RATE).toFixed(6)
    });
  } catch (err) { console.error(`Cost Log Error: ${err.message}`); }
}

Deno.serve(createCorsWrappedHandler(handler));
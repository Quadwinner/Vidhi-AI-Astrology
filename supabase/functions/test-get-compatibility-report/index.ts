import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

// Minifier for USER data (Processed Table format from Storage)
function minifyUserProcessedData(tableData: any[]) {
    if (!Array.isArray(tableData)) return [];
    return tableData.map((p: any) => ({
        Pl: p.Planet.substring(0, 2),
        Sgn: p.Sign,
        H: p.House,
        Deg: p.Degree
    }));
}

// Fetch User's Astro Data (Dasha + Charts) from Storage
async function fetchUserAstroData(supabaseAdmin: any, profileId: string) {
    try {
        const { data: userAstroData } = await supabaseAdmin
            .from('profile_astro_data')
            .select('processed_tables_path, vimshottari_dasha')
            .eq('profile_id', profileId)
            .single();
        
        if (!userAstroData || !userAstroData.processed_tables_path) return null;

        const { data: blob } = await supabaseAdmin.storage.from('astro-data').download(userAstroData.processed_tables_path);
        if (!blob) return null;

        const tables = JSON.parse(await blob.text());
        
        // Minify Data for Token Efficiency
        return {
            d1: minifyUserProcessedData(tables.d1_planets),
            d9: minifyUserProcessedData(tables.divisional_charts?.D9),
            dasha: userAstroData.vimshottari_dasha // Passing full dasha array for context
        };
    } catch (e) {
        console.error("Error fetching user astro data:", e);
        return null;
    }
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

// --- MAIN HANDLER ---
async function handler(req: Request) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    
    // Auth Check
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error("Authentication failed");

    // Parse Body
    const { profile_id, partner_profile_id, question_text, monetization_variant } = await req.json();
    if (!profile_id || !question_text) throw new Error("Missing profile_id or question_text");
    
    // 1. WALLET DEDUCTION (Pay-per-Insight)
    const deduction = await processWalletDeduction(supabaseAdmin, user.id, 'chat_message', 1, monetization_variant || 'control');
    if (!deduction.success) {
        // Return 402 directly to frontend to trigger recharge modal
        return new Response(JSON.stringify({ error: "Insufficient funds" }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. FETCH DATA IN PARALLEL
    // We need: User Profile, Partner Profile, and User's Astro Data from Storage
    const [userProfileRes, partnerProfileRes, userAstroData] = await Promise.all([
        supabaseAdmin.from('user_profiles').select('name, user_birth_details(*)').eq('id', profile_id).single(),
        supabaseAdmin.from('compatibility_profiles').select('*').eq('id', partner_profile_id).single(),
        fetchUserAstroData(supabaseAdmin, profile_id)
    ]);

    if (userProfileRes.error) throw new Error("User profile not found");
    if (partnerProfileRes.error) throw new Error("Partner profile not found");

    const userProfile = userProfileRes.data;
    const partnerProfile = partnerProfileRes.data;

    // 3. PREPARE PARTNER CHARTS (Lazy Load Logic)
    let d1Data = partnerProfile.d1_chart;
    let d9Data = partnerProfile.d9_chart;
    let d10Data = partnerProfile.d10_chart;

    // If charts are missing, fetch from API and save to DB
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

    // 4. PREPARE ASHTAKOOT SYNASTRY (Cache Logic)
    let ashtakootData = partnerProfile.ashtakoot_response;
    
    if (!ashtakootData) {
        // Prepare Params for Ashtakoot
        const userBD = Array.isArray(userProfile.user_birth_details) ? userProfile.user_birth_details[0] : userProfile.user_birth_details;
        
        const formatApiDate = (dateStr: string) => { const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}`; };
        const partnerTimezoneOffset = getTimezoneOffset(partnerProfile.birth_timezone, partnerProfile.date_of_birth);

        // Note: User BD is already in DB, likely with timezone_offset. If not, recalculate.
        // Assuming userBD.timezone_offset exists.
        
        const apiParams = new URLSearchParams({
              boy_dob: formatApiDate(userBD.date_of_birth), 
              boy_tob: userBD.time_of_birth.substring(0, 5),
              boy_tz: userBD.timezone_offset ? userBD.timezone_offset.toString() : "5.5", 
              boy_lat: userBD.birth_lat, 
              boy_lon: userBD.birth_lng,
              girl_dob: formatApiDate(partnerProfile.date_of_birth), 
              girl_tob: partnerProfile.time_of_birth.substring(0, 5),
              girl_tz: partnerTimezoneOffset.toString(), 
              girl_lat: partnerProfile.birth_lat, 
              girl_lon: partnerProfile.birth_lng,
              lang: 'en', 
              api_key: Deno.env.get('VEDICASTRO_API_KEY')!
        });
        
        const ashtakootResponse = await fetch(`https://api.vedicastroapi.com/v3-json/matching/ashtakoot?${apiParams.toString()}`);
        if (ashtakootResponse.ok) {
            const json = await ashtakootResponse.json();
            ashtakootData = json.response;

            // Cache it in DB
            await supabaseAdmin
                .from('compatibility_profiles')
                .update({ ashtakoot_response: ashtakootData })
                .eq('id', partnerProfile.id);
        } else {
            console.error("Ashtakoot API Failed", await ashtakootResponse.text());
            ashtakootData = { error: "Could not fetch synastry scores." };
        }
    }

    // 5. FETCH SYSTEM PROMPT (Mega-Prompt)
    const { data: promptData, error: promptError } = await supabaseAdmin
        .from('system_prompts')
        .select('*')
        .eq('prompt_name', 'compatabiityformtest') // <-- This matches the one you inserted in SQL
        .single();
    
    if (promptError || !promptData) throw new Error("System prompt 'compatabiityformtest' not found.");

    // 6. CONSTRUCT THE CONTEXT
    let finalPrompt = promptData.prompt_text
        .replace('{{USER_PROFILE_NAME}}', userProfile.name)
        .replace('{{PARTNER_PROFILE_NAME}}', partnerProfile.partner_name)
        .replace('{{USER_QUESTION}}', question_text) // <--- Inject Specific Question
        .replace('{{USER_ASTRO_DATA}}', JSON.stringify(userAstroData || "User data unavailable"))
        .replace('{{PARTNER_ASTRO_DATA}}', JSON.stringify({ d1: d1Data, d9: d9Data }))
        .replace('{{ASHTAKOOT_DATA}}', JSON.stringify(ashtakootData));

    // 7. START STREAMING RESPONSE
    (async () => {
        try {
            // Log User Message
            await supabaseAdmin.from('chat_history').insert({
                profile_id, 
                user_id: user.id, 
                message_content: question_text, 
                role: 'user', 
                question_category: 'love_compatibility' 
            });

            const apiKey = Deno.env.get(promptData.secret_name);
            const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json", 
                    "x-api-key": apiKey, 
                    "anthropic-version": "2023-06-01" 
                },
                body: JSON.stringify({
                    model: promptData.model_name || 'claude-3-5-sonnet-20240620', 
                    system: finalPrompt,
                    // We send just the current question as context is in System Prompt
                    messages: [{ role: 'user', content: question_text }],
                    stream: true, 
                    max_tokens: 4096,
                })
            });

            if (!anthropicResponse.ok) {
                const errText = await anthropicResponse.text();
                throw new Error(`Anthropic Error: ${errText}`);
            }

            let fullResponseContent = '';
            let inputTokens = 0;
            let outputTokens = 0;

            for await (const chunk of anthropicResponse.body) {
                const lines = decoder.decode(chunk).split('\n');
                for (const line of lines) {
                    if (line.trim().startsWith('data:')) {
                        const dataStr = line.substring(5).trim();
                        if (dataStr === '[DONE]') break;
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.type === 'message_start') inputTokens = data.message.usage.input_tokens;
                            
                            if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
                                const content = data.delta.text || '';
                                fullResponseContent += content;
                                await writer.write(encoder.encode(content));
                            }
                            
                            if (data.type === 'message_delta') outputTokens = data.usage.output_tokens;
                        } catch (e) { /* ignore parse errors */ }
                    }
                }
            }

            // Save Assistant Response
            if (fullResponseContent) {
                const { data: msg } = await supabaseAdmin.from('chat_history').insert({
                    profile_id, 
                    user_id: user.id, 
                    message_content: fullResponseContent, 
                    role: 'assistant', 
                    question_category: 'love_compatibility'
                }).select('id').single();
                
                if (msg) {
                    await calculateAndStoreCost(supabaseAdmin, { 
                        userId: user.id, 
                        profileId: profile_id, 
                        chatHistoryId: msg.id, 
                        modelName: promptData.model_name, 
                        inputTokens, 
                        outputTokens 
                    });
                }
            }

        } catch (err) {
            console.error("Stream Loop Error:", err);
            await writer.write(encoder.encode(`Error: ${err.message}`));
        } finally {
            await writer.close();
        }
    })();

    return new Response(readable, { headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } });

  } catch (err) {
    // Top Level Error Catch
    console.error("Handler Error:", err);
    
    // If we've already started writing to the stream, we can't send a JSON response.
    // However, for the initial checks (Auth, Balance, Body), we can.
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
}

Deno.serve(createCorsWrappedHandler(handler));
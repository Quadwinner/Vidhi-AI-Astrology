// supabase/functions/test-get-chat-answer/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

// --- CORE HELPER FUNCTIONS ---
function calculateAge(dateString: string): number {
  try {
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
    return age;
  } catch { return 0; }
}

// ... [Keep other helper functions like parseDmyDate, formatDashaTimeline, transformMessagesForOpenAI unchanged] ...

function parseDmyDate(dateString: string): Date {
  const [day, month, year] = dateString.split('/').map(Number);
  return new Date(year, month - 1, day);
}

function formatDashaTimeline(dashaData: any | string | null, clientDate: string): string {
    // ... [Keep implementation unchanged] ...
  if (!dashaData) return "Dasha data not available.";
  let dashaPeriods: any[];
  if (typeof dashaData === 'string') {
    try { dashaPeriods = JSON.parse(dashaData); } catch (e) { return "Dasha data is corrupted."; }
  } else {
    dashaPeriods = dashaData;
  }
  if (!Array.isArray(dashaPeriods)) return "Dasha data is invalid.";
  const today = new Date(clientDate);
  let currentIndex = -1;
  for (let i = 0; i < dashaPeriods.length; i++) {
    const period = dashaPeriods[i];
    if (!period || !period["Start Date"] || !period["End Date"]) continue;
    const startDate = parseDmyDate(period["Start Date"]);
    const endDate = parseDmyDate(period["End Date"]);
    if (today >= startDate && today <= endDate) { currentIndex = i; break; }
  }
  const allPeriods = dashaPeriods.map((period, index) => {
    if (!period["End Date"] || !period["Start Date"]) return null;
    const startDate = parseDmyDate(period["Start Date"]);
    const endDate = parseDmyDate(period["End Date"]);
    const startDateStr = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const endDateStr = endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    let periodString = `- MD: ${period["Mahadasha Lord"]}, AD: ${period["Antardasha Lord"]} (${startDateStr} - ${endDateStr})`;
    if (index === currentIndex) periodString += "  <-- YOU ARE HERE";
    return periodString;
  }).filter(p => p);
  if (allPeriods.length === 0) return "No valid dasha periods could be formatted.";
  return `Full Vimshottari Dasha Timeline:\n${allPeriods.join('\n')}`;
}

function transformMessagesForOpenAI(messages: { role: string; content: string }[]) {
  return messages.map(message => ({
    role: message.role,
    content: message.content
  }));
}

// ... [Keep calculateAndStoreCost unchanged] ...
async function calculateAndStoreCost(
  supabaseAdmin: any,
  usageData: {
    userId: string;
    profileId: string;
    chatHistoryId: string;
    modelName: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  }
) {
  // Pricing for Claude 3.5 Sonnet (in USD per 1 million tokens)
  const PRICING = {
    INPUT_USD_PER_MILLION: 3.00,
    CACHE_CREATION_USD_PER_MILLION: 3.75,
    CACHE_READ_USD_PER_MILLION: 0.30,
    OUTPUT_USD_PER_MILLION: 15.00,
    USD_TO_INR_RATE: 90.0
  };

  try {
    const inputCost = (usageData.inputTokens / 1_000_000) * PRICING.INPUT_USD_PER_MILLION;
    const cacheCreationCost = (usageData.cacheCreationTokens / 1_000_000) * PRICING.CACHE_CREATION_USD_PER_MILLION;
    const cacheReadCost = (usageData.cacheReadTokens / 1_000_000) * PRICING.CACHE_READ_USD_PER_MILLION;
    const outputCost = (usageData.outputTokens / 1_000_000) * PRICING.OUTPUT_USD_PER_MILLION;

    const totalCostUsd = inputCost + cacheCreationCost + cacheReadCost + outputCost;
    const totalCostInr = totalCostUsd * PRICING.USD_TO_INR_RATE;

    const { error } = await supabaseAdmin.from('llm_api_costs').insert({
      user_id: usageData.userId,
      profile_id: usageData.profileId,
      chat_history_id: usageData.chatHistoryId,
      model_name: usageData.modelName,
      input_tokens: usageData.inputTokens,
      output_tokens: usageData.outputTokens,
      cache_creation_input_tokens: usageData.cacheCreationTokens,
      cache_read_input_tokens: usageData.cacheReadTokens,
      total_cost_usd: totalCostUsd.toFixed(8),
      total_cost_inr: totalCostInr.toFixed(6)
    });

    if (error) {
      console.error(`[Cost Tracking] Failed to insert cost data:`, error);
    } else {
      console.log(`[Cost Tracking] Successfully logged cost: ${totalCostUsd.toFixed(8)} USD for chat_history_id ${usageData.chatHistoryId}`);
    }

  } catch (err) {
    console.error(`[Cost Tracking] CRITICAL ERROR in calculateAndStoreCost: ${err.message}`);
  }
}

// --- MAIN HANDLER FUNCTION ---
async function handler(req: Request) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  (async () => {
    let user_id: string | undefined;
    let profile_id: string | undefined;

    try {
      // --- 1. AUTHENTICATION & INITIAL SETUP ---
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const requestBody = await req.json();
      profile_id = requestBody.profile_id;
      
      // --- UPDATE: Extract category and sub_category ---
      const { 
        question_text, 
        original_question,
        client_date, 
        monetization_variant, 
        experiment_variant, 
        category,          // <--- NEW
        sub_category       // <--- NEW
      } = requestBody;

      if (!profile_id || !question_text || !client_date) {
        throw new Error("Missing critical parameters: profile_id, question_text, or client_date.");
      }

      const authHeader = req.headers.get('Authorization')!;
      const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication failed: User not found");
      user_id = user.id;

      // ... [Keep Deduction Logic unchanged] ...
       // --- 2. NEW WALLET DEDUCTION LOGIC ---
       const deduction = await processWalletDeduction(
          supabaseAdmin, 
          user.id, 
          'chat_message', 
          1, 
          monetization_variant || 'control'
      );

      if (!deduction.success) {
        const displayBal = (deduction.balance / 100).toFixed(2);
        const displayCost = (deduction.required / 100).toFixed(2);
        const msg = `Insufficient funds. Balance: ${displayBal} ${deduction.currency || ''}. Required: ${displayCost}. Please recharge your wallet.`;

        writer.write(encoder.encode(msg));
        writer.close();
        return;
      }

      // ... [Keep Efficient Data Fetching unchanged] ...
       // --- 3. EFFICIENT DATA FETCHING ---
      const [profileRes, astroDataRes, chatHistoryRes, rulebookRes, settingsRes] = await Promise.allSettled([
        supabaseAdmin.from('user_profiles').select(`name, preferred_language, user_birth_details(gender, date_of_birth)`).eq('id', profile_id).single(),
        supabaseAdmin.from('profile_astro_data').select('processed_tables_path, vimshottari_dasha, yogas_llm').eq('profile_id', profile_id).single(),
        supabaseAdmin.from('chat_history').select('role, message_content').eq('profile_id', profile_id).order('created_at', { ascending: true }).limit(10),
        supabaseAdmin.storage.from('rulebook').download('compressed_astro_rules.json'),
        supabaseAdmin.from('system_settings').select('is_active').eq('setting_name', 'enable_hyper_personalization').single()
      ]);

      // ... [Keep profile processing logic unchanged] ...
      let isHyperPersonalizationEnabled = false;
      if (settingsRes.status === 'fulfilled' && settingsRes.value.data) {
        isHyperPersonalizationEnabled = settingsRes.value.data.is_active;
      } else {
        console.error('[CRITICAL] Could not fetch feature flag. Disabling new feature for safety.');
      }

      if (profileRes.status === 'rejected') throw new Error(`Failed to fetch user profile: ${profileRes.reason.message}`);
      const profileData = profileRes.value.data;
      const profileName = profileData?.name || 'the user';
      const birthDetails = Array.isArray(profileData?.user_birth_details) ? profileData.user_birth_details[0] : profileData.user_birth_details;
      const gender = birthDetails?.gender || 'Any'; 
      const age = birthDetails?.date_of_birth ? calculateAge(birthDetails.date_of_birth) : 0;
      const userLanguage = profileData?.preferred_language;

      if (astroDataRes.status === 'rejected') throw new Error(`Could not retrieve astrological data: ${astroDataRes.reason.message}`);
      const astroData = astroDataRes.value.data;
      if (!astroData || !astroData.processed_tables_path) {
        throw new Error("Astrological data has not been generated for this profile yet.");
      }

      const { data: blob, error: downloadError } = await supabaseAdmin.storage.from('astro-data').download(astroData.processed_tables_path);
      if (downloadError) throw new Error(`Failed to load processed chart data: ${downloadError.message}`);
      const processedTables = JSON.parse(await blob.text());

      let yogasJsonString = "Yoga analysis is not available for this profile.";
      if (processedTables.yogas && Array.isArray(processedTables.yogas) && processedTables.yogas.length > 0) {
        if (!processedTables.yogas[0].Error) {
          yogasJsonString = JSON.stringify(processedTables.yogas.map((y: any) => ({
            name: y["Yoga Name"],
            description: y["Description"]
          })));
          console.log(`[INFO] Using standard API yoga data for chat.`);
        }
      }

      if (yogasJsonString === "Yoga analysis is not available for this profile." && astroData.yogas_llm) {
        if (astroData.yogas_llm.yogas && Array.isArray(astroData.yogas_llm.yogas)) {
          yogasJsonString = JSON.stringify(astroData.yogas_llm.yogas);
          console.log(`[INFO] Using legacy 'yogas_llm' data for chat.`);
        }
      }

      const d1PlanetsJson = JSON.stringify(processedTables.d1_planets || []);
      const housesJson = JSON.stringify(processedTables.houses || []);
      const doshasJson = JSON.stringify(processedTables.doshas || []);
      const d9ChartJson = JSON.stringify(processedTables.divisional_charts?.D9 || []);
      const d10ChartJson = JSON.stringify(processedTables.divisional_charts?.D10 || []);
      const currentTransitsJson = JSON.stringify(processedTables.current_transits || []);
      const dashaTimelineJson = JSON.stringify(processedTables.vimshottari_dasha || []);

      let astrologyRulebookJsonString = "{}";
      if (rulebookRes.status === 'fulfilled' && !rulebookRes.value.error) {
        astrologyRulebookJsonString = await rulebookRes.value.data.text();
      }

      // ... [Keep prompt selection logic unchanged] ...
       let promptData: any;
      let promptError: any;
      const HYPER_PERSONALIZED_VARIANT = 'treatment-hyper-personalized';

      if (isHyperPersonalizationEnabled &&
        experiment_variant === HYPER_PERSONALIZED_VARIANT &&
        userLanguage) {
        console.log(`[Hyper-Personalization] Running for user. Age: ${age}, Gender: ${gender}, Language: ${userLanguage}`);
        const { data: rpcData, error: rpcError } = await supabaseAdmin
          .rpc('get_best_prompt', { user_age: age, user_gender: gender, user_lang: userLanguage })
          .maybeSingle();
        promptData = rpcData;
        promptError = rpcError;
        if (promptData) console.log(`[Hyper-Personalization] Selected prompt via RPC: "${promptData.prompt_name}"`);
      } else {
        console.log(`[Legacy Experiment] Using static prompt selection for variant: "${experiment_variant || 'control'}"`);
        let promptName;
        switch (experiment_variant) {
          case 'variant1': promptName = 'variant1'; break;
          case 'variant2': promptName = 'variant2'; break;
          case 'variant3': promptName = 'variant3'; break;
          default: promptName = 'text_chat_default';
        }
        const { data: staticData, error: staticError } = await supabaseAdmin
          .from('system_prompts')
          .select('prompt_text, model_name, secret_name, prompt_name')
          .eq('prompt_name', promptName)
          .eq('is_active', true)
          .maybeSingle();
        promptData = staticData;
        promptError = staticError;
      }

      if (!promptError && !promptData) {
        console.warn(`[Fallback] No prompt found for variant '${experiment_variant}'. Using absolute default.`);
        const { data: fallbackData, error: fallbackError } = await supabaseAdmin
          .from('system_prompts')
          .select('prompt_text, model_name, secret_name')
          .eq('prompt_name', 'text_chat_default')
          .eq('is_active', true)
          .single();
        promptData = fallbackData;
        promptError = fallbackError;
      }

      if (promptError || !promptData) {
        throw new Error(`System prompt could not be loaded. Error: ${promptError?.message}`);
      }

      // ... [Keep Prompt Construction Logic unchanged] ...
      let promptTextContent = promptData.prompt_text;
      let system_blocks_for_api;
      const SEPARATOR = '0 — CORE USER & CHART DATA';

      if (promptTextContent.includes(SEPARATOR)) {
        console.log("[Prompt Strategy] Using two-block caching for standard astrological prompt.");
        const promptParts = promptTextContent.split(SEPARATOR);
        const universalInstructionsTemplate = promptParts[0];
        const userDataTemplate = promptParts[1];
        const systemBlock1Text = universalInstructionsTemplate
            .replace('{{ASTROLOGY_RULEBOOK_JSON}}', astrologyRulebookJsonString);
        const systemBlock2Text = `${SEPARATOR}${userDataTemplate}`
          .replace(/{{CURRENT_DATE}}/g, new Date(client_date).toDateString())
          .replace(/{{PROFILE_NAME}}/g, profileName)
          .replace(/{{AGE}}/g, age > 0 ? age.toString() : 'not specified')
          .replace(/{{GENDER}}/g, gender)
          .replace('{{D1_PLANETS_JSON}}', d1PlanetsJson)
          .replace('{{HOUSES_JSON}}', housesJson)
          .replace('{{YOGAS_JSON}}', yogasJsonString)
          .replace('{{DOSHAS_JSON}}', doshasJson)
          .replace('{{DASHA_TIMELINE_JSON}}', dashaTimelineJson)
          .replace('{{D9_CHART_JSON}}', d9ChartJson)
          .replace('{{D10_CHART_JSON}}', d10ChartJson)
          .replace('{{CURRENT_TRANSITS_JSON}}', currentTransitsJson);
        system_blocks_for_api = [
          { type: 'text', text: systemBlock1Text, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: systemBlock2Text, cache_control: { type: 'ephemeral' } }
        ];
      } else {
        console.log("[Prompt Strategy] Using single-block for simple/test prompt.");
        system_blocks_for_api = [{ type: 'text', text: promptTextContent }];
      }

      const apiKey = Deno.env.get(promptData.secret_name);
      if (!apiKey) throw new Error(`API key secret named '${promptData.secret_name}' is not set.`);

      const recentHistory = chatHistoryRes.status === 'fulfilled' ? chatHistoryRes.value.data : [];
      let messagesForApi = transformMessagesForOpenAI([
        ...recentHistory.map(msg => ({ role: msg.role, content: msg.message_content }))
      ]);

      if (messagesForApi.length > 0) {
        const lastMessage = messagesForApi[messagesForApi.length - 1];
        if (typeof lastMessage.content === 'string') {
            lastMessage.content = [{ type: 'text', text: lastMessage.content }];
        }
        const lastContentBlock = lastMessage.content[lastMessage.content.length - 1];
        lastContentBlock.cache_control = { type: 'ephemeral' };
      }

      messagesForApi.push({ role: "user", content: question_text });
      
      const anthropicApiUrl = `https://api.anthropic.com/v1/messages`;
      const response = await fetch(anthropicApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: promptData.model_name || 'claude-3-5-sonnet-20240620',
          system: system_blocks_for_api,
          messages: messagesForApi,
          stream: true,
          max_tokens: 4096,
        })
      });

      // ... [Keep Error Handling unchanged] ...
       if (response.status === 529 || response.status === 502 || response.status === 503) {
        const overloadMessage = "AuraAI is experiencing heavy cosmic traffic right now (server overload). Please try again in 30 seconds.";
        await writer.write(encoder.encode(overloadMessage));
        writer.close();
        return;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`LLM API error: ${response.status} ${response.statusText} - ${errorBody}`);
      }
      if (!response.body) throw new Error("The response body from the LLM was empty.");


      let fullResponseContent = '';
      
      let inputTokens = 0;
      let outputTokens = 0;
      let cacheCreationTokens = 0;
      let cacheReadTokens = 0;

      // ... [Keep Stream Loop unchanged] ...
       for await (const chunk of response.body) {
        const lines = decoder.decode(chunk).split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('data:')) {
            const data = line.substring(5).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'message_start' && parsed.message.usage) {
                  inputTokens = parsed.message.usage.input_tokens || 0;
                  cacheCreationTokens = parsed.message.usage.cache_creation_input_tokens || 0;
                  cacheReadTokens = parsed.message.usage.cache_read_input_tokens || 0;
                  console.log(`[Usage] Input Tokens: ${inputTokens}, Cache Create: ${cacheCreationTokens}, Cache Read: ${cacheReadTokens}`);
              }
              
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                const content = parsed.delta.text || '';
                if (content) {
                  fullResponseContent += content;
                  writer.write(encoder.encode(content));
                }
              }

              if (parsed.type === 'message_stop' && parsed['amazon-bedrock-invocationMetrics']) {
                  outputTokens = parsed['amazon-bedrock-invocationMetrics'].outputTokenCount || 0;
                  console.log(`[Usage] Output Tokens (from Bedrock metric): ${outputTokens}`);
              } else if (parsed.type === 'message_delta' && parsed.usage) {
                  outputTokens = parsed.usage.output_tokens || outputTokens;
              }

            } catch (streamErr) {
              console.error(`Stream parsing error: ${streamErr.message}`);
            }
          }
        }
      }

      // --- MODIFIED: DATABASE INSERTION LOGIC ---
      if (fullResponseContent && profile_id && user_id) {
        
        // FIX: Use 'original_question' if provided, otherwise use 'question_text'
        const contentToSave = original_question || question_text;

        // 1. Insert User Message
        await supabaseAdmin.from('chat_history').insert({
          profile_id, 
          user_id, 
          message_content: contentToSave, // <--- FIXED
          role: 'user',
          question_category: category || 'general',
          sub_category: sub_category || null
        });

        // 2. Insert Assistant Message
        const { data: assistantMessage, error: assistantMessageError } = await supabaseAdmin
          .from('chat_history')
          .insert({ 
            profile_id, 
            user_id, 
            message_content: fullResponseContent, 
            role: 'assistant',
            question_category: category || 'general',
            sub_category: sub_category || null
          })
          .select('id')
          .single();

        if (assistantMessage) {
            // 3. Cost Calculation
            await calculateAndStoreCost(supabaseAdmin, {
                userId: user_id,
                profileId: profile_id,
                chatHistoryId: assistantMessage.id,
                modelName: promptData.model_name || 'claude-3-5-sonnet-20240620',
                inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens
            });
        }
      }

    } catch (err) {
      console.error(`[CRITICAL ERROR] in get-chat-answer: ${err.message}`, { stack: err.stack });
      const errorMessage = err.message.includes("Insufficient funds") ? err.message
        : err.message.includes("Missing") ? err.message
          : "I'm sorry, an unexpected error occurred. The celestial signals are a bit fuzzy right now. Please try again shortly.";
      writer.write(encoder.encode(errorMessage));
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, { headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function processWalletDeduction(
  supabaseAdmin: any,
  userId: string,
  serviceKey: string,
  quantity: number = 1,
  variantName: string = 'control' 
) {
  // ... [Keep Wallet Deduction unchanged] ...
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('currency_code, wallet_balance')
    .eq('id', userId)
    .single();

  if (userError || !user) throw new Error(`User fetch failed: ${userError?.message}`);

  const currency = user.currency_code || 'USD';
  const currentBalance = user.wallet_balance || 0;

  console.log(`[Deduction] Looking up price for service:'${serviceKey}', currency:'${currency}', variant:'${variantName}'`);

  const { data: priceData, error: priceError } = await supabaseAdmin
    .from('service_prices')
    .select('price_amount')
    .eq('service_key', serviceKey)
    .eq('currency_code', currency)
    .eq('variant_name', variantName) 
    .single();

  if (priceError || !priceData) {
    throw new Error(`Price configuration missing for '${serviceKey}' in '${currency}' for variant '${variantName}'`);
  }

  const costPerUnit = priceData.price_amount;
  const totalCost = costPerUnit * quantity;

  if (currentBalance < totalCost) {
    return { success: false, error: 'Insufficient funds', required: totalCost, balance: currentBalance, currency };
  }

  const newBalance = currentBalance - totalCost;
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ wallet_balance: newBalance })
    .eq('id', userId);

  if (updateError) throw new Error(`Deduction failed: ${updateError.message}`);

  return { success: true, deducted: totalCost, newBalance, currency };
}

Deno.serve(createCorsWrappedHandler(handler));
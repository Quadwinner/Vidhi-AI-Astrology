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

function parseDmyDate(dateString: string): Date {
  const [day, month, year] = dateString.split('/').map(Number);
  return new Date(year, month - 1, day);
}

function formatDashaTimeline(dashaData: any | string | null, clientDate: string): string {
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

// Helper for Anthropic/OpenAI structure
function transformMessagesForStandard(messages: { role: string; content: string }[]) {
  return messages.map(message => ({
    role: message.role,
    content: message.content
  }));
}

// Helper for Gemini structure
function transformMessagesForGemini(messages: { role: string; content: string }[]) {
  return messages.map(message => {
    const role = (message.role === 'assistant' || message.role === 'system') ? 'model' : 'user';
    const textContent = (message.content && typeof message.content === 'string') ? message.content : " "; 
    return {
      role: role,
      parts: [{ text: textContent }]
    };
  });
}

// --- GEMINI CACHE MANAGER (PRECISE) ---
async function getOrRefreshGeminiCache(
  supabaseAdmin: any,
  apiKey: string,
  modelName: string,
  staticSystemPrompt: string,
  dbRecord: any 
): Promise<{ name: string; tokenCount: number } | null> {
  
  const CACHE_TTL_SECONDS = "7200s"; // 2 Hours
  const REFRESH_THRESHOLD_MS = 15 * 60 * 1000; // 15 Minutes

  try {
    if (dbRecord.gemini_cache_name && dbRecord.gemini_cache_expires_at) {
      const expiresAt = new Date(dbRecord.gemini_cache_expires_at);
      const now = new Date();
      const timeRemaining = expiresAt.getTime() - now.getTime();

      if (timeRemaining > 0) {
        console.log(`[Gemini Cache] Active: ${dbRecord.gemini_cache_name}. Expires in ${(timeRemaining/60000).toFixed(1)} mins.`);
        
        if (timeRemaining < REFRESH_THRESHOLD_MS) {
          console.log(`[Gemini Cache] TTL low. Refreshing...`);
          const updateUrl = `https://generativelanguage.googleapis.com/v1beta/${dbRecord.gemini_cache_name}?key=${apiKey}`;
          
          const refreshRes = await fetch(updateUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ttl: CACHE_TTL_SECONDS })
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            await supabaseAdmin.from('system_prompts')
              .update({ gemini_cache_expires_at: refreshData.expireTime })
              .eq('id', dbRecord.id); 
            console.log(`[Gemini Cache] Refreshed. New expiry: ${refreshData.expireTime}`);
          }
        }
        // Return existing name AND the stored token count (default to 0 if null)
        return { 
          name: dbRecord.gemini_cache_name, 
          tokenCount: dbRecord.gemini_cache_token_count || 0 
        };
      }
    }

    console.log(`[Gemini Cache] Creating new Context Cache...`);
    const createUrl = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${apiKey}`;
    
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${modelName}`,
        systemInstruction: { parts: [{ text: staticSystemPrompt }] },
        ttl: CACHE_TTL_SECONDS
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error(`[Gemini Cache] Creation Failed: ${errText}`);
      return null; 
    }

    const cacheData = await createRes.json();
    // Capturing EXACT token usage from creation response
    const exactTokens = cacheData.usageMetadata?.totalTokenCount || 0;
    
    console.log(`[Gemini Cache] Created: ${cacheData.name} (${exactTokens} tokens).`);

    await supabaseAdmin.from('system_prompts')
      .update({ 
        gemini_cache_name: cacheData.name,
        gemini_cache_expires_at: cacheData.expireTime,
        gemini_cache_token_count: exactTokens // Store exact size
      })
      .eq('prompt_name', 'text_chat_default'); 

    return { name: cacheData.name, tokenCount: exactTokens };

  } catch (e) {
    console.error(`[Gemini Cache] Error in manager: ${e.message}`);
    return null;
  }
}

// --- DYNAMIC COST CALCULATION ---
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
  const USD_TO_INR_RATE = 90.0;
  
  const PRICING = {
    // Anthropic Claude 3.5 Sonnet
    SONNET: { INPUT: 3.00, OUTPUT: 15.00, CACHE_WRITE: 3.75, CACHE_READ: 0.30 },
    // OpenAI GPT-4o
    GPT4O: { INPUT: 2.50, OUTPUT: 10.00, CACHE_READ: 1.25 },
    // Gemini 1.5/2.0 Flash
    GEMINI_FLASH: { INPUT: 0.30, OUTPUT: 2.50, CACHE_READ: 0.03 } 
  };

  let costs = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const model = usageData.modelName.toLowerCase();

  if (model.includes('gpt-4o')) {
    costs.input = (usageData.inputTokens / 1_000_000) * PRICING.GPT4O.INPUT;
    costs.cacheRead = (usageData.cacheReadTokens / 1_000_000) * PRICING.GPT4O.CACHE_READ;
    costs.output = (usageData.outputTokens / 1_000_000) * PRICING.GPT4O.OUTPUT;
  } else if (model.includes('gemini') || model.includes('flash')) {
    // Exact Gemini logic:
    // cacheReadTokens (from DB) = billed at Cache Read Rate
    // inputTokens (Total - Cache) = billed at Standard Input Rate
    costs.cacheRead = (usageData.cacheReadTokens / 1_000_000) * PRICING.GEMINI_FLASH.CACHE_READ;
    
    // Safety check: Ensure standard input isn't negative
    const standardInput = Math.max(0, usageData.inputTokens - usageData.cacheReadTokens);
    costs.input = (standardInput / 1_000_000) * PRICING.GEMINI_FLASH.INPUT;
    
    costs.output = (usageData.outputTokens / 1_000_000) * PRICING.GEMINI_FLASH.OUTPUT;
  } else {
    // Anthropic
    costs.input = (usageData.inputTokens / 1_000_000) * PRICING.SONNET.INPUT;
    costs.cacheWrite = (usageData.cacheCreationTokens / 1_000_000) * PRICING.SONNET.CACHE_WRITE;
    costs.cacheRead = (usageData.cacheReadTokens / 1_000_000) * PRICING.SONNET.CACHE_READ;
    costs.output = (usageData.outputTokens / 1_000_000) * PRICING.SONNET.OUTPUT;
  }

  try {
    const totalCostUsd = costs.input + costs.output + costs.cacheRead + costs.cacheWrite;
    const totalCostInr = totalCostUsd * USD_TO_INR_RATE;

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
    
    if (error) console.error(`[Cost Tracking] DB Error:`, error);
    else console.log(`[Cost Tracking] Logged ${totalCostUsd.toFixed(6)} USD for ${model}`);

  } catch (err: any) {
    console.error(`[Cost Tracking] Error: ${err.message}`);
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
      
      const { 
        question_text, 
        original_question,
        client_date, 
        monetization_variant, 
        category,          
        sub_category       
      } = requestBody;

      if (!profile_id || !question_text || !client_date) {
        throw new Error("Missing critical parameters: profile_id, question_text, or client_date.");
      }

      const authHeader = req.headers.get('Authorization')!;
      const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication failed: User not found");
      user_id = user.id;

       // --- 2. WALLET DEDUCTION ---
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
        return; 
      }

      // --- 3. EFFICIENT DATA FETCHING ---
      const [profileRes, astroDataRes, chatHistoryRes, rulebookRes] = await Promise.allSettled([
        supabaseAdmin.from('user_profiles').select(`name, preferred_language, user_birth_details(gender, date_of_birth)`).eq('id', profile_id).single(),
        supabaseAdmin.from('profile_astro_data').select('processed_tables_path, vimshottari_dasha, yogas_llm').eq('profile_id', profile_id).single(),
        supabaseAdmin.from('chat_history').select('role, message_content').eq('profile_id', profile_id).order('created_at', { ascending: true }).limit(10),
        supabaseAdmin.storage.from('rulebook').download('compressed_astro_rules.json')
      ]);

      if (profileRes.status === 'rejected') throw new Error(`Failed to fetch user profile: ${profileRes.reason.message}`);
      const profileData = profileRes.value.data;
      const profileName = profileData?.name || 'the user';
      const birthDetails = Array.isArray(profileData?.user_birth_details) ? profileData.user_birth_details[0] : profileData.user_birth_details;
      const gender = birthDetails?.gender || 'Any'; 
      const age = birthDetails?.date_of_birth ? calculateAge(birthDetails.date_of_birth) : 0;

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

      // =================================================================================
      // PROMPT & PROVIDER SELECTION LOGIC
      // =================================================================================
      
      const { data: promptData, error: promptError } = await supabaseAdmin
        .from('system_prompts')
        .select('*') 
        .eq('prompt_name', 'text_chat_default')
        .eq('is_active', true)
        .single();

      if (promptError || !promptData) {
        throw new Error(`CRITICAL: System prompt 'text_chat_default' could not be loaded.`);
      }

      // --- 1. DETERMINE PROVIDER ---
      const modelLower = promptData.model_name.toLowerCase();
      const isFireworks = modelLower.startsWith('accounts/fireworks/');
      const isOpenAI = !isFireworks && (modelLower.startsWith('gpt') || modelLower.startsWith('o1'));
      const isGemini = !isFireworks && modelLower.startsWith('gemini');
      const isAnthropic = !isFireworks && !isOpenAI && !isGemini;

      console.log(`[Model Provider] Selected: ${isFireworks ? 'Fireworks' : isGemini ? 'Gemini' : isOpenAI ? 'OpenAI' : 'Anthropic'} (${promptData.model_name})`);

      // --- 2. PREPARE PROMPT TEXT ---
      let promptTextContent = promptData.prompt_text;
      const SEPARATOR = '0 — CORE USER & CHART DATA';
      
      let finalSingleSystemPrompt = ""; 
      let staticSystemPrompt = ""; 
      let dynamicUserContext = ""; 
      let system_blocks_for_anthropic: any[] = [];

      if (promptTextContent.includes(SEPARATOR)) {
        const promptParts = promptTextContent.split(SEPARATOR);
        
        // PART 1: STATIC RULES (CACHEABLE)
        const universalInstructionsTemplate = promptParts[0];
        const systemBlock1Text = universalInstructionsTemplate
            .replace('{{ASTROLOGY_RULEBOOK_JSON}}', astrologyRulebookJsonString);
        
        // PART 2: DYNAMIC USER DATA
        const userDataTemplate = promptParts[1];
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

        system_blocks_for_anthropic = [
          { type: 'text', text: systemBlock1Text, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: systemBlock2Text, cache_control: { type: 'ephemeral' } }
        ];

        finalSingleSystemPrompt = systemBlock1Text + "\n\n" + systemBlock2Text;

        staticSystemPrompt = systemBlock1Text; 
        dynamicUserContext = systemBlock2Text; 

      } else {
        system_blocks_for_anthropic = [{ type: 'text', text: promptTextContent }];
        finalSingleSystemPrompt = promptTextContent;
        staticSystemPrompt = promptTextContent;
        dynamicUserContext = "";
      }

      const apiKey = Deno.env.get(promptData.secret_name);
      if (!apiKey) throw new Error(`API key secret named '${promptData.secret_name}' is not set.`);

      // --- 3. PREPARE HISTORY ---
      const rawHistory = chatHistoryRes.status === 'fulfilled' ? chatHistoryRes.value.data : [];
      const cleanHistory = rawHistory
        .map((msg: any) => ({ role: msg.role, content: msg.message_content }))
        .filter((msg: any) => msg.content && typeof msg.content === 'string' && msg.content.trim().length > 0);

      // --- 4. API REQUEST CONFIGURATION ---
      let apiUrl = "";
      let headers: any = {};
      let body: any = {};
      let geminiCacheTokens = 0; // Store retrieved token count for precise cost

      if (isGemini) {
        // === GEMINI CONFIGURATION ===
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${promptData.model_name}:streamGenerateContent?key=${apiKey}&alt=sse`;
        headers = { "Content-Type": "application/json" };

        const geminiHistory = transformMessagesForGemini(cleanHistory);
        
        // Cache Logic
        const cacheResult = await getOrRefreshGeminiCache(
          supabaseAdmin, 
          apiKey, 
          promptData.model_name, 
          staticSystemPrompt, 
          promptData
        );

        // Prepare Context
        const contextParts = [];
        if (dynamicUserContext) {
            contextParts.push({ 
                role: 'user', 
                parts: [{ text: "Here is the user's specific astrological chart data and context for this session:\n\n" + dynamicUserContext }] 
            });
        }
        const finalContents = [ ...contextParts, ...geminiHistory, { role: "user", parts: [{ text: question_text }] } ];

        if (cacheResult) {
           console.log(`[Gemini] Using Cached Content: ${cacheResult.name}`);
           geminiCacheTokens = cacheResult.tokenCount; // Exact count from DB
           body = {
             contents: finalContents,
             cachedContent: cacheResult.name, 
             generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
             safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
             ]
           };
        } else {
           console.log(`[Gemini] Cache failed. Sending full prompt.`);
           body = {
             contents: finalContents,
             systemInstruction: { parts: [{ text: staticSystemPrompt }] },
             generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
             safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
             ]
           };
        }

      } else if (isFireworks) {
        // === FIREWORKS (OpenAI-compatible) ===
        apiUrl = "https://api.fireworks.ai/inference/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        };
        const fireworksMessages = [
          { role: "system", content: finalSingleSystemPrompt },
          ...transformMessagesForStandard(cleanHistory),
          { role: "user", content: question_text }
        ];
        body = {
          model: promptData.model_name,
          messages: fireworksMessages,
          stream: true,
          stream_options: { include_usage: true }
        };

      } else if (isOpenAI) {
        // === OPEN AI ===
        apiUrl = "https://api.openai.com/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        };
        const openAIMessages = [
          { role: "system", content: finalSingleSystemPrompt },
          ...transformMessagesForStandard(cleanHistory),
          { role: "user", content: question_text }
        ];
        body = {
          model: promptData.model_name,
          messages: openAIMessages,
          stream: true,
          stream_options: { include_usage: true }
        };

      } else {
        // === ANTHROPIC ===
        apiUrl = "https://api.anthropic.com/v1/messages";
        headers = {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        };
        let anthropicMessages = transformMessagesForStandard(cleanHistory);
        anthropicMessages.push({ role: "user", content: question_text });
        if (anthropicMessages.length > 0) {
           const lastMsg = anthropicMessages[anthropicMessages.length - 1];
           const textContent = typeof lastMsg.content === 'string' ? lastMsg.content : " ";
           lastMsg.content = [{ type: 'text', text: textContent }];
           (lastMsg.content as any)[0].cache_control = { type: 'ephemeral' };
        }
        body = {
          model: promptData.model_name || 'claude-3-5-sonnet-20240620',
          system: system_blocks_for_anthropic,
          messages: anthropicMessages,
          stream: true,
          max_tokens: 8192,
        };
      }
      
      // --- 5. EXECUTE REQUEST (retry transient rate-limits / server errors) ---
      let response: Response;
      const maxAttempts = 3; // 1 initial + 2 retries
      for (let attempt = 1; ; attempt++) {
        response = await fetch(apiUrl, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(body)
        });

        if (response.ok) break;

        const isRetryable = response.status === 429 || response.status >= 500;
        if (isRetryable && attempt < maxAttempts) {
          // Honor Retry-After when the provider supplies it, else exponential-ish backoff.
          const retryAfter = Number(response.headers.get('retry-after'));
          const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 8000)
            : attempt * 1500;
          console.warn(`[API RETRY] Status ${response.status}. Attempt ${attempt}/${maxAttempts - 1}. Waiting ${backoffMs}ms.`);
          try { await response.body?.cancel(); } catch (_) { /* noop */ }
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        const errorBody = await response.text();
        console.error(`[API ERROR] Status: ${response.status} - ${errorBody}`);
        if (response.status === 429) {
          await writer.write(encoder.encode("Vidhi is receiving a lot of cosmic questions right now. Please wait a few moments and ask again."));
          return;
        }
        if (response.status >= 500) {
          await writer.write(encoder.encode("Vidhi is experiencing heavy cosmic traffic. Please try again in 10 seconds."));
          return;
        }
        throw new Error(`LLM API error: ${response.status}`);
      }
      
      // --- 6. STREAM PARSING ---
      let fullResponseContent = '';
      let rawBuffer = ''; // Buffer for reasoning models that output thinking before [ANSWER]
      let answerStarted = false; // Track if we've found the [ANSWER] tag
      let inputTokens = 0;
      let outputTokens = 0;
      let cacheCreationTokens = 0;
      let cacheReadTokens = 0;
      let sseLineBuffer = ''; // Buffer for partial SSE lines split across chunks

      for await (const chunk of response.body) {
        const text = sseLineBuffer + decoder.decode(chunk, { stream: true });
        const lines = text.split('\n');
        // Last element may be incomplete — save it for next chunk
        sseLineBuffer = lines.pop() || '';
        for (const line of lines) {
          if (line.trim().startsWith('data:')) {
            const dataStr = line.trim().substring(5).trim();
            if (!dataStr || dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);

              if (isGemini) {
                const candidate = parsed.candidates?.[0];
                const content = candidate?.content?.parts?.[0]?.text || '';
                if (content) {
                  fullResponseContent += content;
                  writer.write(encoder.encode(content));
                }
                if (parsed.usageMetadata) {
                   inputTokens = parsed.usageMetadata.promptTokenCount || 0;
                   outputTokens = parsed.usageMetadata.candidatesTokenCount || 0;
                   // PRECISE GEMINI ACCOUNTING
                   if(geminiCacheTokens > 0) {
                       cacheReadTokens = geminiCacheTokens;
                   }
                }

              } else if (isOpenAI || isFireworks) {
                 const content = parsed.choices?.[0]?.delta?.content || '';
                 if (content) {
                   // Stream tokens as they arrive (ChatGPT-style). Only briefly
                   // buffer at the very start in case the model emits an optional
                   // "[ANSWER]" marker we need to strip. Once we've cleared the
                   // first few tokens (or found the marker), we stream directly so
                   // the user never waits for the whole response.
                   if (isFireworks && !answerStarted) {
                     rawBuffer += content;
                     const answerIdx = rawBuffer.indexOf('[ANSWER]');
                     if (answerIdx !== -1) {
                       // Found the marker: emit everything after it and stream from now on.
                       answerStarted = true;
                       const fromAnswer = rawBuffer.substring(answerIdx + '[ANSWER]'.length);
                       if (fromAnswer) { fullResponseContent += fromAnswer; writer.write(encoder.encode(fromAnswer)); }
                       rawBuffer = '';
                     } else if (rawBuffer.length >= 12) {
                       // No marker in the opening tokens — this model doesn't use it.
                       // Flush what we have and stream everything from here on.
                       answerStarted = true;
                       fullResponseContent += rawBuffer;
                       writer.write(encoder.encode(rawBuffer));
                       rawBuffer = '';
                     }
                   } else {
                     fullResponseContent += content;
                     writer.write(encoder.encode(content));
                   }
                 }
                 if (parsed.usage) {
                   inputTokens = parsed.usage.prompt_tokens || 0;
                   outputTokens = parsed.usage.completion_tokens || 0;
                   if (parsed.usage.prompt_tokens_details) {
                       cacheReadTokens = parsed.usage.prompt_tokens_details.cached_tokens || 0;
                   }
                 }

              } else {
                 if (parsed.type === 'message_start' && parsed.message.usage) {
                    inputTokens = parsed.message.usage.input_tokens || 0;
                    cacheCreationTokens = parsed.message.usage.cache_creation_input_tokens || 0;
                    cacheReadTokens = parsed.message.usage.cache_read_input_tokens || 0;
                 }
                 if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                   const content = parsed.delta.text || '';
                   if (content) {
                     fullResponseContent += content;
                     writer.write(encoder.encode(content));
                   }
                 }
                 if (parsed.type === 'message_delta' && parsed.usage) {
                     outputTokens = parsed.usage.output_tokens || outputTokens;
                 }
              }
            } catch (streamErr) {
               // ignore partial json
            }
          }
        }
      }

      // Process any remaining buffered SSE line
      if (sseLineBuffer.trim().startsWith('data:')) {
        const dataStr = sseLineBuffer.trim().substring(5).trim();
        if (dataStr && dataStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(dataStr);
            const content = isGemini
              ? (parsed.candidates?.[0]?.content?.parts?.[0]?.text || '')
              : (parsed.choices?.[0]?.delta?.content || '');
            if (content) { fullResponseContent += content; writer.write(encoder.encode(content)); }
          } catch {}
        }
      }

      // If Fireworks model never output [ANSWER], send the raw buffer as-is
      if (isFireworks && !answerStarted && rawBuffer.length > 0) {
        fullResponseContent = rawBuffer;
        writer.write(encoder.encode(rawBuffer));
      }

      // --- DATABASE INSERTION ---
      if (fullResponseContent && profile_id && user_id) {
        const contentToSave = original_question || question_text;
        await supabaseAdmin.from('chat_history').insert({
          profile_id, 
          user_id, 
          message_content: contentToSave,
          role: 'user',
          question_category: category || 'general',
          sub_category: sub_category || null
        });

        const { data: assistantMessage } = await supabaseAdmin
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
            await calculateAndStoreCost(supabaseAdmin, {
                userId: user_id,
                profileId: profile_id,
                chatHistoryId: assistantMessage.id,
                modelName: promptData.model_name || 'unknown-model',
                inputTokens, 
                outputTokens,
                cacheCreationTokens,
                cacheReadTokens
            });
        }
      }

    } catch (err: any) {
      console.error(`[CRITICAL ERROR]: ${err.message}`, { stack: err.stack });
      writer.write(encoder.encode(`Error: ${err.message}`));
    } finally {
      try { await writer.close(); } catch (e) {}
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
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('currency_code, wallet_balance')
    .eq('id', userId)
    .single();

  if (userError || !user) throw new Error(`User fetch failed: ${userError?.message}`);

  const currency = user.currency_code || 'USD';
  const currentBalance = user.wallet_balance || 0;
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
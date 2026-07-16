// --- FINAL, REFACTORED VERSION (ALIGNED WITH AURA AI PROMPTING & FULL DASHA TIMELINE) ---

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { OpenAI } from 'https://esm.sh/openai@4.0.0';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@^0.22.0';
import { createCorsWrappedHandler } from '../_shared/cors.ts';

// --- Interfaces and Helper Functions ---

interface ProcessedTables {
  d1_planets?: Record<string, any>[];
  houses?: Record<string, any>[];
  vimshottari_dasha?: any[] | null;
  birth_year_transits?: Record<string, any>[];
  divisional_charts?: {
    D9?: Record<string, any>[];
    D10?: Record<string, any>[];
    [key: string]: Record<string, any>[] | undefined;
  };
  [key: string]: any;
}

// --- MODIFIED HELPER FUNCTIONS ---
// The Dasha formatting function now processes the entire timeline without filtering by date.

function parseDmyDate(dateString: string): Date {
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
}

function formatFullDashaTimeline(dashaData: any[] | null): string {
    if (!dashaData || !Array.isArray(dashaData) || dashaData.length === 0) {
        return "Dasha data not available for this profile.";
    }
    try {
        const allPeriods = dashaData.map(period => {
            if (!period["End Date"] || !period["Start Date"]) return null;
            const startDate = parseDmyDate(period["Start Date"]);
            const endDate = parseDmyDate(period["End Date"]);
            const startDateStr = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            const endDateStr = endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            return `- MD: ${period["Mahadasha Lord"]}, AD: ${period["Antardasha Lord"]} (${startDateStr} - ${endDateStr})`;
        }).filter(p => p); // Filter out any null entries from malformed data

        if (allPeriods.length === 0) return "No valid dasha periods could be formatted.";
        return `Full Vimshottari Dasha Timeline:\n${allPeriods.join('\n')}`;
    } catch (e) {
        console.error("Failed to format the full dasha timeline:", e);
        return "Dasha data appears to be corrupted for this profile.";
    }
}

// --- UNCHANGED HELPER FUNCTIONS ---

function calculateAge(dateString: string): number {
  const today = new Date();
  const birthDate = new Date(dateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function parseMarkdownToList(markdown: string): Record<string, string[]> {
    if (!markdown) return {};
    const lines = markdown.split('\n').filter(line => line.trim() !== '');
    const categories: Record<string, string[]> = {};
    let currentCategory: string | null = null;
    const defaultCategory = "General";
    for (const line of lines) {
        const trimmedLine = line.trim();
        const headerMatch = trimmedLine.match(/^(?:#+|\*\*)(.*?)(?::|\*\*|$)/);
        const listItemMatch = trimmedLine.match(/^(\*|-|\d+\.)\s*(.*)/);
        if (listItemMatch) {
            if (!currentCategory) { currentCategory = defaultCategory; }
            if (!categories[currentCategory]) { categories[currentCategory] = []; }
            categories[currentCategory].push(listItemMatch[2].trim());
        } else if (headerMatch) {
            const potentialCategory = headerMatch[1].trim();
            if (potentialCategory && potentialCategory.length < 50 && !potentialCategory.endsWith('?')) {
                currentCategory = potentialCategory;
                if (!categories[currentCategory]) { categories[currentCategory] = []; }
            }
        }
    }
    return categories;
}

// These helpers are added to make this function self-sufficient for fetching live transits.

const VEDICASTRO_API_BASE_URL = "https://api.vedicastroapi.com/v3-json";
const LANGUAGE = "en";

interface BirthDetails {
  dob: string; tob: string; lat: number; lon: number; tz: number;
}

// Makes the actual API call to VedicAstro
async function makeVedicastroRequest(endpoint: string, params: object, desc: string) {
  const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
  if (!apiKey) throw new Error("CRITICAL: VEDICASTRO_API_KEY secret is not set.");
  const url = new URL(VEDICASTRO_API_BASE_URL + endpoint);
  const allParams: Record<string, any> = { api_key: apiKey, lang: LANGUAGE, ...params };
  Object.keys(allParams).forEach(key => url.searchParams.append(key, allParams[key]));
  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
  if (!response.ok) { throw new Error(`External API Error for '${desc}': Status ${response.status} - ${await response.text()}`); }
  const data = await response.json();
  if (data.response && typeof data.response === 'string' && data.response.includes('out of api calls')) {
    console.error(`[VEDICASTRO API QUOTA EXCEEDED] ${desc}: ${data.response}`);
    throw new Error(`VedicAstro API quota exceeded.`);
  }
  if (!data.response) throw new Error(`External API Error for '${desc}': Response object is missing.`);
  return data.response;
}

// Fetches and processes the live transit data into a clean table.
async function fetchAndProcessCurrentTransits(birthDetails: BirthDetails, natalHouses: any[]) {
  try {
    if (!Array.isArray(natalHouses) || natalHouses.length === 0) {
      console.warn("[Transits] Natal houses table is not available. Cannot calculate current transits.");
      return [];
    }
    
    // The transit parameters are passed directly from the handler
    const transitPlanetDetails = await makeVedicastroRequest('/horoscope/planet-details', birthDetails, 'Live Transits for Questions');
    
    if (!transitPlanetDetails || typeof transitPlanetDetails !== 'object') {
      console.warn("[Transits] Failed to fetch valid transit data from the API.");
      return [];
    }
    const signToHouseMap = new Map<string, number>();
    natalHouses.forEach(house => {
      if (house.Sign && house.House) {
        signToHouseMap.set(house.Sign, house.House);
      }
    });
    return Object.values(transitPlanetDetails).map((planet_data: any) => {
      if (typeof planet_data !== 'object' || !planet_data.full_name) return null;
      const planetSign = planet_data.zodiac;
      const natalHouse = signToHouseMap.get(planetSign) || 'N/A';
      return {
        "Planet": planet_data.full_name,
        "Sign": planetSign,
        "Transiting House": natalHouse, // Renamed for clarity in the prompt
        "Degree": planet_data.local_degree?.toFixed(2),
        "Retrograde": planet_data.retro || 'No',
      };
    }).filter(p => p);
  } catch (error) {
    console.error(`[CRITICAL] Failed to fetch or process current transits for questions: ${error.message}`);
    return []; // Return an empty array on failure to not break the main flow
  }
}

async function handler(req: Request) {
  try {
    // --- AUTHENTICATION & SETUP (Unchanged) ---
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error("User not found or invalid token");
    const user = authData.user;
    const { profile_id } = await req.json();
    if (!profile_id) throw new Error("Missing profile_id");

    // --- CACHE CHECK (Unchanged) ---
    const { data: cachedQuestions } = await supabaseAdmin.from('ai_generated_questions').select('questions_json').eq('profile_id', profile_id).maybeSingle();
    if (cachedQuestions?.questions_json) {
        return new Response(JSON.stringify(cachedQuestions.questions_json), { headers: { 'Content-Type': 'application/json' } });
    }
    
    // --- DATA FETCHING & FALLBACK (Logic Unchanged) ---
    let processed_tables: ProcessedTables | null = null;
    const { data: astroDataRecord, error: astroDataError } = await supabaseAdmin.from('profile_astro_data').select('processed_tables_path').eq('profile_id', profile_id).maybeSingle();
    if (astroDataError) throw new Error(`Database error fetching astro data record: ${astroDataError.message}`);

    if (astroDataRecord && astroDataRecord.processed_tables_path) {
        const { data: processedDataBlob, error: downloadError } = await supabaseAdmin.storage.from('astro-data').download(astroDataRecord.processed_tables_path);
        if (downloadError) { console.warn(`Failed to download existing processed data for profile ${profile_id}: ${downloadError.message}. Will attempt to regenerate.`); } 
        else { processed_tables = JSON.parse(await processedDataBlob.text()); }
    }

    if (!processed_tables) {
        console.log(`Processed astro data not found for profile ${profile_id}. Invoking 'generate-astro-data'...`);
        const { error: invokeError } = await supabase.functions.invoke('generate-astro-data', { body: { profile_id, scope: 'charts' } });
        if (invokeError) { throw new Error(`Failed to automatically generate report: ${invokeError.message}`); }
        await new Promise(resolve => setTimeout(resolve, 10000));
        const { data: refetchedData, error: refetchError } = await supabaseAdmin.from('profile_astro_data').select('processed_tables_path').eq('profile_id', profile_id).single();
        if (refetchError || !refetchedData || !refetchedData.processed_tables_path) { throw new Error("Failed to retrieve the generated report path after generation. Please try again."); }
        const { data: processedDataBlob, error: downloadError } = await supabaseAdmin.storage.from('astro-data').download(refetchedData.processed_tables_path);
        if (downloadError) throw new Error(`Failed to download newly generated processed data: ${downloadError.message}`);
        processed_tables = JSON.parse(await processedDataBlob.text());
    }

    // --- REFACTORED DATA PREPARATION ---
    const d1PlanetsJson = JSON.stringify(processed_tables?.d1_planets || {});
    const housesJson = JSON.stringify(processed_tables?.houses || {});
    const birthTransitsJson = JSON.stringify(processed_tables?.birth_year_transits || {});
    const d9ChartJson = JSON.stringify(processed_tables?.divisional_charts?.D9 || {});
    const d10ChartJson = JSON.stringify(processed_tables?.divisional_charts?.D10 || {});
    
    // --- MODIFICATION ---
    // The Dasha string now contains the full timeline, not just upcoming periods.
    const dashaTimelineString = formatFullDashaTimeline(processed_tables?.vimshottari_dasha);
    
    const transitString = "Current live planetary transits are not required for this task.";
    const currentDate = new Date().toDateString();

    // Fetches all details needed for user info AND for transit calculation.
    const { data: userDetails, error: userDetailsError } = await supabaseAdmin
      .from('user_birth_details')
      .select('date_of_birth, gender, birth_lat, birth_lng, timezone_offset, user_profiles (name)')
      .eq('profile_id', profile_id)
      .single();

    if (userDetailsError || !userDetails) { throw new Error("Could not fetch user birth details."); }

    const profileName = (Array.isArray(userDetails.user_profiles) ? userDetails.user_profiles[0]?.name : userDetails.user_profiles?.name) || 'the user';
    const age = calculateAge(userDetails.date_of_birth);
    const gender = userDetails.gender;
    
    // --- Fetch and Prepare Live Transit Data ---
    const today = new Date();
    const dobForTransits = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    const transitParams: BirthDetails = {
        dob: dobForTransits,
        tob: '05:30', // Use a standard time like morning for consistency
        lat: parseFloat(userDetails.birth_lat),
        lon: parseFloat(userDetails.birth_lng),
        tz: parseFloat(userDetails.timezone_offset),
    };

    const currentTransitsTable = await fetchAndProcessCurrentTransits(
        transitParams, 
        processed_tables?.houses || []
    );
    const currentTransitsJson = JSON.stringify(currentTransitsTable);

    // --- PROMPT FETCHING (Logic Unchanged) ---
    const PROMPT_NAME = 'question_generator_default';
    let systemPrompt: string, userPromptTemplate: string, modelName: string, secretName: string, apiProvider: string;
    const { data: promptData, error: promptError } = await supabaseAdmin.from('system_prompts').select('prompt_text, api_provider, model_name, secret_name').eq('prompt_name', PROMPT_NAME).eq('is_active', true).single();
    if (promptError || !promptData) { throw new Error(`System prompt '${PROMPT_NAME}' could not be loaded.`); }
    try {
        const prompts = JSON.parse(promptData.prompt_text);
        if (!prompts || typeof prompts.system !== 'string' || typeof prompts.user_template !== 'string') { throw new Error("Prompt JSON is malformed."); }
        systemPrompt = prompts.system;
        userPromptTemplate = prompts.user_template;
    } catch (e) { throw new Error(`Failed to parse system prompt JSON for '${PROMPT_NAME}': ${e.message}`); }
    modelName = promptData.model_name || 'gpt-4o';
    secretName = promptData.secret_name || 'OPENAI_API_KEY';
    apiProvider = promptData.api_provider || 'openai';

    // --- NEW PROMPT ASSEMBLY (Unchanged) ---
    const finalUserPrompt = userPromptTemplate
        .replace('{{CURRENT_DATE}}', currentDate)
        .replace('{{PROFILE_NAME}}', profileName)
        .replace('{{AGE}}', age.toString())
        .replace('{{GENDER}}', gender)
        .replace('{{DASHA_TIMELINE}}', dashaTimelineString)
        .replace('{{CURRENT_TRANSITS_JSON}}', currentTransitsJson)
        .replace('{{D1_PLANETS_JSON}}', d1PlanetsJson)
        .replace('{{HOUSES_JSON}}', housesJson)
        .replace('{{BIRTH_TRANSITS_JSON}}', birthTransitsJson)
        .replace('{{D9_CHART_JSON}}', d9ChartJson)
        .replace('{{D10_CHART_JSON}}', d10ChartJson);

    // --- AI INVOCATION & RESPONSE HANDLING (Logic Unchanged) ---
    const apiKey = Deno.env.get(secretName);
    if (!apiKey) { throw new Error(`CRITICAL: The specified secret '${secretName}' was not found.`); }
    let markdownResponse: string | null = null;
    if (apiProvider === 'openai') {
        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({ model: modelName, temperature: 0.7, max_tokens: 1024, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: finalUserPrompt }], });
        markdownResponse = completion.choices[0].message.content;
    } else if (apiProvider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey });
        const completion = await anthropic.messages.create({ model: modelName, system: systemPrompt, messages: [{ role: "user", content: finalUserPrompt }], max_tokens: 2000, temperature: 0.7, });
        markdownResponse = completion.content[0]?.text || null;
    } else { throw new Error(`Unsupported API provider '${apiProvider}' specified.`); }
    if (!markdownResponse) { throw new Error("AI did not return a valid (or empty) response."); }
    const parsedQuestions = parseMarkdownToList(markdownResponse);
    const cleanedQuestions = Object.fromEntries(Object.entries(parsedQuestions).filter(([_, questions]) => questions.length > 0));
    if (Object.keys(cleanedQuestions).length === 0) { throw new Error("Failed to parse any valid questions from AI response."); }
    const { error: cacheError } = await supabaseAdmin.from('ai_generated_questions').upsert({ profile_id: profile_id, user_id: user.id, questions_json: cleanedQuestions, last_generated_at: new Date().toISOString() }, { onConflict: 'profile_id' });
    if (cacheError) throw new Error(`Failed to cache questions: ${cacheError?.message}`);
    return new Response(JSON.stringify(cleanedQuestions), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[CRITICAL ERROR] in generate-personalized-questions: ${err.message}`);
    throw err;
  }
}

Deno.serve(createCorsWrappedHandler(handler));
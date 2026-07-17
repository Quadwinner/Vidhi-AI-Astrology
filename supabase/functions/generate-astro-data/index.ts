// --- FINAL, CORRECTED VERSION (WITH SUPABASE STORAGE READ/WRITE & CURRENT TRANSITS) ---

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { OpenAI } from 'https://esm.sh/openai@4.0.0';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@^0.22.0';
import { createCorsWrappedHandler } from '../_shared/cors.ts';

const VEDICASTRO_API_BASE_URL = "https://api.vedicastroapi.com/v3-json";
const LANGUAGE = "en";
const HOUSE_SIGNIFICATIONS = { 1: "Self, Physique, Ego, Confidence, Sport", 2: "Wealth, Family, Speech, Food, Values", 3: "Siblings, Communication, Short Journeys, Courage", 4: "Mother, Home, Comfort, Vehicles, Property", 5: "Children, Creativity, Romance, Speculation, Intelligence", 6: "Health, Enemies, Obstacles, Service, Pets", 7: "Marriage, Partnerships, Business, Contracts, Open Enemies", 8: "Longevity, Inheritance, Occult, Transformation, Mysteries", 9: "Higher Education, Philosophy, Religion, Guru, Foreign Travel", 10: "Career, Status, Fame, Father, Authority, Government", 11: "Friends, Hopes, Wishes, Gains, Income, Social Groups", 12: "Losses, Expenses, Charity, Isolation, Foreign Lands, Spirituality" };
const SIGN_RULERS = { "Aries": "Mars", "Taurus": "Venus", "Gemini": "Mercury", "Cancer": "Moon", "Leo": "Sun", "Virgo": "Mercury", "Libra": "Venus", "Scorpio": "Mars", "Sagittarius": "Jupiter", "Capricorn": "Saturn", "Aquarius": "Saturn", "Pisces": "Jupiter" };
const ZODIAC_ORDER = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const PLANET_SHORT_NAMES = { "As": "Ascendant", "Su": "Sun", "Mo": "Moon", "Ma": "Mars", "Me": "Mercury", "Ju": "Jupiter", "Ve": "Venus", "Sa": "Saturn", "Ra": "Rahu", "Ke": "Ketu" };
const PLANETS_TO_FETCH_TRANSITS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];

const FUNCTIONAL_NATURE = {
  'Aries': { 'yogakaraka': ['Saturn'], 'benefics': ['Sun', 'Moon', 'Mars', 'Jupiter', 'Saturn'], 'malefics': ['Mercury', 'Venus'], 'neutral': [], 'maraka': ['Venus', 'Mercury'], 'badhaka': ['Mercury'] },
  'Taurus': { 'yogakaraka': ['Saturn'], 'benefics': ['Sun', 'Mercury', 'Venus', 'Saturn'], 'malefics': ['Mars', 'Jupiter'], 'neutral': ['Moon'], 'maraka': ['Mars', 'Jupiter'], 'badhaka': ['Saturn'] },
  'Gemini': { 'yogakaraka': ['Venus'], 'benefics': ['Mercury', 'Venus', 'Saturn'], 'malefics': ['Mars', 'Jupiter', 'Sun'], 'neutral': ['Moon'], 'maraka': ['Jupiter', 'Mars'], 'badhaka': ['Jupiter'] },
  'Cancer': { 'yogakaraka': ['Mars'], 'benefics': ['Moon', 'Mars', 'Jupiter'], 'malefics': ['Mercury', 'Venus', 'Saturn'], 'neutral': ['Sun'], 'maraka': ['Mercury'], 'badhaka': ['Saturn'] },
  'Leo': { 'yogakaraka': ['Mars'], 'benefics': ['Sun', 'Mars', 'Jupiter'], 'malefics': ['Mercury', 'Venus', 'Saturn'], 'neutral': ['Moon'], 'maraka': ['Mercury', 'Venus'], 'badhaka': ['Jupiter'] },
  'Virgo': { 'yogakaraka': ['Venus'], 'benefics': ['Mercury', 'Venus'], 'malefics': ['Mars', 'Jupiter', 'Moon', 'Sun'], 'neutral': ['Saturn'], 'maraka': ['Mars', 'Jupiter'], 'badhaka': ['Mars'] },
  'Libra': { 'yogakaraka': ['Saturn'], 'benefics': ['Venus', 'Saturn', 'Mercury', 'Moon'], 'malefics': ['Sun', 'Mars', 'Jupiter'], 'neutral': [], 'maraka': ['Mars', 'Jupiter'], 'badhaka': ['Moon'] },
  'Scorpio': { 'yogakaraka': ['Jupiter'], 'benefics': ['Moon', 'Sun', 'Mars', 'Jupiter'], 'malefics': ['Mercury', 'Venus', 'Saturn'], 'neutral': [], 'maraka': ['Venus', 'Mercury'], 'badhaka': ['Venus'] },
  'Sagittarius': { 'yogakaraka': ['Mars'], 'benefics': ['Sun', 'Mars', 'Jupiter'], 'malefics': ['Mercury', 'Venus', 'Saturn'], 'neutral': ['Moon'], 'maraka': ['Mercury', 'Venus'], 'badhaka': ['Saturn'] },
  'Capricorn': { 'yogakaraka': ['Venus'], 'benefics': ['Mercury', 'Venus', 'Saturn'], 'malefics': ['Mars', 'Jupiter', 'Moon', 'Sun'], 'neutral': [], 'maraka': ['Jupiter', 'Mars'], 'badhaka': ['Jupiter'] },
  'Aquarius': { 'yogakaraka': ['Venus'], 'benefics': ['Venus', 'Saturn', 'Sun'], 'malefics': ['Mars', 'Jupiter', 'Moon'], 'neutral': ['Mercury'], 'maraka': ['Mars', 'Jupiter'], 'badhaka': ['Mars'] },
  'Pisces': { 'yogakaraka': ['Moon', 'Mars'], 'benefics': ['Moon', 'Mars', 'Jupiter'], 'malefics': ['Sun', 'Venus', 'Saturn', 'Mercury'], 'neutral': [], 'maraka': ['Mercury', 'Venus', 'Saturn'], 'badhaka': ['Mercury'] }
};

const PLANETARY_DIGNITY = {
  'Sun': { 'exaltation': 'Aries', 'debilitation': 'Libra', 'mooltrikona': 'Leo', 'own_signs': ['Leo'] },
  'Moon': { 'exaltation': 'Taurus', 'debilitation': 'Scorpio', 'mooltrikona': 'Taurus', 'own_signs': ['Cancer'] },
  'Mars': { 'exaltation': 'Capricorn', 'debilitation': 'Cancer', 'mooltrikona': 'Aries', 'own_signs': ['Aries', 'Scorpio'] },
  'Mercury': { 'exaltation': 'Virgo', 'debilitation': 'Pisces', 'mooltrikona': 'Virgo', 'own_signs': ['Gemini', 'Virgo'] },
  'Jupiter': { 'exaltation': 'Cancer', 'debilitation': 'Capricorn', 'mooltrikona': 'Sagittarius', 'own_signs': ['Sagittarius', 'Pisces'] },
  'Venus': { 'exaltation': 'Pisces', 'debilitation': 'Virgo', 'mooltrikona': 'Libra', 'own_signs': ['Taurus', 'Libra'] },
  'Saturn': { 'exaltation': 'Libra', 'debilitation': 'Aries', 'mooltrikona': 'Aquarius', 'own_signs': ['Capricorn', 'Aquarius'] },
};

interface BirthDetails {
  dob: string; tob: string; lat: number; lon: number; tz: number;
}

async function handler(req: Request) {

  const functionStartTime = Date.now();
  console.log(`[PERF_LOG] Function execution started.`);

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("Authentication failed: User not found.");

    const { profile_id, scope, report_type, skip_transits } = await req.json();
    if (!profile_id || !scope) throw new Error("Invalid request: Missing profile_id or scope.");

    if (scope === 'charts') {
      // --- MODIFIED: Fetch birth details first, as they are needed for transits even on a cache hit ---
      const { data: birthDetailsRaw, error: detailsError } = await supabaseAdmin.from('user_birth_details').select(`*, user_profiles ( user_id )`).eq('profile_id', profile_id).single();
      if (detailsError) throw new Error(`Database error: ${detailsError.message}`);
      if (!birthDetailsRaw) throw new Error(`Data integrity error: Birth details missing for profile ID ${profile_id}.`);

      const profileData = birthDetailsRaw.user_profiles as { user_id: string };
      if (!profileData || profileData.user_id !== user.id) throw new Error("Authorization error: User does not own this profile.");

      const birthDetails = formatBirthDetails(birthDetailsRaw);

      const { data: cachedPaths } = await supabaseAdmin.from('profile_astro_data').select('*').eq('profile_id', profile_id).maybeSingle();

      let chartData;
      let processed_tables;
      let ai_reports;

      if (cachedPaths && cachedPaths.chart_data_path && cachedPaths.processed_tables_path) {
        console.log(`[CACHE HIT] Found existing data paths for profile ${profile_id}. Fetching from Storage.`);
        const { data: rawDataBlob, error: rawError } = await supabaseAdmin.storage.from('astro-data').download(cachedPaths.chart_data_path);
        if (rawError) throw new Error(`Failed to download cached raw data: ${rawError.message}`);
        const { data: processedDataBlob, error: processedError } = await supabaseAdmin.storage.from('astro-data').download(cachedPaths.processed_tables_path);
        if (processedError) throw new Error(`Failed to download cached processed data: ${processedError.message}`);
        chartData = JSON.parse(await rawDataBlob.text());
        processed_tables = JSON.parse(await processedDataBlob.text());
        ai_reports = cachedPaths; // All report columns are in this object
        // REPLACE YOUR EXISTING 'else' BLOCK WITH THIS ONE

      } else {
        console.log(`[CACHE MISS] No data found for profile ${profile_id}. Generating from scratch.`);

        const step1_startTime = Date.now();
        chartData = await fetchAllChartData(birthDetails);
        const step1_endTime = Date.now();
        console.log(`[PERF_LOG] Step 1: fetchAllChartData took ${step1_endTime - step1_startTime}ms`);

        const step2_startTime = Date.now();
        processed_tables = processAllTables(chartData);
        const step2_endTime = Date.now();
        console.log(`[PERF_LOG] Step 2: processAllTables took ${step2_endTime - step2_startTime}ms`);

        const rawDataPath = `${profile_id}/raw_chart_data.json`;
        const processedDataPath = `${profile_id}/processed_tables.json`;
        const rawDataString = JSON.stringify(chartData, null, 2);
        const processedDataString = JSON.stringify(processed_tables, null, 2);

        const step3_startTime = Date.now();
        await supabaseAdmin.storage.from('astro-data').upload(rawDataPath, rawDataString, { upsert: true, contentType: 'application/json' });
        const step3_endTime = Date.now();
        console.log(`[PERF_LOG] Step 3: Upload raw data to Storage took ${step3_endTime - step3_startTime}ms`);

        const step4_startTime = Date.now();
        await supabaseAdmin.storage.from('astro-data').upload(processedDataPath, processedDataString, { upsert: true, contentType: 'application/json' });
        const step4_endTime = Date.now();
        console.log(`[PERF_LOG] Step 4: Upload processed data to Storage took ${step4_endTime - step4_startTime}ms`);

        const step5_startTime = Date.now();
        const { data: updatedAstroData, error: upsertError } = await supabaseAdmin
          .from('profile_astro_data')
          .upsert({
            profile_id,
            chart_data_path: rawDataPath,
            processed_tables_path: processedDataPath,
            vimshottari_dasha: processed_tables.vimshottari_dasha,
            last_generated_at: new Date().toISOString(),
            // yogas_llm: { "status": "generating" }
          }, { onConflict: 'profile_id' })
          .select()
          .single();
        if (upsertError) throw new Error(`Database error during upsert: ${upsertError.message}`);
        const step5_endTime = Date.now();
        console.log(`[PERF_LOG] Step 5: Upsert record in Database took ${step5_endTime - step5_startTime}ms`);

        ai_reports = updatedAstroData;

        // console.log(`[ASYNC TRIGGER] Invoking 'generate-yogas' for profile ${profile_id}.`);
        // supabaseAdmin.functions.invoke('generate-yogas', { body: { profile_id } })
        //   .then(({ error }) => {
        //     if (error) {
        //       console.error(`[ASYNC ERROR] Failed to invoke 'generate-yogas' function:`, error.message);
        //     }
        //   });
      }
      // --- OPTIMIZATION: Skip the live VedicAstro transit call when the caller only needs
      // the cached birth chart (e.g. the Astral Dashboard just renders north_chart_svg).
      // This avoids consuming a VedicAstro API call on every dashboard load. Callers that
      // need fresh transits (Reports page) simply omit skip_transits. ---
      if (!skip_transits) {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

        // Transits only change once per day. Reuse a same-day cached result so repeated
        // Reports/Dashboard loads don't each burn a VedicAstro API call.
        if (cachedPaths && cachedPaths.current_transits_date === today && cachedPaths.current_transits_cache) {
          console.log(`[TRANSIT CACHE HIT] Reusing cached transits for ${today}. No live fetch.`);
          const cachedTransit = cachedPaths.current_transits_cache;
          processed_tables.current_transits = cachedTransit.table;
          if (!processed_tables.divisional_chart_svgs) processed_tables.divisional_chart_svgs = {};
          processed_tables.divisional_chart_svgs.current_transit_svg = cachedTransit.svg;
        } else {
          const step6_startTime = Date.now();
          const transitData = await fetchAndProcessCurrentTransits(birthDetails, processed_tables.houses);
          const step6_endTime = Date.now();
          console.log(`[PERF_LOG] Step 6 (Final): fetchAndProcessCurrentTransits took ${step6_endTime - step6_startTime}ms`);

          processed_tables.current_transits = transitData.table;

          if (!processed_tables.divisional_chart_svgs) {
            processed_tables.divisional_chart_svgs = {};
          }
          processed_tables.divisional_chart_svgs.current_transit_svg = transitData.svg;

          // Persist today's transit so subsequent same-day loads reuse it (no API call).
          supabaseAdmin.from('profile_astro_data').update({
            current_transits_cache: { table: transitData.table, svg: transitData.svg },
            current_transits_date: today,
          }).eq('profile_id', profile_id).then(({ error }) => {
            if (error) console.error(`[TRANSIT CACHE] Failed to persist transits: ${error.message}`);
          });
        }
      } else {
        console.log(`[PERF_LOG] Step 6 skipped (skip_transits=true). No live transit fetch.`);
      }

      const functionEndTime = Date.now();
      console.log(`[PERF_LOG] Total function execution time before return: ${functionEndTime - functionStartTime}ms`);

      return new Response(JSON.stringify({
        chart_data: chartData,
        processed_tables: processed_tables,
        ai_reports: ai_reports
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (scope === 'ai') {
      if (!report_type) throw new Error("Invalid request: Missing report_type.");

      // --- MASTER REPORT CONFIGURATION OBJECT (Corrected & Proactive) ---
      // Vimshottari Dasha is now included in ALL configurations as a baseline for timing.
      const reportConfigs = {
        'basic_life_insight': { targetColumn: 'basic_life_insight', promptName: 'insights_basic_life', coinCost: 0, requiredTables: ['d1_planets', 'houses', 'yogas', 'vimshottari_dasha'] },
        'life_forecast_12_month': { targetColumn: 'life_forecast_12_month', promptName: 'insights_life_forecast', coinCost: 10, requiredTables: ['d1_planets', 'houses', 'vimshottari_dasha', 'planetary_aspects'] },
        'destiny_blueprint': { targetColumn: 'destiny_blueprint', promptName: 'insights_destiny_blueprint', coinCost: 10, requiredTables: ['d1_planets', 'houses', 'yogas', 'jaimini_karakas', 'vimshottari_dasha'] },
        'career_mastery': { targetColumn: 'career_mastery', promptName: 'insights_career_mastery', coinCost: 10, requiredTables: ['d1_planets', 'houses', 'yogas', 'divisional_charts.D10', 'vimshottari_dasha'] },
        'wealth_prosperity': { targetColumn: 'wealth_prosperity', promptName: 'insights_wealth_prosperity', coinCost: 10, requiredTables: ['d1_planets', 'houses', 'yogas', 'vimshottari_dasha'] },
        'love_marriage': { targetColumn: 'love_marriage', promptName: 'insights_love_marriage', coinCost: 10, requiredTables: ['d1_planets', 'houses', 'doshas', 'jaimini_karakas', 'divisional_charts.D9', 'vimshottari_dasha'] },
        'relationship_compatibility': { targetColumn: 'relationship_compatibility', promptName: 'insights_relationship_compatibility', coinCost: 2, requiredTables: [] }, // Special case
        'health_vitality': { targetColumn: 'health_vitality', promptName: 'insights_health_vitality', coinCost: 10, requiredTables: ['d1_planets', 'houses', 'divisional_charts.D30', 'vimshottari_dasha'] },
        'mind_inner_peace': { targetColumn: 'mind_inner_peace', promptName: 'insights_mind_peace', coinCost: 10, requiredTables: ['d1_planets', 'houses', 'vimshottari_dasha'] },
        'karma_life_purpose': { targetColumn: 'karma_life_purpose', promptName: 'insights_karma_purpose', coinCost: 10, requiredTables: ['d1_planets', 'houses', 'jaimini_karakas', 'yogas', 'vimshottari_dasha'] },
        'family_home_prosperity': { targetColumn: 'family_home_prosperity', promptName: 'insights_family_home', coinCost: 10, requiredTables: ['d1_planets', 'houses', 'divisional_charts.D16', 'yogas', 'vimshottari_dasha'] },
      };

      const config = reportConfigs[report_type as keyof typeof reportConfigs];
      if (!config) throw new Error(`Invalid report type specified: ${report_type}`);

      if (report_type === 'relationship_compatibility') {
        throw new Error("Compatibility report is not yet implemented.");
      }

      // --- NEW WALLET DEDUCTION LOGIC (With Premium Check) ---

      // 1. Determine the Service Key (SKU)
      // If config.coinCost is 0, it's always free ('report_basic'). Otherwise it's 'report_premium'.
      const serviceKey = (config.coinCost === 0) ? 'report_basic' : 'report_premium';

      // 2. Check Subscription Status
      // We need to know if the user is Premium to potentially bypass the cost.
      const { data: userSubStatus, error: subError } = await supabaseAdmin
        .from('users')
        .select('subscription_status')
        .eq('id', user.id)
        .single();

      if (subError) throw new Error(`User check failed: ${subError.message}`);

      const isPremium = userSubStatus?.subscription_status === 'active';

      // 3. Execute Deduction Logic
      // Rule: If it's a paid report ('report_premium') AND the user is Premium, it is FREE.
      if (serviceKey === 'report_premium' && isPremium) {
        console.log(`[Report] Premium User Access: Skipping deduction for ${report_type}`);
      } else {
        // Otherwise (Free User OR Non-Premium Report), we attempt deduction.
        // Note: If serviceKey is 'report_basic', the price in DB is 0, so deduction proceeds but takes 0 money.
        const deduction = await processWalletDeduction(supabaseAdmin, user.id, serviceKey);

        if (!deduction.success) {
           // Throw the specific error string required by Frontend to open the Wallet Modal
           throw new Error("Insufficient coins"); 
        }
        
        console.log(`[Report] Unlocked ${report_type}. Cost: ${deduction.deducted} ${deduction.currency}`);
      }
      
      const { data: existingData, error: fetchError } = await supabaseAdmin.from('profile_astro_data').select('*').eq('profile_id', profile_id).single();
      if (fetchError || !existingData || !existingData.processed_tables_path) {
        throw new Error("Base chart data not found. Please generate the charts first.");
      }
      if (existingData[config.targetColumn]) {
        throw new Error(`The '${report_type}' report has already been generated.`);
      }

      const { data: processedDataBlob, error: downloadError } = await supabaseAdmin.storage.from('astro-data').download(existingData.processed_tables_path);
      if (downloadError) throw new Error(`Failed to download processed data: ${downloadError.message}`);
      const allProcessedTables = JSON.parse(await processedDataBlob.text());

      // --- NEW LOGIC: Fetch Prompt Template FIRST ---
      const PROMPT_NAME = config.promptName;
      let systemPrompt: string | undefined, userPromptTemplate: string | undefined, modelName: string, secretName: string, apiProvider: string;
      const { data: promptData, error: promptError } = await supabaseAdmin.from('system_prompts').select('prompt_text, api_provider, model_name, secret_name').eq('prompt_name', PROMPT_NAME).eq('is_active', true).single();

      if (promptData && !promptError) {
        try { const prompts = JSON.parse(promptData.prompt_text); if (prompts && typeof prompts.system === 'string' && typeof prompts.user_template === 'string') { systemPrompt = prompts.system; userPromptTemplate = prompts.user_template; } } catch (e) { console.warn(`[FALLBACK] Failed to parse prompt '${PROMPT_NAME}' as JSON.`); } modelName = promptData.model_name || 'gpt-4o'; secretName = promptData.secret_name || 'OPENAI_API_KEY'; apiProvider = promptData.api_provider || 'openai';
      } else {
        modelName = 'gpt-4o'; secretName = 'OPENAI_API_KEY'; apiProvider = 'openai';
      }

      if (!systemPrompt || !userPromptTemplate) {
        throw new Error(`Prompt for '${PROMPT_NAME}' is not configured in the database.`);
      }

      // 1. Capture the current date.
      const currentDate = new Date().toDateString();

      // 2. Inject the current date into the prompt template first.
      // --- SOLUTION #1: Use replaceAll for clarity ---
      let finalUserPrompt = userPromptTemplate.replaceAll('{{CURRENT_DATE}}', currentDate);
      const placeholderMap: { [key: string]: string } = {
        'd1_planets': '{{D1_PLANETS_DATA}}',
        'houses': '{{HOUSES_DATA}}',
        'yogas': '{{YOGAS_DATA}}',
        'vimshottari_dasha': '{{DASHA_DATA}}',
        'doshas': '{{DOSHAS_DATA}}',
        'jaimini_karakas': '{{JAIMINI_DATA}}',
        'planetary_aspects': '{{ASPECTS_DATA}}',
        'divisional_charts.D9': '{{D9_CHART_DATA}}',
        'divisional_charts.D10': '{{D10_CHART_DATA}}',
        'divisional_charts.D16': '{{D16_CHART_DATA}}',
        'divisional_charts.D30': '{{D30_CHART_DATA}}',
      };

      for (const tablePath of config.requiredTables) {
        const placeholder = placeholderMap[tablePath];
        if (!placeholder) continue; // Skip if no placeholder is defined

        let dataForPlaceholder = null;
        const pathParts = tablePath.split('.');

        if (pathParts.length === 2) { // Handle nested divisional charts
          const [mainKey, subKey] = pathParts;
          if (allProcessedTables[mainKey] && allProcessedTables[mainKey][subKey]) {
            dataForPlaceholder = allProcessedTables[mainKey][subKey];
          }
        } else { // Handle top-level tables
          if (allProcessedTables[tablePath]) {
            dataForPlaceholder = allProcessedTables[tablePath];
          }
        }

        const dataString = JSON.stringify(dataForPlaceholder || 'Not available', null, 2);
        finalUserPrompt = finalUserPrompt.replace(placeholder, dataString);
      }

      // Clean up any unused placeholders to avoid confusing the AI
      finalUserPrompt = finalUserPrompt.replace(/{{[A-Z0-9_]+_DATA}}/g, 'Data for this section was not requested or is not available.');

      // We no longer need the generic payload object for the AI function
      const aiInsights = await generateAiInsights(null, systemPrompt, userPromptTemplate, modelName, secretName, apiProvider, finalUserPrompt);
      // --- Database Update & Response ---
      const updatePayload = { [config.targetColumn]: aiInsights.analyst_report, last_generated_at: new Date().toISOString() };
      const { data: updatedAstroData, error: updateError } = await supabaseAdmin.from('profile_astro_data').update(updatePayload).eq('profile_id', profile_id).select().single();
      if (updateError) throw new Error(`Failed to cache AI insights: ${updateError.message}`);

      // We need to construct the full response object the frontend expects
      const { data: rawDataBlob, error: rawDownloadError } = await supabaseAdmin.storage.from('astro-data').download(existingData.chart_data_path);
      if (rawDownloadError) throw new Error(`Failed to re-download raw data: ${rawDownloadError.message}`);
      const chartDataForReturn = JSON.parse(await rawDataBlob.text());

      return new Response(JSON.stringify({
        chart_data: chartDataForReturn,
        processed_tables: allProcessedTables,
        ai_reports: updatedAstroData // Return the entire row with all unlocked reports
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    throw new Error(`Invalid scope provided: ${scope}`);
  } catch (err) {
    console.error(`[CRITICAL ERROR] Function execution failed: ${err.message}`);
    const functionEndTime = Date.now();
    console.log(`[PERF_LOG] Total function execution time (on error): ${functionEndTime - functionStartTime}ms`);
    throw err;
  }
}

Deno.serve(createCorsWrappedHandler(handler));

// --- HELPER AND DATA PROCESSING FUNCTIONS ---

// --- NEW VERSION of fetchAndProcessCurrentTransits ---

async function fetchAndProcessCurrentTransits(birthDetails: BirthDetails, natalHouses: any[]) {
  try {
    if (!Array.isArray(natalHouses) || natalHouses.length === 0) {
      console.warn("[Transits] Natal houses table is not available. Cannot calculate current transits.");
      // Return the new object shape even on early exit
      return { table: [], svg: null };
    }

    // 1. Prepare parameters for the API calls (this part is the same)
    const today = new Date();
    const dob = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const transitParams = {
      dob: dob,
      tob: '05:30', // Fixed time as requested
      lat: birthDetails.lat,
      lon: birthDetails.lon,
      tz: birthDetails.tz
    };

    // 2. Make BOTH API calls concurrently for speed
    const [transitPlanetDetails, transitSvg] = await Promise.all([
      makeVedicastroRequest('/horoscope/planet-details', transitParams, 'Current Transits'),
      makeVedicastroSvgRequest('/horoscope/chart-image', { ...transitParams, div: 'D1', style: 'north' }, 'Current Transit SVG')
    ]);

    if (!transitPlanetDetails || typeof transitPlanetDetails !== 'object') {
      console.warn("[Transits] Failed to fetch valid transit data from the API.");
      return { table: [], svg: transitSvg }; // Still return the SVG if it succeeded
    }

    // 3. Create the sign-to-house map (this part is the same)
    const signToHouseMap = new Map<string, number>();
    natalHouses.forEach(house => {
      if (house.Sign && house.House) {
        signToHouseMap.set(house.Sign, house.House);
      }
    });

    // 4. Process the transit data into a table (this part is the same)
    const processedTable = Object.values(transitPlanetDetails).map((planet_data: any) => {
      if (typeof planet_data !== 'object' || !planet_data.full_name) return null;

      const planetSign = planet_data.zodiac;
      const natalHouse = signToHouseMap.get(planetSign) || 'N/A';

      return {
        "Planet": planet_data.full_name,
        "Sign": planetSign,
        "House": natalHouse,
        "Degree": planet_data.local_degree?.toFixed(2),
        "Retrograde": planet_data.retro || 'No',
        "Nakshatra": planet_data.nakshatra
      };
    }).filter(p => p);

    // 5. Return the new object containing BOTH the table and the SVG
    return { table: processedTable, svg: transitSvg };

  } catch (error) {
    console.error(`[CRITICAL] Failed to fetch or process current transits: ${error.message}`);
    // Return a consistent object shape on failure
    return { table: [], svg: null };
  }
}

function getPlanetaryDignity(planetName: string, planetSign: string): string {
  const dignityRules = PLANETARY_DIGNITY[planetName as keyof typeof PLANETARY_DIGNITY];
  if (!dignityRules) {
    return ""; // No rules for this planet (e.g., Rahu, Ketu, Ascendant)
  }

  if (planetSign === dignityRules.exaltation) return "Exalted";
  if (planetSign === dignityRules.debilitation) return "Debilitated";
  if (planetSign === dignityRules.mooltrikona) return "Mooltrikona";
  if (dignityRules.own_signs.includes(planetSign)) return "Own House";

  return ""; // No dignity found
}

// ... (The rest of your existing helper functions: generateAiInsights, formatBirthDetails, makeVedicastroRequest, etc., remain unchanged)
async function generateAiInsights(
  chartData: any,
  systemPrompt: string,
  userPromptTemplate: string,
  modelName: string,
  secretName: string,
  apiProvider: string,
  finalUserPrompt: string
) {
  const apiKey = Deno.env.get(secretName);
  if (!apiKey) { throw new Error(`CRITICAL: The specified secret '${secretName}' was not found.`); }
  let analyst_report: string | null = null;

  // Fireworks models (accounts/fireworks/...) use the OpenAI-compatible Fireworks
  // endpoint. The report prompts are configured with api_provider 'openrouter' but
  // point at Fireworks models + FIREWORKS_API_KEY, so route by model prefix. This
  // is what actually powers reports (there is no OpenAI/Anthropic key configured).
  const isFireworks = modelName.startsWith('accounts/fireworks/');
  if (isFireworks) {
    const openai = new OpenAI({ apiKey, baseURL: 'https://api.fireworks.ai/inference/v1' });
    const completion = await openai.chat.completions.create({
      model: modelName,
      temperature: 0.2,
      max_tokens: 4096,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: finalUserPrompt }],
    });
    analyst_report = completion.choices[0].message.content?.trim() || null;
  } else if (apiProvider === 'openai') {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({ model: modelName, temperature: 0.2, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: finalUserPrompt }], }); // Use finalUserPrompt here
    analyst_report = completion.choices[0].message.content?.trim() || null;
  } else if (apiProvider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey });
    const completion = await anthropic.messages.create({ model: modelName, system: systemPrompt, messages: [{ role: "user", content: finalUserPrompt }], max_tokens: 2048, temperature: 0.2, }); // Use finalUserPrompt here
    analyst_report = completion.content[0]?.text || null;
  } else { throw new Error(`Unsupported API provider '${apiProvider}' specified.`); }
  return { analyst_report: analyst_report || "The AI analyst did not return a valid report." };
}
function formatBirthDetails(details: any): BirthDetails {
  const date_of_birth = details.date_of_birth.split('T')[0];
  const time_of_birth = details.time_of_birth.split('.')[0];
  const [year, month, day] = date_of_birth.split('-');
  const [hour, minute] = time_of_birth.split(':');
  if (details.timezone_offset === null || details.timezone_offset === undefined) { throw new Error(`Data integrity error: The 'timezone_offset' is missing for this profile. Please re-save the profile.`); }
  const correctTimezone = parseFloat(details.timezone_offset);
  return { dob: `${day}/${month}/${year}`, tob: `${hour}:${minute}`, lat: parseFloat(details.birth_lat), lon: parseFloat(details.birth_lng), tz: correctTimezone };
}

async function makeVedicastroRequest(endpoint: string, params: object, desc: string) {
  const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
  if (!apiKey) throw new Error("CRITICAL: VEDICASTRO_API_KEY secret is not set.");
  const url = new URL(VEDICASTRO_API_BASE_URL + endpoint);
  const allParams: Record<string, any> = { api_key: apiKey, lang: LANGUAGE, ...params };
  Object.keys(allParams).forEach(key => url.searchParams.append(key, allParams[key]));
  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
  if (!response.ok) { throw new Error(`External API Error for '${desc}': Status ${response.status} - ${await response.text()}`); }
  const data = await response.json();

  // Check for API quota exceeded or subscription issues
  if (data.response && typeof data.response === 'string' &&
    (data.response.includes('out of api calls') || data.response.includes('renew subscription'))) {
    console.error(`[VEDICASTRO API QUOTA EXCEEDED] ${desc}: ${data.response}`);
    throw new Error(`VedicAstro API quota exceeded. Please contact support to renew subscription.`);
  }

  if (!data.response) throw new Error(`External API Error for '${desc}': Response object is missing.`);
  return data.response;
}

async function makeVedicastroSvgRequest(endpoint: string, params: object, desc: string) {
  const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
  if (!apiKey) throw new Error("CRITICAL: VEDICASTRO_API_KEY secret is not set.");
  const url = new URL(VEDICASTRO_API_BASE_URL + endpoint);
  const allParams: Record<string, any> = { api_key: apiKey, lang: LANGUAGE, ...params };
  Object.keys(allParams).forEach(key => url.searchParams.append(key, allParams[key]));
  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
  if (!response.ok) { throw new Error(`External API Error for '${desc}': Status ${response.status} - ${await response.text()}`); }
  const text = await response.text();

  // Check for API quota exceeded in SVG response
  if (text.includes('out of api calls') || text.includes('renew subscription')) {
    console.error(`[VEDICASTRO API QUOTA EXCEEDED] ${desc}: ${text}`);
    throw new Error(`VedicAstro API quota exceeded. Please contact support to renew subscription.`);
  }

  try { const jsonData = JSON.parse(text); if (!jsonData.response) throw new Error(`External API Error for '${desc}': SVG string is missing from response.`); return jsonData.response; } catch { return text; }
}

async function fetchAllChartData(details: BirthDetails) {
  const baseParams = { dob: details.dob, tob: details.tob, lat: details.lat, lon: details.lon, tz: details.tz };
  const birthYear = parseInt(details.dob.split('/')[2], 10);
  const endpoints = {
    planet_details: "/horoscope/planet-details", shadbala: "/extended-horoscope/shad-bala", ashtak_data: "/horoscope/ashtakvarga", houses: "/horoscope/planets-in-houses", yogas: "/extended-horoscope/yoga-list", mahadasha: "/dashas/maha-dasha", antardasha: "/dashas/antar-dasha", jaimini_karakas: "/extended-horoscope/jaimini-karakas", planetary_friendship: "/extended-horoscope/friendship", current_sade_sati: "/extended-horoscope/current-sade-sati",
    mangal_dosh_details: "/dosha/mangal-dosh",
    kaalsarp_dosh_details: "/dosha/kaalsarp-dosh",
    pitra_dosh_details: "/dosha/pitra-dosh",
  };
  // Trimmed to the divisional charts actually used by the reports (D9/D10/D16/D30)
  // plus the ones commonly viewed in the Charts tab. Fetching all 19 (plus an SVG
  // each) fired ~60+ VedicAstro calls at once, which the API throttled — pushing
  // first-time generation past the edge function timeout (504). Removed charts
  // simply won't appear as tabs; nothing breaks.
  const divisionalChartsToProcess = ['D1', 'D9', 'D10', 'D12', 'D16', 'D24', 'D30', 'D60', 'chalit', 'moon'];
  // Only render SVG images for the most-viewed / report-relevant charts. Other
  // charts fall back to the table view (already handled in the UI), avoiding a
  // separate chart-image API call for each one.
  const svgChartsToProcess = ['D9', 'D10', 'D16', 'D30'];
  const safelyFetch = (fetchPromise: Promise<any>, endpointName: string) =>
    fetchPromise
      .then(data => ({ [endpointName]: data }))
      .catch(error => {
        // MODIFICATION: Using console.error and logging the full error object.
        console.error(`[CRITICAL API Sub-request Failed] Could not fetch '${endpointName}'. Full Error Details:`, error);
        // The function still returns null on failure so the other API calls can succeed.
        return { [endpointName]: null };
      });
  const dataPromises = Object.entries(endpoints).map(([key, endpoint]) => safelyFetch(makeVedicastroRequest(endpoint, baseParams, key), key));
  const divPromises = divisionalChartsToProcess.map(div => safelyFetch(makeVedicastroRequest("/horoscope/divisional-charts", { ...baseParams, div }, `Div Chart ${div}`), div));

  const transitPromises = PLANETS_TO_FETCH_TRANSITS.map(planet =>
    safelyFetch(
      makeVedicastroRequest("/panchang/transit-dates", { year: birthYear, planet: planet }, `${planet} Transit ${birthYear}`),
      `transit_${planet.toLowerCase()}`
    )
  );

  // Fetch SVGs only for the report-relevant charts (others use the table fallback).
  const divSvgPromises = svgChartsToProcess.map(div =>
    safelyFetch(
      makeVedicastroSvgRequest("/horoscope/chart-image", { ...baseParams, div, style: 'north' }, `Div Chart SVG ${div}`),
      `${div}_svg` // Store result with a key like "D9_svg"
    )
  );

  const aspectsPromise = safelyFetch(makeVedicastroRequest("/horoscope/planetary-aspects", { ...baseParams, aspect_response_type: 'houses' }, "Planetary Aspects"), "planetary_aspects");
  const northChartPromise = safelyFetch(makeVedicastroSvgRequest("/horoscope/chart-image", { ...baseParams, div: 'D1', style: 'north' }, "North Indian Chart Image"), "north_chart_svg");

  // The new divSvgPromises array is added to Promise.all
  const results = await Promise.all([
    ...dataPromises,
    ...divPromises,
    ...divSvgPromises,
    ...transitPromises,
    aspectsPromise,
    northChartPromise
  ]);

  const combinedData = results.reduce((acc, current) => ({ ...acc, ...current }), {});
  if (!combinedData.planet_details || !combinedData.north_chart_svg) { throw new Error("Failed to retrieve essential data (planets or chart images) from the external API."); }
  return combinedData;
}

function processDivisionalChartSvgs(apiData: any) {
  try {
    const svgData: { [key: string]: string } = {};
    const svgKeys = Object.keys(apiData).filter(k => k.endsWith('_svg'));

    for (const key of svgKeys) {
      if (typeof apiData[key] === 'string') {
        svgData[key] = apiData[key];
      }
    }
    return svgData;
  } catch (err) {
    console.error("CRITICAL PROCESSING ERROR in processDivisionalChartSvgs:", err.message);
    return { "error": "Failed to process divisional chart SVGs." };
  }
}

function processD1PlanetsTable(apiData: any, sarvashtakavargaMap: Map<string, number>, friendshipData: any, d9ChartData: any[], ascendantSign: string | null, jaiminiMap: Map<string, { karak: string; signifier: string }>) {
  try {
    const hasFriendshipData = Array.isArray(friendshipData) && friendshipData.length > 0;
    const planetsList = Object.values(apiData.planet_details || {});
    if (planetsList.length === 0) return [{ "Info": "No planetary details were found." }];
    const shadbala = apiData.shadbala || {};

    const d9PlanetSignMap = new Map<string, string>();
    if (Array.isArray(d9ChartData)) {
      for (const planet of d9ChartData) {
        if (planet.Planet && planet.Sign) {
          d9PlanetSignMap.set(planet.Planet, planet.Sign);
        }
      }
    }

    const natureRules = (ascendantSign && FUNCTIONAL_NATURE[ascendantSign as keyof typeof FUNCTIONAL_NATURE])
      ? FUNCTIONAL_NATURE[ascendantSign as keyof typeof FUNCTIONAL_NATURE]
      : null;

    const warData = new Map<string, string>();
    for (let i = 0; i < planetsList.length; i++) {
      for (let j = i + 1; j < planetsList.length; j++) {
        const planetA = planetsList[i] as any;
        const planetB = planetsList[j] as any;
        if (!planetA.full_name || !planetB.full_name || !planetA.local_degree || !planetB.local_degree) continue;
        if (planetA.zodiac === planetB.zodiac && Math.abs(planetA.local_degree - planetB.local_degree) < 1) {
          warData.set(planetA.full_name, planetB.full_name);
          warData.set(planetB.full_name, planetA.full_name);
        }
      }
    }

    return planetsList.map((planet_data: any) => {
      if (typeof planet_data !== 'object' || !planet_data.full_name) return null;

      const planetName = planet_data.full_name;
      const planetKey = planetName.charAt(0).toUpperCase() + planetName.slice(1);
      const planetSignD1 = planet_data.zodiac;
      const signLord = SIGN_RULERS[planetSignD1 as keyof typeof SIGN_RULERS] || 'N/A';
      const planetSignD9 = d9PlanetSignMap.get(planetName);
      const vargottamaStatus = (planetSignD1 && planetSignD9 && planetSignD1 === planetSignD9) ? "Yes" : "No";

      let functionalNatureString = 'N/A';
      if (natureRules) {
        const roles: string[] = [];
        if (natureRules.benefics.includes(planetName)) roles.push('Benefic');
        else if (natureRules.malefics.includes(planetName)) roles.push('Malefic');
        else if (natureRules.neutral.includes(planetName)) roles.push('Neutral');

        if (natureRules.yogakaraka.includes(planetName)) roles.push('Yogakaraka');
        if (natureRules.maraka.includes(planetName)) roles.push('Maraka');
        if (natureRules.badhaka.includes(planetName)) roles.push('Badhaka');

        if (roles.length > 0) functionalNatureString = roles.join(', ');
      }

      // --- NEW, PRIORITIZED STATUS LOGIC ---
      let planetStatus: string;

      // First, check for the highest priority status: inherent dignity.
      const inherentDignity = getPlanetaryDignity(planetName, planetSignD1);

      if (inherentDignity) {
        // If the planet has a dignity like Exalted, Debilitated, Mooltrikona, or Own House,
        // this is the only status we need to show.
        planetStatus = inherentDignity;
      } else {
        // Only if no inherent dignity is found, do we check for friendship status.
        let friendshipStatus = 'N/A'; // Default to 'N/A' if no friendship data exists
        if (hasFriendshipData) {
          const relationships = friendshipData.find((f: any) => f.Planet.toLowerCase() === planetName.toLowerCase());
          if (relationships) {
            if (relationships.Friends.includes(signLord)) {
              friendshipStatus = 'Friendly';
            } else if (relationships.Enemies.includes(signLord)) {
              friendshipStatus = 'Enemy';
            } else if (relationships.Neutral.includes(signLord)) {
              friendshipStatus = 'Neutral';
            }
          }
        }
        planetStatus = friendshipStatus;
      }

      const warringPlanet = warData.get(planetName);
      const jaiminiInfo = jaiminiMap.get(planetName) || { karak: '-', signifier: '-' };

      return {
        "Planet": planetName,
        "House": planet_data.house,
        "Sign": planetSignD1,
        "Sign Lord": signLord,
        "Planet Status": planetStatus,
        "Degree": planet_data.local_degree?.toFixed(2),
        "Retrograde": planet_data.retro || 'No',
        "Nakshatra": planet_data.nakshatra,
        "Nakshatra Lord": planet_data.nakshatra_lord,
        "Nakshatra Pada": planet_data.nakshatra_pada,
        "Functional Nature": functionalNatureString,
        "Is Combust": planet_data.is_combust || 'No', // Renamed for clarity from "Combust"
        "Planetary War": warringPlanet ? `War with ${warringPlanet}` : '-',
        "Vargottama": vargottamaStatus,
        "Shadbala (Total)": typeof shadbala.total_balas?.[planetKey] === 'number' ? shadbala.total_balas[planetKey].toFixed(2) : 'N/A',
        "Shadbala (Ratio)": typeof shadbala.ratio?.[planetKey] === 'number' ? shadbala.ratio[planetKey].toFixed(2) : 'N/A',
        "Ashtakavarga": sarvashtakavargaMap.get(planetSignD1)?.toString() || 'N/A',
        "Karak": jaiminiInfo.karak,
        "Signifier": jaiminiInfo.signifier
      };
    }).filter(p => p);
  } catch (err) {
    console.error("CRITICAL PROCESSING ERROR in processD1PlanetsTable:", err.message);
    return [{ "Error": "Failed to process Planetary Details table." }];
  }
}

function processHousesTable(apiData: any, sarvashtakavargaMap: Map<string, number>) {
  try {
    const housesData = Object.values(apiData.houses || {});
    if (housesData.length === 0) return [{ "Info": "No house details were found." }];

    // REMOVED: The old, incorrect logic for creating 'sarvashtakavarga' has been deleted from here.

    return housesData.map((house: any) => {
      if (typeof house !== 'object' || !house.house) return null;
      const houseNum = parseInt(house.house, 10);
      const houseZodiac = house.zodiac;
      return {
        "House": houseNum,
        "Sign": houseZodiac,
        "Planets": house.planets?.join(', ') || '-',
        "Sign Lord": SIGN_RULERS[houseZodiac as keyof typeof SIGN_RULERS] || 'N/A',
        // MODIFIED: This line now uses the correctly mapped data passed into the function.
        "Ashtakavarga": sarvashtakavargaMap.get(houseZodiac)?.toString() || 'N/A',
        "Signification": HOUSE_SIGNIFICATIONS[houseNum as keyof typeof HOUSE_SIGNIFICATIONS] || ""
      };
    }).filter(h => h).sort((a, b) => a.House - b.House);
  } catch (err) {
    console.error("CRITICAL PROCESSING ERROR in processHousesTable:", err.message);
    return [{ "Error": "Failed to process House Details table." }];
  }
}
function processYogasTable(apiData: any) { try { const yogasList = apiData.yogas?.yogas_list || []; if (!Array.isArray(yogasList) || yogasList.length === 0) return [{ "Yoga Name": "No Yogas Found", "Description": "" }]; return yogasList.map((yoga: any) => ({ "Yoga Name": yoga.yoga, "Description": yoga.meaning })); } catch (err) { console.error("CRITICAL PROCESSING ERROR in processYogasTable:", err.message); return [{ "Error": "Failed to process Yogas table." }]; } }
function parseDashaDate(dateStr: string) { if (!dateStr || typeof dateStr !== 'string') return "N/A"; try { const date = new Date(dateStr); const day = String(date.getDate()).padStart(2, '0'); const month = String(date.getMonth() + 1).padStart(2, '0'); const year = date.getFullYear(); return `${day}/${month}/${year}`; } catch { return dateStr; } }
function processDashasTable(apiData: any) { try { const mahadasha = apiData.mahadasha; const antardasha = apiData.antardasha; if (!mahadasha || !antardasha || !mahadasha.dasha_start_date) return [{ "Info": "Dasha data not available." }]; const results: any[] = []; let currentAdStartDateRaw = mahadasha.dasha_start_date; const adPeriodsNested = antardasha.antardashas || []; const adEndatesNestedRaw = antardasha.antardasha_order || []; adPeriodsNested.forEach((adPeriodList: string[], i: number) => { if (!adEndatesNestedRaw[i]) return; adPeriodList.forEach((adPeriodStr: string, j: number) => { try { const [mdLord, adLord] = adPeriodStr.split('/'); const adEndDateRaw = adEndatesNestedRaw[i][j]; if (!adEndDateRaw) return; results.push({ "Mahadasha Lord": mdLord, "Antardasha Lord": adLord, "Start Date": parseDashaDate(currentAdStartDateRaw), "End Date": parseDashaDate(adEndDateRaw) }); currentAdStartDateRaw = adEndDateRaw; } catch { /* Skip malformed dasha entries */ } }); }); if (results.length === 0) return [{ "Info": "No Dasha periods could be parsed." }]; return results; } catch (err) { console.error("CRITICAL PROCESSING ERROR in processDashasTable:", err.message); return [{ "Error": "Failed to process Dasha table." }]; } }
function processDivisionalCharts(apiData: any) { try { const divisionalData: { [key: string]: any[] } = {}; const chartKeys = Object.keys(apiData).filter(k => k.startsWith('D') || ['chalit', 'moon', 'sun'].includes(k)); for (const chartKey of chartKeys) { const chartContent = apiData[chartKey]; if (typeof chartContent !== 'object' || chartContent === null) continue; const processedChart = Object.keys(chartContent).filter(key => !isNaN(parseInt(key, 10))).map(key => { const planet = chartContent[key]; if (typeof planet !== 'object' || !planet.name) return null; const degree = typeof planet.local_degree === 'number' ? planet.local_degree.toFixed(2) : 'N/A'; return { "Planet": planet.full_name || PLANET_SHORT_NAMES[planet.name as keyof typeof PLANET_SHORT_NAMES] || planet.name, "Sign": planet.zodiac, "House": planet.house, "Degree": degree, "Retrograde": planet.retro || 'No', }; }).filter(p => p); if (processedChart.length > 0) { divisionalData[chartKey] = processedChart; } } return divisionalData; } catch (err) { console.error("CRITICAL PROCESSING ERROR in processDivisionalCharts:", err.message); return {}; } }
function processAspectsTable(apiData: any) { try { const aspectsData = apiData.planetary_aspects; if (!aspectsData || typeof aspectsData !== 'object' || Array.isArray(aspectsData)) { return []; } return Object.values(aspectsData).map((house: any) => { return { "House": house.house, "Sign": house.zodiac, "Aspected By": house.aspected_by_planet.length > 0 ? house.aspected_by_planet.join(', ') : "No aspects" }; }).sort((a, b) => parseInt(a.House, 10) - parseInt(b.House, 10)); } catch (err) { console.error("CRITICAL PROCESSING ERROR in processAspectsTable:", err.message); return [{ "Error": "Failed to process Planetary Aspects table." }]; } }

function processSimpleDoshasTable(apiData: any) {
  // The results array will now have a different structure
  const results: { "Dosha": string; "Status": string; }[] = [];

  try {
    // 1. Current Sade Sati
    if (apiData.current_sade_sati) {
      results.push({
        "Dosha": "Current Sade Sati",
        // The status is the type of period if it's present, otherwise "Not Present"
        "Status": apiData.current_sade_sati.shani_period_type || "Not Present",
      });
    }

    // 2. Mangal Dosh (with the new logic)
    if (apiData.mangal_dosh_details) {
      const fromLagna = apiData.mangal_dosh_details.is_dosha_present_mars_from_lagna || false;
      const fromMoon = apiData.mangal_dosh_details.is_dosha_present_mars_from_moon || false;
      let mangalStatus = "Not Present"; // Default status

      if (fromLagna && fromMoon) {
        mangalStatus = "Present";
      } else if (fromLagna || fromMoon) {
        mangalStatus = "Anshik";
      }

      results.push({
        "Dosha": "Mangal Dosh",
        "Status": mangalStatus,
      });
    }

    // 3. Kaal Sarp Dosh
    if (apiData.kaalsarp_dosh_details) {
      results.push({
        "Dosha": "Kaal Sarp Dosh",
        "Status": apiData.kaalsarp_dosh_details.is_dosha_present ? "Present" : "Not Present",
      });
    }

    // 4. Pitra Dosh
    if (apiData.pitra_dosh_details) {
      results.push({
        "Dosha": "Pitra Dosh",
        "Status": apiData.pitra_dosh_details.is_dosha_present ? "Present" : "Not Present",
      });
    }

    if (results.length === 0) {
      // Return a consistent structure even if data is missing
      return [{ "Dosha": "Dosha data not available", "Status": "-" }];
    }

    return results;

  } catch (err) {
    console.error("CRITICAL PROCESSING ERROR in processSimpleDoshasTable:", err.message);
    return [{ "Dosha": "Error processing Doshas", "Status": "Failed" }];
  }
}

function processJaiminiTable(apiData: any): Map<string, { karak: string; signifier: string }> {
  const jaiminiMap = new Map<string, { karak: string; signifier: string }>();

  // --- NEW: Define the fixed hierarchy and their meanings ---
  // This is our source of truth.
  const KARAKA_HIERARCHY = [
    { role: "Atmakaraka", signifier: "Self" },
    { role: "Amatyakaraka", signifier: "Wealth" },
    { role: "Bhratrukaraka", signifier: "Siblings" },
    { role: "Matrikaraka", signifier: "Mother" },
    { role: "Putrakaraka", signifier: "Children" },
    { role: "Gnatikaraka", signifier: "Relatives" },
    { role: "Darakaraka", signifier: "Spouse" }
  ];

  try {
    const jaiminiData = apiData.jaimini_karakas;
    if (!jaiminiData || typeof jaiminiData !== 'object') {
      console.warn("[Jaimini Data] Jaimini Karakas data not available from API.");
      return jaiminiMap; // Return an empty map
    }

    // --- STEP 1: Extract only the planet and degree from the API data ---
    // We deliberately ignore the 'siginfier' from the API to avoid mismatches.
    const processedPlanets = Object.values(jaiminiData).map((karakaInfo: any) => {
      if (typeof karakaInfo !== 'object' || !karakaInfo || !karakaInfo.planet) {
        return null;
      }
      return {
        // We package the data together so it can't be separated.
        planetName: karakaInfo.planet,
        degree: parseFloat(karakaInfo.local_degree),
      };
    }).filter(p => p !== null && !isNaN(p.degree)) as { planetName: string; degree: number }[];

    // --- STEP 2: Sort the packaged data by degree in descending order ---
    // This establishes the definitive rank of each planet.
    const sortedPlanets = processedPlanets.sort((a, b) => b.degree - a.degree);

    // --- STEP 3: Assign the role AND signifier based on the new, correct rank ---
    sortedPlanets.forEach((planet, index) => {
      // Ensure we don't go beyond the 7 defined Karakas
      if (KARAKA_HIERARCHY[index]) {
        const karakaDefinition = KARAKA_HIERARCHY[index];
        jaiminiMap.set(planet.planetName, {
          karak: karakaDefinition.role,        // Assign role from our hierarchy
          signifier: karakaDefinition.signifier // Assign signifier from our hierarchy
        });
      }
    });

    return jaiminiMap;

  } catch (err) {
    console.error("CRITICAL PROCESSING ERROR in processJaiminiTable (creating map):", err.message);
    return jaiminiMap; // Return an empty map on error
  }
}

function processRemediesTable(apiData: any) { const results: any[] = []; try { if (apiData.gem_suggestion && typeof apiData.gem_suggestion === 'object' && apiData.gem_suggestion.gem) { const gemData = apiData.gem_suggestion; results.push({ "Recommendation": "Recommended Gemstone", "Detail": `${gemData.name} (for ${gemData.planet})` }); } if (apiData.rudraksh_suggestion && typeof apiData.rudraksh_suggestion === 'object' && apiData.rudraksh_suggestion.name) { const rudrakshaData = apiData.rudraksh_suggestion; results.push({ "Recommendation": "Recommended Rudraksha", "Detail": rudrakshaData.name }); } return results; } catch (err) { console.error("CRITICAL PROCESSING ERROR in processRemediesTable:", err.message); return [{ "Error": "Failed to process Remedies table." }]; } }

function processBirthYearTransitsTable(apiData: any, housesTable: any[]) {
  try {
    if (!Array.isArray(housesTable) || housesTable.length === 0) return [];
    const signToHouseMap = new Map<string, number>();
    for (const house of housesTable) {
      signToHouseMap.set(house.Sign, house.House);
    }
    const allTransits: any[] = [];
    for (const planet of PLANETS_TO_FETCH_TRANSITS) {
      const transitKey = `transit_${planet.toLowerCase()}`;
      const transitData = apiData[transitKey];
      if (Array.isArray(transitData)) {
        for (const transit of transitData) {
          allTransits.push({
            planet_name: planet,
            start_date: parseDashaDate(transit.start_date),
            end_date: parseDashaDate(transit.end_date),
            zodiac_sign: transit.zodiac,
            natal_house_affected: signToHouseMap.get(transit.zodiac) || 'N/A',
            is_retrograde: transit.retro || false
          });
        }
      }
    }
    return allTransits;
  } catch (err) {
    console.error("CRITICAL PROCESSING ERROR in processBirthYearTransitsTable:", err.message);
    return [{ "Error": "Failed to process Birth Year Transits table." }];
  }
}

function processFriendshipTable(apiData: any) {
  try {
    // 1. Target the correct nested object from the API response
    const friendshipData = apiData?.planetary_friendship?.five_fold_friendship;

    // 2. Add a robust check to ensure the data exists
    if (!friendshipData || typeof friendshipData !== 'object' || Object.keys(friendshipData).length === 0) {
      console.warn("[Friendship Data] 'five_fold_friendship' table not found in API response.");
      return []; // Return an empty array if data is unavailable
    }

    // 3. Process the object into the clean array format we need
    return Object.entries(friendshipData).map(([planet, relationships]: [string, any]) => {
      if (typeof relationships !== 'object' || !relationships) {
        return { "Planet": planet, "Friends": [], "Enemies": [], "Neutral": [] };
      }

      // 4. Combine relationship categories for simpler logic later
      const friends = [
        ...(Array.isArray(relationships.IntimateFriend) ? relationships.IntimateFriend : []),
        ...(Array.isArray(relationships.Friends) ? relationships.Friends : [])
      ];
      const enemies = [
        ...(Array.isArray(relationships.BitterEnemy) ? relationships.BitterEnemy : []),
        ...(Array.isArray(relationships.Enemies) ? relationships.Enemies : [])
      ];

      return {
        "Planet": planet,
        "Friends": friends,
        "Enemies": enemies,
        "Neutral": Array.isArray(relationships.Neutral) ? relationships.Neutral : []
      };
    });

  } catch (err) {
    console.error("CRITICAL PROCESSING ERROR in processFriendshipTable:", err.message);
    return []; // Return an empty array on any error
  }
}

function processAllTables(chartData: any) {
  try {
    if (!chartData || typeof chartData !== 'object') {
      console.error("CRITICAL: processAllTables received invalid chartData.");
      return {};
    }

    const sarvashtakavargaMap = new Map<string, number>();
    let ashtakavargaTotals: number[] | null = null;
    const ashtakDataObject = chartData.ashtak_data;

    if (ashtakDataObject && typeof ashtakDataObject === 'object') {
      const totalKey = Object.keys(ashtakDataObject).find(key => key.endsWith('_total'));
      if (totalKey && Array.isArray(ashtakDataObject[totalKey])) {
        ashtakavargaTotals = ashtakDataObject[totalKey];
      }
    }

    const ascendantHouse = chartData.houses ? chartData.houses['1'] : null;
    const ascendantSign = ascendantHouse ? ascendantHouse.zodiac : null;

    if (ascendantSign && ashtakavargaTotals && ashtakavargaTotals.length === 12) {
      const ascendantIndex = ZODIAC_ORDER.indexOf(ascendantSign);
      if (ascendantIndex > -1) {
        const dynamicZodiacOrder = [
          ...ZODIAC_ORDER.slice(ascendantIndex),
          ...ZODIAC_ORDER.slice(0, ascendantIndex)
        ];
        dynamicZodiacOrder.forEach((sign, i) => {
          sarvashtakavargaMap.set(sign, ashtakavargaTotals![i]);
        });
        console.log(`[Ashtakavarga SUCCESS] Map successfully generated starting with ${ascendantSign}.`);
      }
    } else {
      console.warn("[Ashtakavarga FAILED] Could not generate map. Ascendant or Totals array was missing/invalid.");
    }

    const planetary_friendship = processFriendshipTable(chartData);
    const yogas = processYogasTable(chartData);
    const vimshottari_dasha = processDashasTable(chartData);
    const divisional_charts = processDivisionalCharts(chartData);
    const doshas = processSimpleDoshasTable(chartData);
    const jaiminiLookupMap = processJaiminiTable(chartData);
    const jaimini_karakas = processJaiminiTable(chartData);
    const remedies = processRemediesTable(chartData);
    const divisional_chart_svgs = processDivisionalChartSvgs(chartData);

    const d1_planets = processD1PlanetsTable(chartData, sarvashtakavargaMap, planetary_friendship, divisional_charts.D9, ascendantSign, jaiminiLookupMap);

    let houses = processHousesTable(chartData, sarvashtakavargaMap);
    const planetary_aspects = processAspectsTable(chartData);
    const aspectMap = new Map<string, string>();

    if (Array.isArray(planetary_aspects)) {
      planetary_aspects.forEach(aspect => {
        if (aspect.House) {
          aspectMap.set(aspect.House.toString(), aspect["Aspected By"]);
        }
      });
    }

    if (Array.isArray(houses)) {
      houses = houses.map(house => {
        const aspectedBy = aspectMap.get(house.House.toString()) || "-";
        return { ...house, "Aspected By": aspectedBy };
      });
    }

    const birth_year_transits = processBirthYearTransitsTable(chartData, houses);

    return {
      d1_planets,
      houses,
      yogas,
      vimshottari_dasha,
      divisional_charts,
      doshas,
      remedies,
      birth_year_transits,
      divisional_chart_svgs,
      planetary_friendship
    };

  } catch (err) {
    console.error("CRITICAL PROCESSING ERROR in processAllTables:", err.message);
    return { "error": "Failed to process astrological tables." };
  }
}


/**
 * Universal Wallet Deduction Helper
 * 1. Fetches user's currency and balance.
 * 2. Looks up the price for the specific service (SKU) in that currency.
 * 3. Deducts the amount if sufficient funds exist.
 */
async function processWalletDeduction(
  supabaseAdmin: any, 
  userId: string, 
  serviceKey: string, 
  quantity: number = 1
) {
  // 1. Get User's Currency & Balance
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('currency_code, wallet_balance')
    .eq('id', userId)
    .single();

  if (userError || !user) throw new Error(`User fetch failed: ${userError?.message}`);
  
  // Default to USD if migration failed
  const currency = user.currency_code || 'USD'; 
  const currentBalance = user.wallet_balance || 0;

  // 2. Get Price for this Service + Currency
  const { data: priceData, error: priceError } = await supabaseAdmin
    .from('service_prices')
    .select('price_amount')
    .eq('service_key', serviceKey)
    .eq('currency_code', currency)
    .single();

  if (priceError || !priceData) {
    // Fallback/Safety: If price is missing, block usage or assume free? 
    // Blocking is safer for business.
    throw new Error(`Price configuration missing for ${serviceKey} in ${currency}`);
  }

  const costPerUnit = priceData.price_amount;
  const totalCost = costPerUnit * quantity;

  // 3. Balance Check
  if (currentBalance < totalCost) {
    return { success: false, error: 'Insufficient funds', required: totalCost, balance: currentBalance };
  }

  // 4. Deduct (Atomic Update is ideal, but straight update is fine for now)
  const newBalance = currentBalance - totalCost;
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ wallet_balance: newBalance })
    .eq('id', userId);

  if (updateError) throw new Error(`Deduction failed: ${updateError.message}`);

  return { success: true, deducted: totalCost, newBalance, currency };
}
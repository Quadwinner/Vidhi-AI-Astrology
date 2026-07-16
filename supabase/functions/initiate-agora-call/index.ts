// --- REVISED WITH YOGAS_LLM AND REAL-TIME TRANSITS ---
// This version uses the curated `yogas_llm` data and adds a call
// for precise, real-time transit data, removing the old generic approach.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// --- HELPER 1: Calculate Age (Unchanged) ---
function calculateAge(dateString: string): number {
  try {
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch { return 0; }
}

// --- HELPER 2: Parse DD/MM/YYYY dates (Unchanged) ---
function parseDmyDate(dateString: string): Date {
  const [day, month, year] = dateString.split('/').map(Number);
  return new Date(year, month - 1, day);
}

interface BirthDetails { dob: string; tob: string; lat: number; lon: number; tz: number; }
function formatBirthDetailsForTransit(details: any): BirthDetails {
  if (!details) {
    throw new Error("Birth details missing — cannot generate transit parameters.");
  }

  // --- Safe date_of_birth handling ---
  const rawDob = details.date_of_birth;
  let dd = "01", mm = "01", yyyy = "2000";

  try {
    if (rawDob) {
      // Handles formats: "YYYY-MM-DD", "YYYY-MM-DDT00:00:00"
      const datePart = rawDob.split("T")[0];     // safe
      const [y, m, d] = datePart.split("-");
      if (y && m && d) {
        yyyy = y;
        mm = m;
        dd = d;
      }
    }
  } catch (e) {
    console.warn("DOB parsing failed, using fallback 01/01/2000");
  }

  // --- Use fixed TOB always for live transits ---
  const tob = "05:30";

  // --- Safe lat/lon/tz (must exist but fallback prevents crash) ---
  const lat = parseFloat(details.birth_lat) || 0;
  const lon = parseFloat(details.birth_lng) || 0;
  const tz = parseFloat(details.timezone_offset) || 5.5;

  return {
    dob: `${dd}/${mm}/${yyyy}`,
    tob,
    lat,
    lon,
    tz
  };
}

async function makeVedicastroRequest(endpoint: string, params: object, desc: string) {
  const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
  if (!apiKey) throw new Error("CRITICAL: VEDICASTRO_API_KEY secret is not set.");
  const VEDICASTRO_API_BASE_URL = "https://api.vedicastroapi.com/v3-json";
  const url = new URL(VEDICASTRO_API_BASE_URL + endpoint);
  const allParams: Record<string, any> = { api_key: apiKey, lang: "en", ...params };
  Object.keys(allParams).forEach(key => url.searchParams.append(key, allParams[key]));
  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) { throw new Error(`External API Error for '${desc}': Status ${response.status} - ${await response.text()}`); }
  const data = await response.json();
  if (!data.response) throw new Error(`External API Error for '${desc}': Response object is missing.`);
  return data.response;
}
async function fetchAndProcessCurrentTransits(birthDetails: BirthDetails, natalHouses: any[]) {
  try {
    if (!Array.isArray(natalHouses) || natalHouses.length === 0) { console.warn("[Transits] Natal houses table not available."); return { table: [] }; }
    const today = new Date();
    const dob = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const transitParams = { dob, tob: '05:30', lat: birthDetails.lat, lon: birthDetails.lon, tz: birthDetails.tz };
    const transitPlanetDetails = await makeVedicastroRequest('/horoscope/planet-details', transitParams, 'Current Transits');
    if (!transitPlanetDetails || typeof transitPlanetDetails !== 'object') { console.warn("[Transits] Failed to fetch valid transit data."); return { table: [] }; }
    const signToHouseMap = new Map<string, number>();
    natalHouses.forEach(house => { if (house.Sign && house.House) { signToHouseMap.set(house.Sign, house.House); } });
    const processedTable = Object.values(transitPlanetDetails).map((planet_data: any) => {
      if (typeof planet_data !== 'object' || !planet_data.full_name) return null;
      const planetSign = planet_data.zodiac;
      const natalHouse = signToHouseMap.get(planetSign) || 'N/A';
      return { "Planet": planet_data.full_name, "Sign": planetSign, "House": natalHouse, "Degree": planet_data.local_degree?.toFixed(2), "Retrograde": planet_data.retro || 'No', "Nakshatra": planet_data.nakshatra };
    }).filter(p => p);
    return { table: processedTable };
  } catch (error) { console.error(`[CRITICAL] Failed to fetch or process current transits: ${error.message}`); return { table: [] }; }
}

// --- Main Handler ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authentication and Setup (Unchanged)
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication failed");

    const { profile_id } = await req.json();
    if (!profile_id) throw new Error("Missing profile_id");

    // 2. Resilient Data Fetching
    const { data: profileRes, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select(`name, user_birth_details(gender, date_of_birth)`)
      .eq('id', profile_id)
      .single();

    if (profileError) throw new Error(`Failed to fetch user profile: ${profileError.message}`);

    // 3. Process Profile Data (Unchanged)
    const profileName = profileRes?.name || 'the user';
    const birthDetails = Array.isArray(profileRes?.user_birth_details) ? profileRes.user_birth_details[0] : profileRes.user_birth_details;
    const gender = birthDetails?.gender || 'not specified';
    const age = birthDetails?.date_of_birth ? calculateAge(birthDetails.date_of_birth) : 0;

    let processedTables = { houses: [] };

    let currentTransitsJson = "{}";
    try {
      const birthDetailsForTransit = formatBirthDetailsForTransit(birthDetails);
      const transitData = await fetchAndProcessCurrentTransits(
        birthDetailsForTransit,
        processedTables?.houses || []
      );
      currentTransitsJson = JSON.stringify(transitData.table || []);
      console.log(`[INFO] Successfully generated real-time transits for profile ${profile_id}.`);
    } catch (e) {
      console.error(`[CRITICAL] Failed to generate real-time transits: ${e.message}`);
    }


    // 5. Robust Astrological Data Handling
    let dashaTimelineString = "Dasha data not available for this profile.";
    let d1PlanetsJson = "{}";
    let housesJson = "{}";
    let birthTransitsJson = "{}";
    let d9ChartJson = "{}";
    let d10ChartJson = "{}";
    // --- MODIFIED: Default yoga string updated for clarity ---
    let yogasJson = "Yoga analysis is not available for this profile.";

    // --- MODIFIED: Query now includes the `yogas_llm` column ---
    const { data: astroData, error: astroError } = await supabaseAdmin
      .from('profile_astro_data')
      .select('processed_tables_path, vimshottari_dasha, yogas_llm') // Added yogas_llm
      .eq('profile_id', profile_id)
      .maybeSingle();

    if (astroError) {
      console.warn(`[WARNING] Could not retrieve astro_data for profile ${profile_id}:`, astroError.message);
    } else if (astroData) {
      console.log(`[INFO] Found astro_data for profile ${profile_id}. Processing...`);

      // Dasha Processing (Unchanged)
      if (astroData.vimshottari_dasha && Array.isArray(astroData.vimshottari_dasha) && astroData.vimshottari_dasha.length > 0) {
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dashaListWithPointer = astroData.vimshottari_dasha.map(period => {
            const newPeriod = { ...period };
            const startDate = parseDmyDate(period["Start Date"]);
            const endDate = parseDmyDate(period["End Date"]);
            if (startDate <= today && today <= endDate) {
              newPeriod.is_current = true;
            }
            return newPeriod;
          });
          dashaTimelineString = JSON.stringify(dashaListWithPointer, null, 2);
        } catch (e) {
          console.error("CRITICAL: Failed to process Dasha timeline and add pointer:", e);
          dashaTimelineString = JSON.stringify(astroData.vimshottari_dasha, null, 2); // Fallback
        }
      }

      // --- NEW LOGIC: Process the `yogas_llm` data ---
      if (astroData.yogas_llm) {
        if (astroData.yogas_llm.yogas && Array.isArray(astroData.yogas_llm.yogas)) {
          yogasJson = JSON.stringify(astroData.yogas_llm, null, 2);
          console.log(`[INFO] Successfully processed 'yogas_llm' data.`);
        } else if (astroData.yogas_llm.status === 'generating') {
          yogasJson = "The detailed yoga analysis is currently being generated. Please check back shortly.";
        } else if (astroData.yogas_llm.status === 'error') {
          yogasJson = "An error occurred during the detailed yoga analysis.";
        }
      }

      // Cherry-pick chart data from Storage
      if (astroData.processed_tables_path) {
        const { data: blob, error: downloadError } = await supabaseAdmin.storage.from('astro-data').download(astroData.processed_tables_path);
        if (downloadError) {
          console.warn(`[WARNING] Failed to download astro_data JSON from storage:`, downloadError.message);
        } else {
          const fullAstroDataJsonString = await blob.text();
          const fullAstroDataObject = JSON.parse(fullAstroDataJsonString);

          d1PlanetsJson = JSON.stringify(fullAstroDataObject.d1_planets || {});
          housesJson = JSON.stringify(fullAstroDataObject.houses || {});
          birthTransitsJson = JSON.stringify(fullAstroDataObject.birth_year_transits || {});
          d9ChartJson = JSON.stringify(fullAstroDataObject.divisional_charts?.D9 || {});
          d10ChartJson = JSON.stringify(fullAstroDataObject.divisional_charts?.D10 || {});
          // --- NEW: Check for Standard API Yogas (Priority) ---
          if (fullAstroDataObject.yogas && Array.isArray(fullAstroDataObject.yogas) && fullAstroDataObject.yogas.length > 0) {
            // Check to ensure it's not an error object
            if (!fullAstroDataObject.yogas[0].Error) {
              // Map keys to be cleaner for the AI context
              yogasJson = JSON.stringify(fullAstroDataObject.yogas.map((y: any) => ({
                name: y["Yoga Name"],
                description: y["Description"]
              })));
              console.log(`[INFO] Overwriting with Standard API Yoga data from storage.`);
            }
          }
        }
      }
    } else {
      console.log(`[INFO] No pre-processed astro_data found for profile ${profile_id}. Proceeding with general prompt.`);
    }

    // 6. Fetch the System Prompt Template (Unchanged)
    const PROMPT_NAME = 'voice_call_default';
    const { data: promptData, error: promptError } = await supabaseAdmin
      .from('system_prompts')
      .select('prompt_text')
      .eq('prompt_name', PROMPT_NAME)
      .eq('is_active', true)
      .single();

    if (promptError || !promptData) {
      throw new Error(`System prompt '${PROMPT_NAME}' could not be loaded. It may be missing or inactive.`);
    }

    // 7. Final Assembly
    // --- MODIFIED: Prompt assembly now uses the new, specific placeholders and data ---
    const systemPrompt = promptData.prompt_text
      .replace('{{CURRENT_DATE}}', new Date().toDateString())
      .replace('{{PROFILE_NAME}}', profileName)
      .replace('{{AGE}}', age > 0 ? age.toString() : 'not specified')
      .replace('{{GENDER}}', gender)
      .replace('{{CURRENT_TRANSITS_JSON}}', currentTransitsJson) // New transit data
      .replace('{{DASHA_TIMELINE}}', dashaTimelineString)
      .replace('{{D1_PLANETS_JSON}}', d1PlanetsJson)
      .replace('{{HOUSES_JSON}}', housesJson)
      .replace('{{BIRTH_TRANSITS_JSON}}', birthTransitsJson)
      .replace('{{D9_CHART_JSON}}', d9ChartJson)
      .replace('{{D10_CHART_JSON}}', d10ChartJson)
      .replace('{{YOGAS_JSON}}', yogasJson); // New, curated yoga data

    console.log(`[INFO] Successfully constructed system prompt for profile ${profile_id}. Length: ${systemPrompt.length}`);

    // 8. Return the required payload (Unchanged)
    return new Response(JSON.stringify({ systemPrompt, gender }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error(`[CRITICAL ERROR] in initiate-agora-call: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
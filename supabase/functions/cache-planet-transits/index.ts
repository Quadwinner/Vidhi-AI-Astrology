// --- FINAL, REFACTORED VERSION ---

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// 1. Import the new wrapper function instead of the old headers object.
import { createCorsWrappedHandler } from '../_shared/cors.ts'

// --- Static Configuration (no changes here) ---
const VEDICASTRO_API_BASE_URL = "https://api.vedicastroapi.com/v3-json";
const LANGUAGE = "en";
const PLANETS_TO_FETCH = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];

// --- Helper: Make Vedicastro API Request (no changes here) ---
async function makeVedicastroRequest(endpoint: string, params: object, desc: string) {
  const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
  if (!apiKey) throw new Error("CRITICAL: VEDICASTRO_API_KEY secret is not set.");
  const url = new URL(VEDICASTRO_API_BASE_URL + endpoint);
  const allParams: Record<string, any> = { api_key: apiKey, lang: LANGUAGE, ...params };
  Object.keys(allParams).forEach(key => url.searchParams.append(key, allParams[key]));

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    throw new Error(`External API Error for '${desc}': Status ${response.status} - ${await response.text()}`);
  }
  const data = await response.json();
  if (data.status !== 200 || !Array.isArray(data.response)) {
      throw new Error(`External API Error for '${desc}': Response object is not an array or status is not 200.`);
  }
  return data.response;
}


// 2. Define your main logic inside a clean handler function.
//    Notice there is no "if (req.method === 'OPTIONS')" or any mention of corsHeaders.
async function handler(req: Request) {
  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { year } = await req.json();
    if (!year || typeof year !== 'number') {
      throw new Error("Missing or invalid 'year' parameter. It must be a number.");
    }
    
    console.log(`[CACHE WARMER START] Starting to fetch transit data for the year ${year}.`);

    const fetchPromises = PLANETS_TO_FETCH.map(planet => 
      makeVedicastroRequest("/panchang/transit-dates", { year: year, planet: planet }, `${planet} Transit`)
        .then(data => ({ planet, transits: data }))
        .catch(err => {
            console.error(`Could not fetch transit for ${planet}: ${err.message}`);
            return { planet, transits: [] };
        })
    );
    const allPlanetTransits = await Promise.all(fetchPromises);

    const dataToInsert = [];
    for (const { planet, transits } of allPlanetTransits) {
        if (transits.length > 0) {
            for (const transit of transits) {
                dataToInsert.push({
                    planet_name: planet,
                    year: year,
                    start_date: new Date(transit.start_date).toLocaleDateString('en-CA'),
                    end_date: new Date(transit.end_date).toLocaleDateString('en-CA'),
                    zodiac_sign: transit.zodiac,
                    is_retrograde: transit.retro || false
                });
            }
        }
    }

    if (dataToInsert.length === 0) {
        throw new Error("No transit data was fetched. Aborting cache update.");
    }

    const { error: deleteError } = await supabaseAdmin.from('global_planet_transits').delete().eq('year', year);
    if (deleteError) {
        throw new Error(`Failed to delete old transit data for year ${year}: ${deleteError.message}`);
    }

    const { error: insertError } = await supabaseAdmin.from('global_planet_transits').insert(dataToInsert);
    if (insertError) {
        throw new Error(`Failed to insert new transit data: ${insertError.message}`);
    }

    const successMessage = `[CACHE WARMER SUCCESS] Successfully cached ${dataToInsert.length} transit records for the year ${year}.`;
    console.log(successMessage);
    
    // The response headers no longer need the corsHeaders.
    return new Response(JSON.stringify({ success: true, message: successMessage }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    // The wrapper will catch this error and create a standardized 500 response.
    console.error(`[CRITICAL CACHE WARMER ERROR] ${err.message}`);
    throw err;
  }
}

// 3. Serve the main handler using the CORS wrapper.
Deno.serve(createCorsWrappedHandler(handler));
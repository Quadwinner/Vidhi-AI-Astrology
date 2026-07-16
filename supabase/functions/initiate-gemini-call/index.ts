// File: supabase/functions/initiate-gemini-call/index.ts
// --- V3.0: MANUAL TOKEN CREATION VIA REST API ---
// This version completely removes the problematic '@google/generative-ai' SDK dependency
// and instead creates the ephemeral token by making a direct REST API call to the
// Google AI endpoint. This bypasses all module resolution issues.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// --- HELPER FUNCTIONS (Unchanged) ---
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

function formatTransitDataIntoString(activeTransits: any[]): string {
    if (!activeTransits || activeTransits.length === 0) {
        return "No active planetary transit data could be found for today.";
    }
    const transitStrings = activeTransits.map(transit => {
        const retroText = transit.is_retrograde ? " (retrograde)" : "";
        return `${transit.planet_name} is in ${transit.zodiac_sign}${retroText}`;
    });
    return `Today's Transits: ${transitStrings.join(', ')}.`;
}

function parseDmyDate(dateString: string): Date {
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
}

function formatDashaTimeline(dashaData: any[] | null): string {
    if (!dashaData || !Array.isArray(dashaData) || dashaData.length === 0) {
        return "Dasha data not available for this profile.";
    }
    try {
        const today = new Date();
        const upcomingPeriods = [];
        for (const period of dashaData) {
            if (!period["End Date"] || !period["Start Date"]) continue;
            const endDate = parseDmyDate(period["End Date"]);
            if (endDate >= today) {
                const startDate = parseDmyDate(period["Start Date"]);
                const startDateStr = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                const endDateStr = endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                upcomingPeriods.push(
                  `- MD: ${period["Mahadasha Lord"]}, AD: ${period["Antardasha Lord"]} (${startDateStr} - ${endDateStr})`
                );
            }
        }
        if (upcomingPeriods.length === 0) return "No upcoming dasha periods found.";
        return `Upcoming Dasha Periods:\n${upcomingPeriods.slice(0, 10).join('\n')}`;
    } catch (e) {
        console.error("Failed to format dasha periods:", e);
        return "Dasha data appears to be corrupted for this profile.";
    }
}

// --- MAIN HANDLER ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- STEP 1: GENERATE GEMINI API EPHEMERAL TOKEN (MANUALLY) ---
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Server configuration error: GEMINI_API_KEY is not set.");
    }

    const tokenEndpoint = 'https://generativelanguage.googleapis.com/v1alpha/authTokens';

    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        // Sending an empty config uses the default expirations
        // (1 minute to start session, 30 minutes for session duration)
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      throw new Error(`Failed to create ephemeral token: ${tokenResponse.status} ${errorBody}`);
    }

    const tokenData = await tokenResponse.json();
    const ephemeralToken = tokenData.name; // The token is in the 'name' field

    // --- STEP 2: BUILD THE SYSTEM PROMPT (Unchanged) ---
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication failed");

    const { profile_id } = await req.json();
    if (!profile_id) throw new Error("Missing profile_id");

    const todayStr = new Date().toISOString().split('T')[0];
    const promises = [
        supabaseAdmin.from('user_profiles').select(`name, user_birth_details(gender, date_of_birth)`).eq('id', profile_id).single(),
        supabaseAdmin.from('global_planet_transits').select('planet_name, zodiac_sign, is_retrograde').lte('start_date', todayStr).gte('end_date', todayStr),
        supabaseAdmin.storage.from('rulebook').download('short_vedic_rulebook.json')
    ];
    const [profileRes, transitRes, rulebookRes] = await Promise.allSettled(promises);
    
    if (profileRes.status === 'rejected') throw new Error(`Failed to fetch user profile: ${profileRes.reason.message}`);
    const profileData = profileRes.value.data;
    const profileName = profileData?.name || 'the user';
    const birthDetails = Array.isArray(profileData?.user_birth_details) ? profileData.user_birth_details[0] : profileData.user_birth_details;
    const gender = birthDetails?.gender || 'not specified';
    const age = birthDetails?.date_of_birth ? calculateAge(birthDetails.date_of_birth) : 0;
    const transitData = transitRes.status === 'fulfilled' ? transitRes.value.data : [];
    const transitString = formatTransitDataIntoString(transitData);
    let astrologyRulebookJsonString = "{}";
    if (rulebookRes.status === 'fulfilled') {
      const { data: blob, error: downloadError } = rulebookRes.value;
      if (!downloadError) astrologyRulebookJsonString = await blob.text();
    }
    let fullAstroDataJsonString = "{}";
    let dashaTimelineString = "Dasha data not available for this profile.";
    const { data: astroData, error: astroError } = await supabaseAdmin
        .from('profile_astro_data')
        .select('processed_tables_path, vimshottari_dasha')
        .eq('profile_id', profile_id)
        .maybeSingle();

    if (!astroError && astroData) {
        if (astroData.vimshottari_dasha) {
            dashaTimelineString = formatDashaTimeline(astroData.vimshottari_dasha);
        }
        if (astroData.processed_tables_path) {
            const { data: blob, error: downloadError } = await supabaseAdmin.storage.from('astro-data').download(astroData.processed_tables_path);
            if (!downloadError) {
                fullAstroDataJsonString = await blob.text();
            }
        }
    }

    const PROMPT_NAME = 'voice_call_default';
    const { data: promptData, error: promptError } = await supabaseAdmin
      .from('system_prompts')
      .select('prompt_text')
      .eq('prompt_name', PROMPT_NAME)
      .eq('is_active', true)
      .single();

    if (promptError || !promptData) {
      throw new Error(`System prompt '${PROMPT_NAME}' could not be loaded.`);
    }

    const systemPrompt = promptData.prompt_text
        .replace('{{ASTROLOGY_RULEBOOK_JSON}}', astrologyRulebookJsonString)
        .replace('{{CURRENT_DATE}}', new Date().toDateString())
        .replace('{{PROFILE_NAME}}', profileName)
        .replace('{{AGE}}', age > 0 ? age.toString() : 'not specified')
        .replace('{{GENDER}}', gender)
        .replace('{{TRANSIT_STRING}}', transitString)
        .replace('{{FULL_ASTRO_JSON}}', fullAstroDataJsonString)
        .replace('{{DASHA_TIMELINE}}', dashaTimelineString);
    
    // --- STEP 3: RETURN THE PAYLOAD FOR THE CLIENT ---
    return new Response(JSON.stringify({ 
      systemPrompt, 
      token: ephemeralToken,
      gender 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error(`[CRITICAL ERROR] in initiate-gemini-call: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
// File: supabase/functions/create-ultravox-call/index.ts
// Creates an Ultravox voice call and returns a joinUrl for the client SDK.
// Builds a dynamic astrology system prompt from the profile's data (mirrors
// the Agora/Gemini call functions) and passes it inline to Ultravox.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ULTRAVOX_API_URL = 'https://api.ultravox.ai/api/calls';

function calculateAge(dateString: string): number {
  try {
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  } catch { return 0; }
}

function parseDmyDate(dateString: string): Date {
  const [day, month, year] = dateString.split('/').map(Number);
  return new Date(year, month - 1, day);
}

async function makeVedicastroRequest(endpoint: string, params: object, desc: string) {
  const apiKey = Deno.env.get('VEDICASTRO_API_KEY');
  if (!apiKey) throw new Error('VEDICASTRO_API_KEY secret is not set.');
  const base = 'https://api.vedicastroapi.com/v3-json';
  const url = new URL(base + endpoint);
  const allParams: Record<string, any> = { api_key: apiKey, lang: 'en', ...params };
  Object.keys(allParams).forEach((k) => url.searchParams.append(k, allParams[k]));
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`VedicAstro '${desc}' failed: ${res.status}`);
  const data = await res.json();
  if (!data.response) throw new Error(`VedicAstro '${desc}': missing response`);
  return data.response;
}

async function fetchCurrentTransits(birth: { lat: number; lon: number; tz: number }, natalHouses: any[]) {
  try {
    if (!Array.isArray(natalHouses) || natalHouses.length === 0) return [];
    const today = new Date();
    const dob = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const details = await makeVedicastroRequest('/horoscope/planet-details', { dob, tob: '05:30', lat: birth.lat, lon: birth.lon, tz: birth.tz }, 'Current Transits');
    if (!details || typeof details !== 'object') return [];
    const signToHouse = new Map<string, number>();
    natalHouses.forEach((h) => { if (h.Sign && h.House) signToHouse.set(h.Sign, h.House); });
    return Object.values(details).map((p: any) => {
      if (typeof p !== 'object' || !p.full_name) return null;
      return { Planet: p.full_name, Sign: p.zodiac, House: signToHouse.get(p.zodiac) || 'N/A', Degree: p.local_degree?.toFixed(2), Retrograde: p.retro || 'No', Nakshatra: p.nakshatra };
    }).filter(Boolean);
  } catch (e) {
    console.error(`[create-ultravox-call] transits failed: ${(e as Error).message}`);
    return [];
  }
}

async function buildSystemPrompt(supabaseAdmin: any, profile_id: string): Promise<{ systemPrompt: string; gender: string }> {
  const { data: profileRes, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('name, user_birth_details(gender, date_of_birth, birth_lat, birth_lng, timezone_offset)')
    .eq('id', profile_id)
    .single();
  if (profileError) throw new Error(`Failed to fetch profile: ${profileError.message}`);

  const profileName = profileRes?.name || 'the user';
  const birth = Array.isArray(profileRes?.user_birth_details) ? profileRes.user_birth_details[0] : profileRes?.user_birth_details;
  const gender = birth?.gender || 'not specified';
  const age = birth?.date_of_birth ? calculateAge(birth.date_of_birth) : 0;

  let dashaTimelineString = 'Dasha data not available for this profile.';
  let d1PlanetsJson = '{}', housesJson = '{}', birthTransitsJson = '{}', d9ChartJson = '{}', d10ChartJson = '{}';
  let yogasJson = 'Yoga analysis is not available for this profile.';
  let fullAstroJson = '{}';
  let housesArr: any[] = [];

  const { data: astroData } = await supabaseAdmin
    .from('profile_astro_data')
    .select('processed_tables_path, vimshottari_dasha, yogas_llm')
    .eq('profile_id', profile_id)
    .maybeSingle();

  if (astroData) {
    if (Array.isArray(astroData.vimshottari_dasha) && astroData.vimshottari_dasha.length > 0) {
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const withPointer = astroData.vimshottari_dasha.map((p: any) => {
          const np = { ...p };
          const s = parseDmyDate(p['Start Date']); const e = parseDmyDate(p['End Date']);
          if (s <= today && today <= e) np.is_current = true;
          return np;
        });
        dashaTimelineString = JSON.stringify(withPointer, null, 2);
      } catch { dashaTimelineString = JSON.stringify(astroData.vimshottari_dasha, null, 2); }
    }
    if (astroData.yogas_llm?.yogas && Array.isArray(astroData.yogas_llm.yogas)) {
      yogasJson = JSON.stringify(astroData.yogas_llm, null, 2);
    }
    if (astroData.processed_tables_path) {
      const { data: blob, error: dErr } = await supabaseAdmin.storage.from('astro-data').download(astroData.processed_tables_path);
      if (!dErr && blob) {
        try {
          const fullText = await blob.text();
          fullAstroJson = fullText;
          const full = JSON.parse(fullText);
          d1PlanetsJson = JSON.stringify(full.d1_planets || {});
          housesJson = JSON.stringify(full.houses || {});
          housesArr = Array.isArray(full.houses) ? full.houses : [];
          birthTransitsJson = JSON.stringify(full.birth_year_transits || {});
          d9ChartJson = JSON.stringify(full.divisional_charts?.D9 || {});
          d10ChartJson = JSON.stringify(full.divisional_charts?.D10 || {});
          if (Array.isArray(full.yogas) && full.yogas.length > 0 && !full.yogas[0].Error) {
            yogasJson = JSON.stringify(full.yogas.map((y: any) => ({ name: y['Yoga Name'], description: y['Description'] })));
          }
        } catch (e) { console.warn(`[create-ultravox-call] astro json parse failed: ${(e as Error).message}`); }
      }
    }
  }

  let currentTransitsJson = '[]';
  try {
    const lat = parseFloat(birth?.birth_lat) || 0;
    const lon = parseFloat(birth?.birth_lng) || 0;
    const tz = parseFloat(birth?.timezone_offset) || 5.5;
    currentTransitsJson = JSON.stringify(await fetchCurrentTransits({ lat, lon, tz }, housesArr));
  } catch (e) { console.error(`[create-ultravox-call] transit block failed: ${(e as Error).message}`); }

  const { data: promptData, error: promptError } = await supabaseAdmin
    .from('system_prompts')
    .select('prompt_text')
    .eq('prompt_name', 'voice_call_default')
    .eq('is_active', true)
    .single();
  if (promptError || !promptData) throw new Error("System prompt 'voice_call_default' could not be loaded.");

  // Raw fields — used both to assemble an inline prompt AND as templateContext
  // (mustache variables) when creating a call against a configured agent.
  const context: Record<string, string> = {
    CURRENT_DATE: new Date().toDateString(),
    PROFILE_NAME: profileName,
    AGE: age > 0 ? age.toString() : 'not specified',
    GENDER: gender,
    CURRENT_TRANSITS_JSON: currentTransitsJson,
    DASHA_TIMELINE: dashaTimelineString,
    D1_PLANETS_JSON: d1PlanetsJson,
    HOUSES_JSON: housesJson,
    BIRTH_TRANSITS_JSON: birthTransitsJson,
    D9_CHART_JSON: d9ChartJson,
    D10_CHART_JSON: d10ChartJson,
    YOGAS_JSON: yogasJson,
    // Full processed chart blob — common single-variable name used by agent templates.
    FULL_ASTRO_JSON: fullAstroJson,
    ASTRO_DATA: fullAstroJson,
  };

  let systemPrompt = promptData.prompt_text;
  for (const [key, value] of Object.entries(context)) {
    systemPrompt = systemPrompt.split(`{{${key}}}`).join(value);
  }

  return { systemPrompt, gender, context };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ULTRAVOX_API_KEY = Deno.env.get('ULTRAVOX_API_KEY');
    if (!ULTRAVOX_API_KEY) throw new Error('ULTRAVOX_API_KEY secret is not set on the server.');

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authentication failed: missing Authorization header');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication failed');

    const { profile_id, voice } = await req.json();
    if (!profile_id) throw new Error('Missing profile_id');

    let { systemPrompt } = await buildSystemPrompt(supabaseAdmin, profile_id);

    // The selected voice is MALE, so the astrologer must speak about itself using
    // masculine Hindi verb forms. Without this, the LLM often drifts into feminine
    // forms ("सुन रही हूं", "बताती हूं") which clashes with the male voice.
    // This is appended last so it takes precedence over the DB-stored prompt.
    systemPrompt += `\n\n# आवाज़ और लिंग (अत्यंत महत्वपूर्ण):\n` +
      `आप एक पुरुष ज्योतिषी हैं और आपकी आवाज़ पुरुष की है। ` +
      `अपने बारे में बात करते समय हमेशा पुल्लिंग (पुरुषवाचक) क्रिया रूपों का ही प्रयोग करें। ` +
      `सही: "मैं सुन रहा हूं", "मैं बताता हूं", "मैंने देखा", "मैं आपकी कुंडली का विश्लेषण कर चुका हूं", "मैं समझाता हूं"। ` +
      `गलत (कभी प्रयोग न करें): "सुन रही हूं", "बताती हूं", "देखी", "कर चुकी हूं", "समझाती हूं"। ` +
      `हर वाक्य में इस नियम का कड़ाई से पालन करें।`;

    // Reuse the same Hindi voice the "shubham" agent used, so audio is identical.
    // Override via the ULTRAVOX_VOICE_ID secret or request `voice` if desired.
    const voiceId = voice || Deno.env.get('ULTRAVOX_VOICE_ID') || '04c88e17-9267-4e4f-9708-40dfe73b79b4';

    // Direct call endpoint: gives full control over language + turn detection,
    // which the agent endpoint does not allow.
    const callBody: Record<string, any> = {
      systemPrompt,
      voice: voiceId,
      temperature: 0.3,
      languageHint: 'hi',
      firstSpeakerSettings: { agent: {} },
      medium: { webRtc: {} },
      // Turn detection tuned so full questions (with natural pauses) are captured
      // before the agent responds, and brief noises don't interrupt it.
      vadSettings: {
        turnEndpointDelay: '1.2s',
        minimumTurnDuration: '0s',
        minimumInterruptionDuration: '0.9s',
      },
      // Without this, the session ends within seconds of the intro if the user is
      // quiet (or their speech isn't recognized). Instead, re-prompt in Hindi a few
      // times and only hang up after ~75s of continuous silence.
      inactivityMessages: [
        { duration: '30s', message: 'क्या आप वहाँ हैं? आप किस विषय में जानना चाहते हैं?' },
        { duration: '30s', message: 'अगर आपका कोई सवाल हो तो बेझिझक पूछिए।' },
        { duration: '15s', message: 'ठीक है, मैं अभी कॉल समाप्त कर रहा हूँ। जब चाहें फिर से कॉल करें। धन्यवाद!', endBehavior: 'END_BEHAVIOR_HANG_UP_SOFT' },
      ],
      maxDuration: '1800s',
      recordingEnabled: false,
    };

    const uvRes = await fetch(ULTRAVOX_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': ULTRAVOX_API_KEY },
      body: JSON.stringify(callBody),
    });

    if (!uvRes.ok) {
      const text = await uvRes.text();
      console.error(`[create-ultravox-call] Ultravox API error ${uvRes.status}: ${text}`);
      throw new Error(`Ultravox API error: ${uvRes.status} ${text}`);
    }

    const uvData = await uvRes.json();
    if (!uvData.joinUrl) throw new Error('Ultravox did not return a joinUrl.');

    return new Response(JSON.stringify({ joinUrl: uvData.joinUrl, callId: uvData.callId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error(`[CRITICAL ERROR] in create-ultravox-call: ${(err as Error).message}`);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

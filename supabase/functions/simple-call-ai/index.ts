// Simple Call AI - Voice calls with full astro data (like get-chat-answer)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

// Helper to calculate age
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
  } catch {
    return 0;
  }
}

// Helper to format transit data
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

// Helper to parse DD/MM/YYYY dates
function parseDmyDate(dateString: string): Date {
  const [day, month, year] = dateString.split('/').map(Number);
  return new Date(year, month - 1, day);
}

// Helper to format dasha timeline
function formatDashaTimeline(dashaJsonString: string | null | any, clientDate: string): string {
  if (!dashaJsonString) {
    return "Dasha data not available.";
  }

  let dashaPeriods: any[];
  try {
    // Check if it's already an object (not a string)
    if (typeof dashaJsonString === 'object') {
      dashaPeriods = dashaJsonString;
    } else if (typeof dashaJsonString === 'string') {
      dashaPeriods = JSON.parse(dashaJsonString);
    } else {
      console.error("[simple-call-ai] Unexpected dasha data type:", typeof dashaJsonString);
      return "Dasha data format is unexpected.";
    }
  } catch (e) {
    console.error("[simple-call-ai] Failed to parse vimshottari_dasha:", e, "Data:", dashaJsonString?.substring?.(0, 200));
    return "Unable to read dasha data format.";
  }

  if (!Array.isArray(dashaPeriods)) {
    console.error("[simple-call-ai] Dasha data is not an array:", typeof dashaPeriods);
    return "Dasha data structure is invalid.";
  }

  const today = new Date(clientDate);
  const upcomingPeriods = [];

  for (const period of dashaPeriods) {
    try {
      if (!period["End Date"] || !period["Start Date"]) {
        continue; // Skip periods without dates
      }

      const endDate = parseDmyDate(period["End Date"]);
      if (endDate >= today) {
        const startDate = parseDmyDate(period["Start Date"]);
        const startDateStr = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const endDateStr = endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        upcomingPeriods.push(
          `- MD: ${period["Mahadasha Lord"]}, AD: ${period["Antardasha Lord"]} (${startDateStr} - ${endDateStr})`
        );
      }
    } catch (e) {
      console.warn("[simple-call-ai] Skipping invalid dasha period:", period, e);
      continue; // Skip this period and continue with next
    }
  }

  if (upcomingPeriods.length === 0) {
    return "No upcoming dasha periods found.";
  }

  const timelineSnippet = upcomingPeriods.slice(0, 5).join('\n');
  return `Upcoming Dasha Periods:\n${timelineSnippet}`;
}

async function handler(req: Request) {
  try {
    console.log('[simple-call-ai] Function called');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const requestBody = await req.json();
    const profile_id = requestBody.profile_id;
    const user_message = requestBody.user_message;

    if (!profile_id || !user_message) {
      throw new Error('Missing profile_id or user_message');
    }

    console.log('[simple-call-ai] Request:', { profile_id, user_message });

    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication failed: User not found');

    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch all data in parallel (like get-chat-answer)
    const [profileRes, astroRes, transitRes, rulebookRes] = await Promise.allSettled([
      supabaseAdmin
        .from('user_profiles')
        .select('name, user_birth_details(gender, date_of_birth)')
        .eq('id', profile_id)
        .single(),
      supabaseAdmin
        .from('profile_astro_data')
        .select('processed_tables_path, vimshottari_dasha')
        .eq('profile_id', profile_id)
        .single(),
      supabaseAdmin
        .from('global_planet_transits')
        .select('planet_name, zodiac_sign, is_retrograde')
        .lte('start_date', todayStr)
        .gte('end_date', todayStr),
      supabaseAdmin.storage
        .from('rulebook')
        .download('short_vedic_rulebook.json')
    ]);

    console.log("[simple-call-ai] All data fetched");

    // Process profile data
    if (profileRes.status === 'rejected') {
      throw new Error(`Failed to fetch profile: ${profileRes.reason.message}`);
    }
    const profileData = profileRes.value.data;
    const profileName = profileData?.name || 'the user';
    const birthDetails = Array.isArray(profileData?.user_birth_details)
      ? profileData.user_birth_details[0]
      : profileData.user_birth_details;
    const gender = birthDetails?.gender || 'not specified';
    const age = birthDetails?.date_of_birth ? calculateAge(birthDetails.date_of_birth) : 0;

    // Process astro data
    if (astroRes.status === 'rejected') {
      console.error('[simple-call-ai] Astro data fetch failed:', astroRes.reason);
      throw new Error(`Failed to fetch astro data: ${astroRes.reason.message}`);
    }
    const astroData = astroRes.value.data;
    console.log('[simple-call-ai] Astro data:', {
      has_data: !!astroData,
      has_path: !!astroData?.processed_tables_path,
      has_dasha: !!astroData?.vimshottari_dasha,
      dasha_type: typeof astroData?.vimshottari_dasha,
      dasha_preview: typeof astroData?.vimshottari_dasha === 'string'
        ? astroData?.vimshottari_dasha?.substring(0, 100)
        : JSON.stringify(astroData?.vimshottari_dasha)?.substring(0, 100)
    });

    let fullAstroDataJsonString = "{}";
    if (astroData?.processed_tables_path) {
      console.log('[simple-call-ai] Downloading from storage:', astroData.processed_tables_path);
      const { data: blob, error: downloadError } = await supabaseAdmin.storage
        .from('astro-data')
        .download(astroData.processed_tables_path);
      if (downloadError) {
        console.error('[simple-call-ai] Storage download error:', downloadError);
      } else if (blob) {
        fullAstroDataJsonString = await blob.text();
        console.log('[simple-call-ai] Astro data loaded, size:', fullAstroDataJsonString.length, 'chars');
      }
    } else {
      console.warn('[simple-call-ai] No processed_tables_path found for profile');
    }

    // Process transit data
    const transitData = transitRes.status === 'fulfilled' ? transitRes.value.data : [];
    const transitString = formatTransitDataIntoString(transitData);

    // Process rulebook
    let astrologyRulebookJsonString = "{}";
    if (rulebookRes.status === 'fulfilled' && rulebookRes.value.data) {
      astrologyRulebookJsonString = await rulebookRes.value.data.text();
    }

    // Format dasha timeline
    const dashaTimelineString = formatDashaTimeline(astroData?.vimshottari_dasha, todayStr);
    console.log('[simple-call-ai] Dasha timeline:', dashaTimelineString.substring(0, 200));

    // Fetch system prompt from database (like get-chat-answer does)
    const PROMPT_NAME = 'voice_call_conversation';
    const { data: promptData, error: promptError } = await supabaseAdmin
      .from('system_prompts')
      .select('prompt_text, model_name, secret_name')
      .eq('prompt_name', PROMPT_NAME)
      .eq('is_active', true)
      .maybeSingle();

    let systemPrompt: string;
    let modelName: string;
    let apiKeyName: string;

    if (promptError || !promptData) {
      console.warn(`[simple-call-ai] Prompt '${PROMPT_NAME}' not found, using fallback`);
      // Fallback prompt for voice calls
      systemPrompt = `आप एक वैदिक ज्योतिषी हैं जो वॉयस कॉल पर बात कर रहे हैं।

व्यक्ति: ${profileName}, ${gender}, ${age > 0 ? age + ' वर्ष' : ''}
आज की तारीख: ${todayStr}

${transitString}

${dashaTimelineString}

निर्देश:
1. केवल 2-3 छोटे वाक्य दें
2. सीधा और संक्षिप्त जवाब दें
3. प्राकृतिक बातचीत जैसा लगे
4. ऊपर दिए गए दशा और ट्रांजिट डेटा का उपयोग करें
5. विशिष्ट ग्रह, राशि, दशा का उल्लेख करें

याद रखें: यह असली बातचीत है, लंबा भाषण नहीं।`;
      modelName = 'gemini-2.0-flash-exp';
      apiKeyName = 'GEMINI_API_KEY';
    } else {
      console.log(`[simple-call-ai] Using database prompt: ${PROMPT_NAME}`);
      // Use prompt from database and replace placeholders
      systemPrompt = promptData.prompt_text
        .replace('{{PROFILE_NAME}}', profileName)
        .replace('{{GENDER}}', gender)
        .replace('{{AGE}}', age > 0 ? age.toString() : 'not specified')
        .replace('{{CURRENT_DATE}}', todayStr)
        .replace('{{TRANSIT_STRING}}', transitString)
        .replace('{{DASHA_TIMELINE}}', dashaTimelineString);

      modelName = promptData.model_name || 'gemini-2.0-flash-exp';
      apiKeyName = promptData.secret_name || 'GEMINI_API_KEY';
    }

    console.log(`[simple-call-ai] Prompt constructed. Length: ${systemPrompt.length} chars, Model: ${modelName}`);

    // Call Gemini API with configured model
    const apiKey = Deno.env.get(apiKeyName);
    if (!apiKey) {
      throw new Error(`API key '${apiKeyName}' is not set`);
    }

    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    console.log('[simple-call-ai] Calling Gemini API with model:', modelName);

    const response = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: user_message }]
        }],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 150,
          candidateCount: 1
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      })
    });

    console.log('[simple-call-ai] Gemini response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[simple-call-ai] Gemini API error:', errorBody);
      throw new Error(`Gemini API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    console.log('[simple-call-ai] Gemini response received');

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!aiResponse) {
      throw new Error('Empty response from Gemini API');
    }

    console.log('[simple-call-ai] AI response length:', aiResponse.length);
    console.log('[simple-call-ai] AI response preview:', aiResponse.substring(0, 100));

    return new Response(
      JSON.stringify({ response: aiResponse }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('[CRITICAL ERROR] in simple-call-ai:', error.message, error.stack);

    return new Response(
      JSON.stringify({
        error: error.message || 'An unexpected error occurred',
        response: 'माफ़ कीजिए, मुझे तकनीकी समस्या का सामना करना पड़ रहा है। कृपया दोबारा प्रयास करें।'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
}

Deno.serve(createCorsWrappedHandler(handler));

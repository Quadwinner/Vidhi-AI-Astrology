import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

console.log("Loading 'custom-tts-proxy' function for F5-Hindi TTS...");

async function handler(req: Request) {

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    // Optional: allow anon key from browser; verify pattern if needed
    const authHeader = req.headers.get('Authorization');

    const requestBody = await req.json();
    const text = requestBody.text || requestBody.input;
    if (!text) {
      return new Response(JSON.stringify({ error: "Missing 'text' or 'input' parameter" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[custom-tts-proxy] Function called`, { text_length: text.length, text_preview: text.substring(0, 100) });

          // Prefer env; fallback to ngrok for reliability per user request
          const f5TtsUrl = Deno.env.get('F5_HINDI_TTS_URL') || 'https://octavia-unrigorous-unnimbly.ngrok-free.dev/tts';
    // Increased timeout for longer text - F5-TTS on GPU can take 30-50 seconds for 500+ chars
    const timeoutMs = 60000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const ttsResponse = await fetch(f5TtsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Supabase-Edge-Function' },
      body: JSON.stringify({ text, format: 'wav', sample_rate: 24000, speed: 1.0 }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!ttsResponse.ok) {
      const errorBody = await ttsResponse.text();
      console.error(`[custom-tts-proxy] F5-Hindi TTS API Error`, { status: ttsResponse.status, error: errorBody });
      return new Response(JSON.stringify({ error: `F5-Hindi TTS API error: ${ttsResponse.status} - ${errorBody}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    return new Response(audioBuffer, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'audio/wav', 'Content-Length': audioBuffer.byteLength.toString() } });

  } catch (error: any) {
    console.error(`[CRITICAL ERROR] in custom-tts-proxy: ${error.message}`, { error: error.message, stack: error.stack });
    if (error.name === 'AbortError') {
      return new Response(JSON.stringify({ error: 'F5-Hindi TTS timeout - server took too long to respond' }), { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

Deno.serve(createCorsWrappedHandler(handler));

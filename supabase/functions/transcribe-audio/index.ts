// --- FINAL, REFACTORED VERSION ---

// 1. Import the new wrapper function.
import { createCorsWrappedHandler, corsHeaders } from '../_shared/cors.ts'

// Helper functions for standardized error handling
function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function getOrigin(req: Request): string {
  const fh = req.headers.get('x-forwarded-host');
  const fp = req.headers.get('x-forwarded-proto') || 'https';
  return fh ? `${fp}://${fh}` : new URL(req.url).origin;
}

function ok(data: any): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function err(msg: string): Response {
  return ok({ error: msg });
}

// 2. Define your main logic inside a clean handler function.
async function handler(req: Request) {
  try {
    // Environment validation
    const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');
    const origin = getOrigin(req);
    // Structured logging
    console.log(`[transcribe-audio] Function called`, {
      function_name: 'transcribe-audio',
      origin: origin
    });

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return err("No audio file found in the request.");
    }

    console.log(`[transcribe-audio] Processing audio file`, {
      function_name: 'transcribe-audio',
      file_name: audioFile.name,
      file_size: audioFile.size,
      file_type: audioFile.type
    });

    const openAIFormData = new FormData();
    openAIFormData.append('file', audioFile);
    openAIFormData.append('model', 'whisper-1');
    openAIFormData.append('language', 'hi'); // Force Hindi language to get Devanagari script
    openAIFormData.append('temperature', '0.0'); // Most deterministic for consistent results
    openAIFormData.append('response_format', 'json'); // Ensure JSON response

    // Comprehensive Hindi astrology vocabulary with common phrases for better recognition
    const hindiVocab = [
      // Key astrology terms
      'करियर', 'शादी', 'विवाह', 'ज्योतिष', 'कुंडली', 'ग्रह', 'राशि', 'भविष्य', 'सलाह', 'सुझाव',
      // Planets
      'सूर्य', 'चंद्रमा', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'राहु', 'केतु',
      // Zodiac signs
      'मेष', 'वृष', 'मिथुन', 'कर्क', 'सिंह', 'कन्या', 'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुंभ', 'मीन',
      // Life aspects
      'भाग्य', 'धन', 'स्वास्थ्य', 'पारिवारिक', 'प्रेम', 'व्यापार', 'नौकरी', 'शिक्षा', 'संतान',
      // Common question words
      'बारे में', 'के बारे में', 'क्या', 'कैसे', 'कब', 'कहाँ', 'क्यों',
      // Context words
      'बताइए', 'बताएं', 'जानना', 'पूछना', 'समझना', 'मदद'
    ];
    
    // Use phrases for better context
    openAIFormData.append('prompt', hindiVocab.join(', ') + '. करियर के बारे में बताइए। शादी के बारे में क्या है? ज्योतिष कुंडली देखें।');

    const whisperUrl = 'https://api.openai.com/v1/audio/transcriptions';

    const response = await fetch(whisperUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: openAIFormData,
    });
    
    if (!response.ok) {
        const errorBody = await response.json();
        console.error(`[transcribe-audio] OpenAI API Error`, {
          function_name: 'transcribe-audio',
          status: response.status,
          error: errorBody.error?.message
        });
        return err(errorBody.error?.message || 'OpenAI API error occurred');
    }

    const result = await response.json();

    // Clean up transcription for better accuracy
    let cleanedText = result.text || '';
    
    // Remove extra whitespace and normalize
    cleanedText = cleanedText.trim().replace(/\s+/g, ' ');
    
    // Fix common Hindi transcription errors with comprehensive corrections
    const corrections: { [key: string]: string } = {
      // Common phrase corrections - "बारे में" is often heard as "बादे"
      'करियर के बादे के': 'करियर के बारे में',
      'शादी के बादे के': 'शादी के बारे में',
      'ज्योतिष के बादे के': 'ज्योतिष के बारे में',
      'करियर बादे': 'करियर के बारे',
      'शादी बादे': 'शादी के बारे',
      'ज्योतिष बादे': 'ज्योतिष के बारे',
      'करियर के बादे में': 'करियर के बारे में',
      'शादी के बादे में': 'शादी के बारे में',
      'ज्योतिष के बादे में': 'ज्योतिष के बारे में',
      'करियर के बादे': 'करियर के बारे में',
      'शादी के बादे': 'शादी के बारे में',
      'ज्योतिष के बादे': 'ज्योतिष के बारे में',
      
      // Common word mispronunciations and phonetic errors
      'सह दीगो': 'शादी',
      'सादीगो': 'शादी',
      'जयतिया': 'ज्योतिष',
      'जयोतिष': 'ज्योतिष',
      'जोतिष': 'ज्योतिष',
      'जयरिय के लिए': 'करियर',
      'जयरिय': 'करियर',
      'करिअर': 'करियर',
      'करीअर': 'करियर',
      'करीयर': 'करियर',
      'जयतिष': 'ज्योतिष',
      'सादी': 'शादी',
      'शाड़ी': 'शादी',
      'साड़ी': 'शादी',
      
      // Missing "में" at the end
      'करियर के बारे': 'करियर के बारे में',
      'शादी के बारे': 'शादी के बारे में',
      'ज्योतिष के बारे': 'ज्योतिष के बारे में',
      'भविष्य के बारे': 'भविष्य के बारे में',
      'प्रेम के बारे': 'प्रेम के बारे में',
      
      // Common astrology terms often misheard
      'कुंडली के बादे': 'कुंडली के बारे में',
      'कुंडली के बारे': 'कुंडली के बारे में',
      'ग्रह के बारे': 'ग्रह के बारे में',
      'राशि के बारे': 'राशि के बारे में'
    };
    
    for (const [wrong, correct] of Object.entries(corrections)) {
      cleanedText = cleanedText.replace(new RegExp(wrong, 'g'), correct);
    }
    
    // Additional fuzzy matching for common Hindi words with more variations
    const fuzzyCorrections = [
      // Career variations
      { pattern: /करियर|करिअर|करीअर|करीयर|जयरिय|करिएर/gi, replacement: 'करियर' },
      // Marriage variations  
      { pattern: /शादी|सादी|शाड़ी|साड़ी|सह दीगो|सादीगो/gi, replacement: 'शादी' },
      // Astrology variations
      { pattern: /ज्योतिष|जयतिष|जयोतिष|जोतिष|जयतिया/gi, replacement: 'ज्योतिष' },
      // About variations
      { pattern: /बारे|बादे/gi, replacement: 'बारे' },
      // In variations (but preserve "I" meaning)
      { pattern: /\sमैं\s/gi, replacement: ' में ' }  // Only replace when surrounded by spaces
    ];
    
    for (const correction of fuzzyCorrections) {
      cleanedText = cleanedText.replace(correction.pattern, correction.replacement);
    }

    // Final pass to collapse repeated Hindi particles (e.g., "में में" -> "में")
    cleanedText = cleanedText.replace(/(में\s*){2,}/g, 'में ');
    cleanedText = cleanedText.replace(/(के\s*){2,}/g, 'के ');
    cleanedText = cleanedText.replace(/(का\s*){2,}/g, 'का ');
    cleanedText = cleanedText.replace(/(की\s*){2,}/g, 'की ');
    cleanedText = cleanedText.replace(/(को\s*){2,}/g, 'को ');
    cleanedText = cleanedText.replace(/(से\s*){2,}/g, 'से ');
    cleanedText = cleanedText.replace(/(पर\s*){2,}/g, 'पर ');

    // Remove triple-or-more repeated words (e.g., "प्रेम प्रेम प्रेम" -> "प्रेम प्रेम")
    cleanedText = cleanedText.replace(/(\b\w+\b)(?:\s+\1){2,}/g, '$1 $1');

    console.log(`[transcribe-audio] Success`, {
      function_name: 'transcribe-audio',
      original_length: result.text?.length || 0,
      cleaned_length: cleanedText.length,
      original_text: result.text,
      cleaned_text: cleanedText,
      corrections_applied: result.text !== cleanedText
    });

    return ok({ text: cleanedText });

  } catch (err) {
    console.error(`[CRITICAL ERROR] in transcribe-audio: ${err.message}`, {
      function_name: 'transcribe-audio',
      error: err.message,
      stack: err.stack
    });
    return err(err.message || 'An unexpected error occurred');
  }
}

// 3. Serve the main handler using the CORS wrapper.
Deno.serve(createCorsWrappedHandler(handler));
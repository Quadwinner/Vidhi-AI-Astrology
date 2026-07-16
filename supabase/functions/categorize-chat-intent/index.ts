// supabase/functions/categorize-chat-intent/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@^0.22.0';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

async function handler(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'User is not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { question_text, profile_id } = await req.json();
    
    if (!question_text) {
      return new Response(JSON.stringify({ error: 'Missing question_text' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const PROMPT_NAME = 'chat_intent_categorizer_v1';
    const { data: promptData, error: promptError } = await supabaseAdmin
      .from('system_prompts')
      .select('prompt_text, model_name, secret_name')
      .eq('prompt_name', PROMPT_NAME)
      .eq('is_active', true)
      .single();

    if (promptError || !promptData) throw new Error(`System prompt '${PROMPT_NAME}' could not be loaded.`);

    const apiKey = Deno.env.get(promptData.secret_name);
    const anthropic = new Anthropic({ apiKey });
    
    // Inject the user's question into the prompt
    const finalPrompt = promptData.prompt_text.replace('{{question_text}}', question_text);

    const msg = await anthropic.messages.create({
      model: promptData.model_name || 'claude-3-haiku-20240307',
      max_tokens: 300, // Increased slightly to accommodate JSON
      temperature: 0,
      messages: [{ role: 'user', content: finalPrompt }],
    });

    const llmResponseText = msg.content[0]?.text || '{}';
    let categoryJson;
    
    try {
      // Attempt to parse the JSON output from LLM
      // Sometimes LLMs add text around JSON, so we find the first '{' and last '}'
      const jsonStartIndex = llmResponseText.indexOf('{');
      const jsonEndIndex = llmResponseText.lastIndexOf('}');
      
      if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
        const jsonString = llmResponseText.substring(jsonStartIndex, jsonEndIndex + 1);
        categoryJson = JSON.parse(jsonString);
      } else {
        categoryJson = JSON.parse(llmResponseText);
      }
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "LLM Output:", llmResponseText);
      // Fallback if LLM fails
      categoryJson = { category: 'general', sub_category: 'miscellaneous_astrology', entities: {} };
    }

    // Default structure if keys are missing
    const responseData = {
      category: categoryJson.category || 'general',
      sub_category: categoryJson.sub_category || null,
      // Map 'partner_name_hint' for backward compatibility if needed, 
      // but primarily use the new 'entities' object
      partner_name_hint: categoryJson.entities?.partner_name || null, 
      entities: categoryJson.entities || {}
    };

    return new Response(JSON.stringify(responseData), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Critical error in categorize-chat-intent:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

Deno.serve(createCorsWrappedHandler(handler));
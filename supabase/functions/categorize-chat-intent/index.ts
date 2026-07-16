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
    if (!apiKey) throw new Error(`API key secret '${promptData.secret_name}' is not set.`);

    // Inject the user's question into the prompt
    const finalPrompt = promptData.prompt_text.replace('{{question_text}}', question_text);

    const modelLower = (promptData.model_name || '').toLowerCase();
    const isAnthropic = modelLower.startsWith('claude');

    let llmResponseText = '{}';

    if (isAnthropic) {
      const anthropic = new Anthropic({ apiKey });
      const msg = await anthropic.messages.create({
        model: promptData.model_name,
        max_tokens: 300,
        temperature: 0,
        messages: [{ role: 'user', content: finalPrompt }],
      });
      llmResponseText = msg.content[0]?.text || '{}';
    } else {
      // Fireworks / OpenRouter / OpenAI-compatible chat completions.
      // The categorizer's model was a Fireworks model but the code used the
      // Anthropic SDK, which always 500'd and blocked the chat. Call the correct
      // endpoint, cap tokens, and keep reasoning low so it stays fast.
      const base = modelLower.startsWith('accounts/fireworks/')
        ? 'https://api.fireworks.ai/inference/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: promptData.model_name,
          messages: [{ role: 'user', content: finalPrompt }],
          temperature: 0,
          max_tokens: 300,
          reasoning_effort: 'low',
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[categorize-chat-intent] LLM error ${res.status}: ${errText}`);
        // Non-fatal: return a safe default so the chat is never blocked.
        return new Response(JSON.stringify({ category: 'general', sub_category: null, entities: {} }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const data = await res.json();
      llmResponseText = data.choices?.[0]?.message?.content || '{}';
    }
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
    // Never fail the chat because categorization failed — return a safe default.
    console.error('Critical error in categorize-chat-intent:', err);
    return new Response(JSON.stringify({ category: 'general', sub_category: null, entities: {} }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

Deno.serve(createCorsWrappedHandler(handler));
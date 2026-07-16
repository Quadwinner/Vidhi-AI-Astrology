// supabase/functions/submit-call-feedback/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. AUTHENTICATION (No change here)
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Authentication failed: User not found");
    }

    // 2. INPUT VALIDATION (No change here)
    const { profile_id, rating, comments } = await req.json();
    if (!profile_id || !rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: "Invalid input provided." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. DATABASE INSERT (This is the fix)
    const { error } = await supabaseAdmin
      .from('call_feedback')
      .insert({
        profile_id: profile_id,
        rating: rating,
        comments: comments,
        // --- THIS IS THE FIX ---
        // We now explicitly provide the user's ID, which we got from the auth step.
        user_id: user.id
      });

    if (error) {
      // This will now provide a more specific error if something else goes wrong.
      console.error("Database Insert Error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    // 4. RESPOND (No change here)
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error(`[CRITICAL ERROR] in submit-call-feedback: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
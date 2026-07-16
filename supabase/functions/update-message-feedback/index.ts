// --- FINAL, REFACTORED VERSION ---

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// 1. Import the new wrapper function.
import { createCorsWrappedHandler } from '../_shared/cors.ts'

// 2. Define your main logic inside a clean handler function.
async function handler(req: Request) {
  try {
    // 1. AUTHENTICATION
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!, 
        Deno.env.get('SUPABASE_ANON_KEY')!, 
        { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Authentication failed: User not found");
    }

    // 2. INPUT VALIDATION
    const { message_id, feedback } = await req.json();
    if (!message_id) {
      return new Response(JSON.stringify({ error: "Missing 'message_id'" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    // Correcting the validation logic as per your comment.
    if (feedback !== 'like' && feedback !== 'dislike') {
      return new Response(JSON.stringify({ error: "Invalid 'feedback' value. Must be 'like' or 'dislike'." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 3. DATABASE UPDATE
    const { data, error } = await supabaseAdmin
      .from('chat_history')
      .update({ feedback: feedback })
      .eq('id', message_id)
      .eq('user_id', user.id) // Security check
      .select();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
        return new Response(JSON.stringify({ error: "Message not found or access denied." }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // 4. RESPOND
    return new Response(JSON.stringify({ success: true, feedback: data[0] }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error(`[CRITICAL ERROR] in update-message-feedback: ${err.message}`);
    // Let the wrapper create the final error response.
    throw err;
  }
}

// 3. Serve the main handler using the CORS wrapper.
Deno.serve(createCorsWrappedHandler(handler));
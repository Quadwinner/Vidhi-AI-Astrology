import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

async function handler(req: Request) {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Admin check
    const { data: adminRow } = await supabase.from('users').select('is_admin').eq('id', user.id).single();
    if (!adminRow?.is_admin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { email } = await req.json();
    if (!email) return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: target } = await supabase.from('users').select('id, plan_tier, subscription_start_date').ilike('email', email).single();
    if (!target) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const now = new Date();
    let cycleStart: Date;
    let cycleEnd: Date;
    const planId = target.plan_tier || 'free';
    if (planId === 'yearly') {
      const anchor = target.subscription_start_date ? new Date(target.subscription_start_date) : new Date(now.getFullYear(), 0, 1);
      cycleStart = new Date(anchor);
      while (cycleStart <= now) cycleStart.setFullYear(cycleStart.getFullYear() + 1);
      cycleEnd = new Date(cycleStart);
      cycleStart.setFullYear(cycleStart.getFullYear() - 1);
    } else {
      cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
      cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    const { data: counters } = await supabase
      .from('user_plan_counters')
      .select('questions_used, talk_minutes_used, cycle_start, cycle_end')
      .eq('user_id', target.id)
      .eq('cycle_start', cycleStart.toISOString().slice(0,10))
      .eq('cycle_end', cycleEnd.toISOString().slice(0,10))
      .maybeSingle();

    // lightweight diagnostics: recent chat and calls
    const { data: recentChats } = await supabase
      .from('chat_history')
      .select('id, created_at')
      .eq('user_id', target.id)
      .gte('created_at', new Date(Date.now()-6*60*60*1000).toISOString())
      .limit(10)
      .order('created_at', { ascending: false });

    const { data: recentCalls } = await supabase
      .from('call_logs')
      .select('id, duration_seconds, started_at, ended_at, status')
      .eq('user_id', target.id)
      .gte('started_at', new Date(Date.now()-6*60*60*1000).toISOString())
      .limit(10)
      .order('started_at', { ascending: false });

    return new Response(JSON.stringify({
      email,
      plan_tier: planId,
      counters: counters || { questions_used: 0, talk_minutes_used: 0, cycle_start: cycleStart.toISOString().slice(0,10), cycle_end: cycleEnd.toISOString().slice(0,10) },
      diagnostics: {
        recent_chat_count: (recentChats || []).length,
        recent_call_count: (recentCalls || []).length,
        recent_calls: recentCalls || []
      }
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

Deno.serve(createCorsWrappedHandler(handler));



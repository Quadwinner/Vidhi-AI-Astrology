// Daily Analytics Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Pool } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.is_admin) {
      throw new Error('User is not admin');
    }

    // Execute the daily analytics query
    const query = `
SELECT
  d.day,
  (SELECT COUNT(DISTINCT up.user_id) FROM public.user_profiles up WHERE up.created_at::date = d.day) AS new_users,
  (SELECT COUNT(DISTINCT a.user_id) FROM (SELECT user_id, created_at::date as day FROM public.chat_history WHERE role = 'user' UNION SELECT user_id, started_at::date FROM public.call_logs) a WHERE a.day = d.day AND EXISTS (SELECT 1 FROM public.user_profiles up2 WHERE up2.user_id = a.user_id AND up2.created_at::date < d.day)) AS returning_users,
  (SELECT COUNT(*) FROM public.payments WHERE created_at::date = d.day AND status = 'succeeded') AS total_orders,
  (SELECT COALESCE(SUM(amount/100.0), 0) FROM public.payments WHERE created_at::date = d.day AND status = 'succeeded') AS total_payment,
  (SELECT COUNT(*) FROM public.payments WHERE created_at::date = d.day AND status = 'succeeded' AND product_type = 'subscription') AS total_subscriptions,
  (SELECT COUNT(*) FROM public.payments WHERE created_at::date = d.day AND status IN ('failed', 'cancelled')) AS payment_failed,
  (SELECT COUNT(*) FROM public.chat_history WHERE created_at::date = d.day AND role = 'user') AS total_chats,
  (SELECT COUNT(*) FROM public.call_logs WHERE started_at::date = d.day) AS total_calls,
  (SELECT COUNT(*) FROM public.profile_astro_data WHERE COALESCE(last_generated_at, created_at)::date = d.day) AS total_reports,
  (SELECT COALESCE(SUM(questions_used), 0) FROM public.user_plan_counters WHERE d.day BETWEEN cycle_start AND cycle_end) AS questions_used,
  (SELECT COALESCE(SUM(talk_minutes_used), 0) FROM public.user_plan_counters WHERE d.day BETWEEN cycle_start AND cycle_end) AS talk_minutes_used,
  (SELECT COUNT(*) FROM public.whatsapp_link_clicks WHERE clicked_at::date = d.day) AS whatsapp_clicks,
  (SELECT COALESCE(SUM(lc.total_cost_inr), 0) FROM public.llm_api_costs lc JOIN public.chat_history ch ON ch.id = lc.chat_history_id WHERE ch.created_at::date = d.day AND ch.role = 'assistant') AS total_llm_cost_inr,
  (SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(lc.total_cost_inr), 0) / COUNT(*), 6) ELSE 0 END FROM public.llm_api_costs lc JOIN public.chat_history ch ON ch.id = lc.chat_history_id WHERE ch.created_at::date = d.day AND ch.role = 'assistant') AS avg_llm_cost_per_chat_inr
FROM generate_series(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, '1 day') AS d(day)
ORDER BY d.day DESC;
    `;

    // Execute raw SQL using Postgres client
    const databaseUrl = Deno.env.get('SUPABASE_DB_URL');
    if (!databaseUrl) {
      throw new Error('Database URL not configured');
    }

    const pool = new Pool(databaseUrl, 3, true);
    const connection = await pool.connect();

    try {
      const result = await connection.queryObject(query);
      const analyticsData = result.rows;

      // Convert BigInt to Number for JSON serialization
      const serializedData = analyticsData.map(row => {
        const converted: any = {};
        for (const key in row) {
          const value = row[key];
          // Convert BigInt to Number
          converted[key] = typeof value === 'bigint' ? Number(value) : value;
        }
        return converted;
      });

      return new Response(
        JSON.stringify({ data: serializedData }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error in get-daily-analytics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

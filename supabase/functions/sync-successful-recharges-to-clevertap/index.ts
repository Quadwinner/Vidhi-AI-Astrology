import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clevertapAccountId = Deno.env.get('CLEVERTAP_ACCOUNT_ID')!;
    const clevertapPasscode = Deno.env.get('CLEVERTAP_PASSCODE')!;
    const clevertapRegion = Deno.env.get('CLEVERTAP_REGION') || 'eu1';

    if (!clevertapAccountId || !clevertapPasscode) {
      throw new Error('CleverTap credentials not configured');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { limit, days, date } = await req.json().catch(() => ({ days: 30 }));

    console.log('🔄 Starting successful recharge sync to CleverTap...');

    // Build query - ONLY sync payments that are CURRENTLY successful
    let query = supabaseClient
      .from('payments')
      .select('*')
      .in('status', ['succeeded', 'completed']);

    // Filter by specific date (YYYY-MM-DD format)
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query = query.gte('created_at', startDate.toISOString())
                   .lte('created_at', endDate.toISOString());
    }
    // Filter by days (if date not specified)
    else if (days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      query = query.gte('created_at', startDate.toISOString());
    }

    // Apply limit
    if (limit) {
      query = query.limit(limit);
    }

    const { data: successfulPayments, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    if (!successfulPayments || successfulPayments.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No successful recharges to sync',
          total: 0,
          synced: 0,
          failed: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${successfulPayments.length} successful recharges to sync`);

    const results = {
      total: successfulPayments.length,
      synced: 0,
      failed: 0,
      errors: [] as any[]
    };

    const clevertapApiUrl = `https://${clevertapRegion}.api.clevertap.com/1/upload`;

    // Process in batches
    const batchSize = 100;

    for (let i = 0; i < successfulPayments.length; i += batchSize) {
      const batch = successfulPayments.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} payments)`);

      // Prepare batch event data - Send as "Charged" event (CleverTap revenue event)
      const eventDataBatch = batch.map(payment => ({
        identity: payment.user_id,
        ts: Math.floor(new Date(payment.created_at).getTime() / 1000),
        type: 'event',
        evtName: 'Charged',
        evtData: {
          'Amount': payment.amount / 100, // Convert paise to rupees
          'Currency': payment.currency?.toUpperCase() || 'INR',
          'Payment ID': payment.gateway_payment_id || payment.id,
          'Order ID': payment.gateway_order_id,
          'Gateway': payment.payment_gateway,
          'Product Type': payment.product_type,
          'Payment Status': 'Success',
          'source': 'database_sync',
          'variant': 'recharge_successful'
        }
      }));

      try {
        const response = await fetch(clevertapApiUrl, {
          method: 'POST',
          headers: {
            'X-CleverTap-Account-Id': clevertapAccountId,
            'X-CleverTap-Passcode': clevertapPasscode,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ d: eventDataBatch })
        });

        const result = await response.json();
        console.log('CleverTap Response:', JSON.stringify(result));

        if (response.ok && result.status === 'success') {
          results.synced += batch.length;
          console.log(`✅ Synced batch ${Math.floor(i / batchSize) + 1}: ${batch.length} events`);
        } else {
          results.failed += batch.length;
          results.errors.push({
            batch: Math.floor(i / batchSize) + 1,
            error: result,
            status: response.status
          });
          console.error(`❌ Failed batch ${Math.floor(i / batchSize) + 1}:`, result);
        }
      } catch (err: any) {
        results.failed += batch.length;
        results.errors.push({
          batch: Math.floor(i / batchSize) + 1,
          error: err?.message || String(err)
        });
        console.error(`❌ Error syncing batch ${Math.floor(i / batchSize) + 1}:`, err);
      }

      // Small delay between batches
      if (i + batchSize < successfulPayments.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const response = {
      success: true,
      total: results.total,
      synced: results.synced,
      failed: results.failed,
      message: `✅ Synced ${results.synced} out of ${results.total} successful recharge events to CleverTap`,
      timestamp: new Date().toISOString(),
      errors: results.errors.length > 0 ? results.errors.slice(0, 5) : undefined
    };

    console.log('🎉 Sync complete:', response);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Sync failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || String(error),
        stack: error?.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


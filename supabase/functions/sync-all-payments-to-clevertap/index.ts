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

    const { limit, days, date, status } = await req.json().catch(() => ({}));

    console.log('🔄 Starting all payments sync to CleverTap...');

    // Build query - Get all payments
    let query = supabaseClient
      .from('payments')
      .select('*');

    // Filter by status if provided
    if (status) {
      if (Array.isArray(status)) {
        query = query.in('status', status);
      } else {
        query = query.eq('status', status);
      }
    }

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

    const { data: payments, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    if (!payments || payments.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No payments to sync',
          total: 0,
          synced: 0,
          failed: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${payments.length} payments to sync`);

    const results = {
      total: payments.length,
      synced: 0,
      failed: 0,
      byStatus: {} as Record<string, number>,
      errors: [] as any[]
    };

    const clevertapApiUrl = `https://${clevertapRegion}.api.clevertap.com/1/upload`;

    // Process in batches
    const batchSize = 100;

    for (let i = 0; i < payments.length; i += batchSize) {
      const batch = payments.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} payments)`);

      // Map payments to CleverTap events based on status
      const eventDataBatch = batch.map(payment => {
        const paymentStatus = payment.status?.toLowerCase();
        let evtName = 'Payment Event';
        let evtData: Record<string, any> = {
          'Payment ID': payment.gateway_payment_id || payment.id,
          'Order ID': payment.gateway_order_id,
          'Amount': payment.amount / 100, // Convert paise to rupees
          'Currency': payment.currency?.toUpperCase() || 'INR',
          'Gateway': payment.payment_gateway,
          'Product Type': payment.product_type,
          'Payment Status': payment.status,
          'source': 'database_sync'
        };

        // Map status to appropriate CleverTap event
        if (paymentStatus === 'succeeded' || paymentStatus === 'completed') {
          evtName = 'Charged'; // CleverTap revenue event
          evtData['Payment Status'] = 'Success';
          evtData['variant'] = 'recharge_successful';
        } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
          evtName = 'Recharge Failed';
          evtData['variant'] = 'recharge_failed';
        } else if (paymentStatus === 'pending' || paymentStatus === 'incomplete') {
          evtName = 'Recharge Pending';
          evtData['variant'] = 'recharge_pending';
        }

        // Add product details if available
        if (payment.product_details && typeof payment.product_details === 'object') {
          Object.assign(evtData, payment.product_details);
        }

        return {
          identity: payment.user_id,
          ts: Math.floor(new Date(payment.created_at).getTime() / 1000),
          type: 'event',
          evtName,
          evtData
        };
      });

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
          // Track by status
          batch.forEach(p => {
            const status = p.status || 'unknown';
            results.byStatus[status] = (results.byStatus[status] || 0) + 1;
          });
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
      if (i + batchSize < payments.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const response = {
      success: true,
      total: results.total,
      synced: results.synced,
      failed: results.failed,
      byStatus: results.byStatus,
      message: `✅ Synced ${results.synced} out of ${results.total} payment events to CleverTap`,
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


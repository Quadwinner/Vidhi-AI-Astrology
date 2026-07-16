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

    const { limit } = await req.json().catch(() => ({}));

    console.log('🔄 Starting wallet balance sync to CleverTap...');

    // Fetch all users with pagination
    let allUsers: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
    const { data: users, error } = await supabaseClient
      .from('users')
        .select('id, email, wallet_balance, coin_balance, plan_tier, subscription_status')
        .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

      if (users && users.length > 0) {
        allUsers = allUsers.concat(users);
        console.log(`📥 Fetched page ${page + 1}: ${users.length} users (Total: ${allUsers.length})`);
        
        if (users.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }

        // Apply limit if specified
        if (limit && allUsers.length >= limit) {
          allUsers = allUsers.slice(0, limit);
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    const users = allUsers;

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No users to sync',
          total: 0,
          synced: 0,
          failed: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${users.length} users to sync`);

    // Sync users in batches (CleverTap supports up to 100 profiles per request)
    const batchSize = 100;
    const results = {
      total: users.length,
      synced: 0,
      failed: 0,
      errors: [] as any[]
    };

    const clevertapApiUrl = `https://${clevertapRegion}.api.clevertap.com/1/upload`;

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      console.log(`[Batch Sync] Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} users)`);

      // Prepare batch data
      const profileData = batch.map(user => ({
        identity: user.id,
        ts: Math.floor(Date.now() / 1000),
        type: 'profile',
        profileData: {
          Email: user.email,
          Identity: user.id,
          'Wallet Balance': user.wallet_balance || 0,
          'Coin Balance': user.coin_balance || 0,
          'Plan Tier': user.plan_tier || 'free',
          'Subscription Status': user.subscription_status || 'inactive',
          'Synced At': new Date().toISOString(),
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
          body: JSON.stringify({ d: profileData })
        });

        const result = await response.json();

        if (response.ok) {
          results.synced += batch.length;
          console.log(`✅ Synced batch ${Math.floor(i / batchSize) + 1}: ${batch.length} users`);
        } else {
          results.failed += batch.length;
          results.errors.push({ batch: Math.floor(i / batchSize) + 1, error: result });
          console.error(`❌ Failed batch ${Math.floor(i / batchSize) + 1}:`, result);
        }
      } catch (err: any) {
        results.failed += batch.length;
        results.errors.push({ batch: Math.floor(i / batchSize) + 1, error: err?.message || String(err) });
        console.error(`❌ Error syncing batch ${Math.floor(i / batchSize) + 1}:`, err);
      }
    }

    const response = {
      success: true,
      total: results.total,
      synced: results.synced,
      failed: results.failed,
      message: `✅ Synced ${results.synced} out of ${results.total} users to CleverTap`,
      timestamp: new Date().toISOString(),
      errors: results.errors.length > 0 ? results.errors : undefined
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
        error: error?.message || String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

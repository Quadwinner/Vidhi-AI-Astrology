// v9 - Add phone number sync support (phone_number + msg91_phone_number)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      segment = 'all', // 'all', 'premium', 'push_enabled', 'active'
      limit = null, // null means sync all users
      user_ids = [] // Optional: specific user IDs to sync
    } = await req.json();

    console.log(`[Batch Sync] Starting batch sync. Segment: ${segment}, Limit: ${limit || 'ALL'}`);

    // Fetch all users using pagination
    let allUsers: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('users')
        .select('id, email, plan_tier')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Apply segment filters
      if (user_ids && user_ids.length > 0) {
        query = query.in('id', user_ids);
      } else {
        switch (segment) {
          case 'premium':
            query = query.in('plan_tier', ['monthly', 'yearly']);
            break;
          case 'push_enabled':
            // Join with notification preferences
            const { data: pushEnabledUsers } = await supabase
              .from('user_notification_preferences')
              .select('user_id')
              .eq('notification_enabled', true);

            if (pushEnabledUsers && pushEnabledUsers.length > 0) {
              const userIds = pushEnabledUsers.map(u => u.user_id);
              query = query.in('id', userIds);
            } else {
              throw new Error('No push-enabled users found');
            }
            break;
          case 'active':
            // Users with activity in last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: activeUsers } = await supabase
              .from('chat_history')
              .select('user_id')
              .gte('created_at', thirtyDaysAgo.toISOString())
              .limit(10000);

            if (activeUsers && activeUsers.length > 0) {
              const uniqueUserIds = [...new Set(activeUsers.map(u => u.user_id))];
              query = query.in('id', uniqueUserIds);
            } else {
              throw new Error('No active users found');
            }
            break;
          case 'all':
          default:
            // No additional filter
            break;
        }
      }

      const { data: users, error: usersError } = await query;

      if (usersError) {
        throw new Error(`Failed to fetch users: ${usersError.message}`);
      }

      if (users && users.length > 0) {
        allUsers = allUsers.concat(users);
        console.log(`[Batch Sync] Fetched page ${page + 1}: ${users.length} users (Total: ${allUsers.length})`);

        if (users.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }

        // If limit is specified, stop when we reach it
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

    console.log(`[Batch Sync] Found ${users.length} users to sync`);

    // Sync users in batches (CleverTap supports up to 100 profiles per request)
    const batchSize = 100;
    const results = {
      total: users.length,
      synced: 0,
      failed: 0,
      errors: [] as any[]
    };

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      console.log(`[Batch Sync] Processing batch ${i / batchSize + 1} (${batch.length} users)`);

      // Fetch user data for each user in batch
      const profileDataPromises = batch.map(async (user) => {
        try {
          const { data: userData, error } = await supabase.rpc(
            'get_user_clevertap_data',
            { p_user_id: user.id }
          );

          if (error || !userData) {
            console.error(`[Batch Sync] Failed to fetch data for user ${user.id}:`, error);
            results.failed++;
            results.errors.push({ user_id: user.id, error: error?.message || 'No data' });
            return null;
          }

          return {
            identity: userData.user_id,
            ts: Math.floor(Date.now() / 1000),
            type: 'profile',
            profileData: {
              Email: userData.email,
              Identity: userData.user_id,
              ...(userData.name && { Name: userData.name }),

              // Phone Numbers
              ...(userData.msg91_phone_number && { Phone: userData.msg91_phone_number }),
              ...(userData.phone_number && !userData.msg91_phone_number && { Phone: userData.phone_number }),
              ...(userData.phone_number && { 'Phone Number': userData.phone_number }),
              ...(userData.msg91_phone_number && { 'MSG91 Phone': userData.msg91_phone_number }),

              // WhatsApp Opt-In
              'WhatsApp Marketing Opt-In': userData.whatsapp_marketing_opt_in || false,
              ...(userData.whatsapp_opt_in_date && { 'WhatsApp Opt-In Date': userData.whatsapp_opt_in_date }),
              ...(userData.whatsapp_opt_in_source && { 'WhatsApp Opt-In Source': userData.whatsapp_opt_in_source }),

              'Plan Tier': userData.plan_tier,
              'Subscription Status': userData.subscription_status,
              'Subscription End': userData.subscription_end_date,
              'Coin Balance': userData.coin_balance,
              'Profile Count': userData.profile_count,
              'Gender': userData.gender,
              'User Age': userData.age,  // Renamed from 'Age' due to CleverTap reserved property
              'Total Calls': userData.total_calls,
              'Total Call Duration (min)': userData.total_call_duration_minutes,
              'Last Call Date': userData.last_call_date,
              'Avg Call Rating': userData.avg_call_rating,
              'Total Messages': userData.total_messages,
              'Last Message Date': userData.last_message_date,
              'Preferred Language': userData.preferred_language,
              'Most Asked Category': userData.most_asked_category,
              'Most Asked Sub-Category': userData.most_asked_subcategory,
              'Love Questions': userData.love_questions_count,
              'Marriage Questions': userData.marriage_questions_count,
              'Career Questions': userData.career_questions_count,
              'Health Questions': userData.health_questions_count,
              'Money Questions': userData.money_questions_count,
              'Spiritual Questions': userData.spiritual_questions_count,
              'Last Payment Amount': userData.last_payment_amount,
              'Payment Gateway': userData.payment_gateway,
              'Total Amount Spent': userData.total_amount_spent,
              'Questions Used This Month': userData.questions_used_this_month,
              'Talk Minutes Used This Month': userData.talk_minutes_used_this_month,
              'Questions Remaining': userData.questions_remaining,
              'Talk Minutes Remaining': userData.talk_minutes_remaining,
              'Push Notifications Enabled': userData.push_notifications_enabled,
              'Has Created Profile': userData.has_created_profile,
              'Has Made Call': userData.has_made_call,
              'Has Sent Message': userData.has_sent_message,
              'Last Updated': userData.last_updated,
            }
          };
        } catch (err) {
          console.error(`[Batch Sync] Error processing user ${user.id}:`, err);
          results.failed++;
          results.errors.push({ user_id: user.id, error: err.message });
          return null;
        }
      });

      const profilesData = (await Promise.all(profileDataPromises)).filter(p => p !== null);

      if (profilesData.length === 0) {
        console.log(`[Batch Sync] No valid profiles in batch, skipping`);
        continue;
      }

      // Send batch to CleverTap
      try {
        const clevertapApiUrl = `https://${clevertapRegion}.api.clevertap.com/1/upload`;

        const response = await fetch(clevertapApiUrl, {
          method: 'POST',
          headers: {
            'X-CleverTap-Account-Id': clevertapAccountId,
            'X-CleverTap-Passcode': clevertapPasscode,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ d: profilesData })
        });

        const result = await response.json();

        if (!response.ok) {
          console.error(`[Batch Sync] CleverTap API error:`, result);
          results.failed += profilesData.length;
          results.errors.push({ batch: i / batchSize + 1, error: result });
        } else {
          console.log(`[Batch Sync] Batch ${i / batchSize + 1} synced successfully:`, result);
          results.synced += profilesData.length;
        }
      } catch (err) {
        console.error(`[Batch Sync] Error sending batch to CleverTap:`, err);
        results.failed += profilesData.length;
        results.errors.push({ batch: i / batchSize + 1, error: err.message });
      }

      // Rate limiting: wait 1 second between batches
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[Batch Sync] Completed. Synced: ${results.synced}, Failed: ${results.failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Batch sync completed`,
        ...results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Batch Sync] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

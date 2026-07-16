// v10 - Add phone number sync support (phone_number + msg91_phone_number)
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
    const clevertapAccountId = Deno.env.get('CLEVERTAP_ACCOUNT_ID')!; // 4W9-979-K67Z
    const clevertapPasscode = Deno.env.get('CLEVERTAP_PASSCODE')!;
    const clevertapRegion = Deno.env.get('CLEVERTAP_REGION') || 'eu1'; // eu1, in1, us1, etc.

    if (!clevertapAccountId || !clevertapPasscode) {
      throw new Error('CleverTap credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log(`[CleverTap Sync] Starting sync for user: ${user_id}`);

    // Call aggregation function to get all user data
    const { data: userData, error: dataError } = await supabase.rpc(
      'get_user_clevertap_data',
      { p_user_id: user_id }
    );

    if (dataError) {
      console.error('[CleverTap Sync] Error fetching user data:', dataError);
      throw new Error(`Failed to fetch user data: ${dataError.message}`);
    }

    if (!userData) {
      throw new Error('User data not found');
    }

    console.log('[CleverTap Sync] User data fetched:', userData);

    // Build CleverTap profile data
    const profileData = {
      identity: userData.user_id,
      ts: Math.floor(Date.now() / 1000), // Unix timestamp
      type: 'profile',
      profileData: {
        // Identity (CleverTap standard fields)
        Email: userData.email,
        Identity: userData.user_id,
        ...(userData.name && { Name: userData.name }),

        // Phone Numbers
        // Use CleverTap's standard 'Phone' field (prefer msg91_phone_number which is properly formatted)
        ...(userData.msg91_phone_number && { Phone: userData.msg91_phone_number }),
        ...(userData.phone_number && !userData.msg91_phone_number && { Phone: userData.phone_number }),

        // Store both in custom fields for reference
        ...(userData.phone_number && { 'Phone Number': userData.phone_number }),
        ...(userData.msg91_phone_number && { 'MSG91 Phone': userData.msg91_phone_number }),

        // WhatsApp Opt-In
        'WhatsApp Marketing Opt-In': userData.whatsapp_marketing_opt_in || false,
        ...(userData.whatsapp_opt_in_date && { 'WhatsApp Opt-In Date': userData.whatsapp_opt_in_date }),
        ...(userData.whatsapp_opt_in_source && { 'WhatsApp Opt-In Source': userData.whatsapp_opt_in_source }),

        // Plan & Subscription
        'Plan Tier': userData.plan_tier,
        'Subscription Status': userData.subscription_status,
        'Subscription Start': userData.subscription_start_date,
        'Subscription End': userData.subscription_end_date,
        'Coin Balance': userData.coin_balance,

        // User Details
        'Profile Count': userData.profile_count,
        'Gender': userData.gender,
        'Age': userData.age,
        'Is Admin': userData.is_admin,

        // Call Stats
        'Total Calls': userData.total_calls,
        'Total Call Duration (min)': userData.total_call_duration_minutes,
        'Avg Call Duration (min)': userData.avg_call_duration_minutes,
        'Last Call Date': userData.last_call_date,
        'Last Call Duration (min)': userData.last_call_duration_minutes,

        // Call Feedback
        'Avg Call Rating': userData.avg_call_rating,
        'Total Call Feedbacks': userData.total_call_feedbacks,
        'Last Call Rating': userData.last_call_rating,

        // Chat Stats
        'Total Messages': userData.total_messages,
        'Last Message Date': userData.last_message_date,
        'Preferred Language': userData.preferred_language,

        // Category Breakdown
        'Most Asked Category': userData.most_asked_category,
        'Most Asked Sub-Category': userData.most_asked_subcategory,
        'Love Questions': userData.love_questions_count,
        'Marriage Questions': userData.marriage_questions_count,
        'Career Questions': userData.career_questions_count,
        'Health Questions': userData.health_questions_count,
        'Money Questions': userData.money_questions_count,
        'Spiritual Questions': userData.spiritual_questions_count,

        // Payment Stats
        'Last Payment Date': userData.last_payment_date,
        'Last Payment Amount': userData.last_payment_amount,
        'Payment Currency': userData.payment_currency,
        'Payment Gateway': userData.payment_gateway,
        'Total Amount Spent': userData.total_amount_spent,

        // Usage (Current Cycle)
        'Questions Used This Month': userData.questions_used_this_month,
        'Talk Minutes Used This Month': userData.talk_minutes_used_this_month,
        'Questions Remaining': userData.questions_remaining,
        'Talk Minutes Remaining': userData.talk_minutes_remaining,
        'Cycle End Date': userData.cycle_end_date,

        // Notification Preferences
        'Push Notifications Enabled': userData.push_notifications_enabled,
        'Daily Horoscope Enabled': userData.daily_horoscope_enabled,
        'Weekly Forecast Enabled': userData.weekly_forecast_enabled,
        'Promotional Enabled': userData.promotional_enabled,

        // Engagement Flags
        'Has Created Profile': userData.has_created_profile,
        'Has Made Call': userData.has_made_call,
        'Has Sent Message': userData.has_sent_message,

        // Timestamps
        'Account Created': userData.account_created,
        'Last Updated': userData.last_updated,
      }
    };

    // Send to CleverTap Profile API
    const clevertapApiUrl = `https://${clevertapRegion}.api.clevertap.com/1/upload`;

    console.log(`[CleverTap Sync] Sending to CleverTap API: ${clevertapApiUrl}`);

    const clevertapResponse = await fetch(clevertapApiUrl, {
      method: 'POST',
      headers: {
        'X-CleverTap-Account-Id': clevertapAccountId,
        'X-CleverTap-Passcode': clevertapPasscode,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        d: [profileData]
      })
    });

    const result = await clevertapResponse.json();

    if (!clevertapResponse.ok) {
      console.error('[CleverTap Sync] API error:', result);
      throw new Error(`CleverTap API error: ${JSON.stringify(result)}`);
    }

    console.log('[CleverTap Sync] Success:', result);

    // Store sync log (non-critical, ignore errors)
    try {
      await supabase.from('clevertap_sync_logs').insert({
        user_id: user_id,
        status: 'success',
        response: result,
        synced_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[CleverTap Sync] Failed to log sync (non-critical):', err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User synced to CleverTap successfully',
        user_id: user_id,
        clevertap_response: result,
        synced_properties: Object.keys(profileData.profileData).length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CleverTap Sync] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

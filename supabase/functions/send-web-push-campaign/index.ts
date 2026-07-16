import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CampaignRequest {
  title: string;
  message: string;
  iconUrl?: string;
  clickUrl?: string;
  segment: 'all' | 'push_enabled' | 'test';
  testEmail?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin
    const { data: userData, error: adminCheckError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (adminCheckError || !userData?.is_admin) {
      throw new Error("User is not an admin");
    }

    // Parse request body
    const campaignData: CampaignRequest = await req.json();
    console.log("[Send Web Push Campaign] Received request:", campaignData);

    const { title, message, iconUrl, clickUrl, segment, testEmail } = campaignData;

    // Validate required fields
    if (!title || !message) {
      throw new Error("Title and message are required");
    }

    if (segment === 'test' && !testEmail) {
      throw new Error("Test email is required for test segment");
    }

    // Get CleverTap credentials
    const clevertapAccountId = Deno.env.get("CLEVERTAP_ACCOUNT_ID");
    const clevertapPasscode = Deno.env.get("CLEVERTAP_PASSCODE");

    if (!clevertapAccountId || !clevertapPasscode) {
      throw new Error("CleverTap credentials not configured");
    }

    // Prepare notification payload for CleverTap
    const notificationPayload: any = {
      name: `WebPush_${Date.now()}`,
      when: "now",
      where: {
        event_name: "charged",
        common_profile_properties: {}
      },
      content: {
        title: title,
        body: message,
        platform_specific: {
          web: {
            require_interaction: false,
            image: iconUrl || "https://astroaura.ai/logo192.png",
            icon: iconUrl || "https://astroaura.ai/logo192.png",
            on_click: clickUrl || "/chat"
          }
        }
      }
    };

    // Set segment
    if (segment === 'test' && testEmail) {
      // Send to specific test user
      notificationPayload.where = {
        common_profile_properties: {
          email: {
            equals: testEmail
          }
        }
      };
    } else if (segment === 'push_enabled') {
      // Send to users with push enabled
      notificationPayload.where = {
        common_profile_properties: {
          push_enabled: {
            equals: true
          }
        }
      };
    }
    // else 'all' - no additional filtering

    console.log("[Send Web Push Campaign] Sending to CleverTap:", JSON.stringify(notificationPayload, null, 2));

    // Send to CleverTap API
    const clevertapResponse = await fetch(
      "https://api.clevertap.com/1/send/webpush.json",
      {
        method: "POST",
        headers: {
          "X-CleverTap-Account-Id": clevertapAccountId,
          "X-CleverTap-Passcode": clevertapPasscode,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notificationPayload),
      }
    );

    const clevertapResult = await clevertapResponse.json();
    console.log("[Send Web Push Campaign] CleverTap response:", clevertapResult);

    if (!clevertapResponse.ok) {
      throw new Error(`CleverTap API error: ${JSON.stringify(clevertapResult)}`);
    }

    // Log campaign in database (optional - create campaigns table if needed)
    try {
      await supabase.from("web_push_campaigns").insert({
        title,
        message,
        icon_url: iconUrl,
        click_url: clickUrl,
        segment,
        test_email: testEmail,
        created_by: user.id,
        clevertap_response: clevertapResult,
        sent_at: new Date().toISOString()
      });
    } catch (logError) {
      console.warn("[Send Web Push Campaign] Failed to log campaign:", logError);
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Campaign sent successfully",
        clevertapResult,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[Send Web Push Campaign] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to send campaign",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

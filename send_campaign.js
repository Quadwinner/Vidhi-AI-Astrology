// Send WhatsApp campaign to all users in database
// Run: node send_campaign.js

const SUPABASE_URL = "https://ieakxiipnpwvyvpsjnkl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllYWt4aWlwbnB3dnl2cHNqbmtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc2OTQ1NjgsImV4cCI6MjA0MzI3MDU2OH0.JJBDjv3EzPLz8dYMW-bVj1P_OhvlJnLLCfE7lqIJwMo";

const CAMPAIGN_NAME = "astroaura_marketing";
const USE_CATEGORY_BASED = true; // Set to true to send category-specific templates

async function sendCampaign() {
  console.log("🚀 Starting WhatsApp campaign...");
  
  if (USE_CATEGORY_BASED) {
    console.log("Mode: Category-based (Love, Career, Health, Money, Spiritual)");
    console.log("Each user will receive a template based on their question history");
  } else {
    console.log("Campaign:", CAMPAIGN_NAME);
  }
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-campaign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        campaignName: CAMPAIGN_NAME,
        testMode: false,
        useCategoryBased: USE_CATEGORY_BASED
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log("\n✅ Campaign completed!");
      console.log("Total recipients:", result.results.total);
      console.log("Successfully sent:", result.results.success);
      console.log("Failed:", result.results.failed);
      
      if (result.results.categoryBreakdown && Object.keys(result.results.categoryBreakdown).length > 0) {
        console.log("\n📊 Category Breakdown:");
        for (const [category, count] of Object.entries(result.results.categoryBreakdown)) {
          console.log(`  ${category}: ${count} users`);
        }
      }
      
      if (result.results.errors && result.results.errors.length > 0) {
        console.log("\nErrors:");
        result.results.errors.forEach(err => console.log("  -", err));
      }
    } else {
      console.log("\n❌ Campaign failed!");
      console.log("Error:", result.error || JSON.stringify(result));
    }
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
  }
}

sendCampaign();


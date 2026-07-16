import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function sendTestCampaign() {
  const testPhone = '+917068901646';
  const campaignName = 'AstroAura Marketing'; // "AstroAura Marketing" campaign (try with spaces)

  console.log(`📤 Sending "AstroAura Marketing" campaign to ${testPhone}...\n`);

  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp-campaign', {
      body: {
        campaignName: campaignName,
        testMode: true,
        testPhone: testPhone,
        useCategoryBased: false, // Same as yesterday - send same campaign to all
        dryRun: false
      }
    });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ Campaign Response:');
    console.log(JSON.stringify(data, null, 2));

    if (data.results) {
      console.log(`\n📊 Results:`);
      console.log(`   Total: ${data.results.total}`);
      console.log(`   Success: ${data.results.success}`);
      console.log(`   Failed: ${data.results.failed}`);
      
      if (data.results.errors && data.results.errors.length > 0) {
        console.log(`\n❌ Errors (check these in AiSensy dashboard):`);
        data.results.errors.forEach(err => console.log(`   - ${err}`));
        console.log(`\n⚠️  Note: Even if API returns success, check AiSensy dashboard for actual delivery status.`);
        console.log(`   Common issues:`);
        console.log(`   - User must message WhatsApp bot first`);
        console.log(`   - Phone number not registered on WhatsApp`);
        console.log(`   - User opted out of messages`);
        console.log(`   - Campaign/template not approved`);
      } else if (data.results.success > 0) {
        console.log(`\n✅ API call successful! Check AiSensy dashboard to confirm delivery.`);
      }
    }
  } catch (error) {
    console.error('❌ Network or script error:', error);
  }
}

sendTestCampaign();


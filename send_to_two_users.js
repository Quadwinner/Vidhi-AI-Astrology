// Send WhatsApp campaign to two specific users
// Campaign: "user" template with image

const AISENSY_API_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MzA0ZGQyOWU4ZDljN2M3NmE0M2Y1NiIsIm5hbWUiOiJTdHJhdG5vdmEgVGVjaG5vbG9naWVzIExMUCIsImFwcE5hbWUiOiJBaVNlbnN5IiwiY2xpZW50SWQiOiI2OTMwNGRkMjllOGQ5YzdjNzZhNDNmNTEiLCJhY3RpdmVQbGFuIjoiRlJFRV9GT1JFVkVSIiwiaWF0IjoxNzY0NzczMzMwfQ.djrSFMp5O80fEmq1lRlBH__DibjdZa3Du45x2kOLd8g';

const phoneNumbers = [
  '+918595662378',  // +91 8595 662378
  '+917013966598'   // +91 7013 966598
];

const campaignName = 'user';

async function sendCampaign(phoneNumber) {
  const payload = {
    apiKey: API_KEY,
    campaignName: campaignName,
    destination: phoneNumber,
    userName: 'Stratnova Technologies LLP',
    templateParams: [],
    source: 'new-landing-page form',
    media: {
      url: 'https://d3jt6ku4g6z5l8.cloudfront.net/IMAGE/6353da2e153a147b991dd812/4958901_highanglekidcheatingschooltestmin.jpg',
      filename: 'sample_media'
    },
    buttons: [],
    carouselCards: [],
    location: {},
    attributes: {},
    paramsFallbackValue: {}
  };

  try {
    console.log(`\n📤 Sending campaign "${campaignName}" to ${phoneNumber}...`);
    
    const response = await fetch(AISENSY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Success for ${phoneNumber}:`, JSON.stringify(result, null, 2));
    } else {
      console.error(`❌ Failed for ${phoneNumber}:`, JSON.stringify(result, null, 2));
    }
    
    return { phoneNumber, success: response.ok, result };
  } catch (error) {
    console.error(`❌ Error sending to ${phoneNumber}:`, error.message);
    return { phoneNumber, success: false, error: error.message };
  }
}

async function sendToAll() {
  console.log(`🚀 Sending campaign "${campaignName}" to ${phoneNumbers.length} user(s)...\n`);
  
  // Remove duplicates
  const uniquePhones = [...new Set(phoneNumbers)];
  console.log(`📱 Phone numbers: ${uniquePhones.join(', ')}\n`);
  
  const results = [];
  for (const phone of uniquePhones) {
    const result = await sendCampaign(phone);
    results.push(result);
    // Small delay between sends
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 Summary:');
  console.log('='.repeat(60));
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(60));
  
  return results;
}

// Run
sendToAll().catch(console.error);


import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchLoveUsersPhones() {
  console.log('🔍 Fetching phone numbers of users who asked love/marriage questions...\n');

  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp-campaign', {
      body: {
        dryRun: true,
        useCategoryBased: true,
        filterCategory: 'Love'
      }
    });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('📊 Love Life & Marriage Users Analysis');
    console.log('============================================================');
    console.log(`✅ Total unique users who asked about love/marriage: ${data.total || 0}`);
    console.log(`📋 Filtered category: ${data.filterCategory || 'Love'}`);
    
    if (data.recipients && data.recipients.length > 0) {
      console.log('\n📱 Phone Numbers List:');
      console.log('============================================================');
      
      // Display all phone numbers
      data.recipients.forEach((user, index) => {
        console.log(`${String(index + 1).padStart(4, ' ')}. ${user.phone_number.padEnd(15)} | ${user.name.padEnd(25)} | ${user.category || 'Love'}`);
      });
      
      console.log('\n============================================================');
      console.log(`✅ Total phone numbers: ${data.recipients.length}`);
      
      // Export as JSON array for easy copy-paste
      const phoneNumbers = data.recipients.map(u => u.phone_number);
      console.log('\n📋 Phone Numbers (JSON array):');
      console.log(JSON.stringify(phoneNumbers, null, 2));
      
      // Export as comma-separated
      console.log('\n📋 Phone Numbers (comma-separated):');
      console.log(phoneNumbers.join(', '));
      
    } else {
      console.log('\n⚠️  No recipients found');
    }
    
  } catch (error) {
    console.error('❌ Network or script error:', error);
  }
}

fetchLoveUsersPhones();


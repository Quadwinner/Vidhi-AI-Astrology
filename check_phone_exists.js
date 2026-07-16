import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkPhoneExists() {
  const phoneToCheck = '7068901646'; // Without + sign
  const phoneWithPlus = '+917068901646';
  const phoneVariations = [
    phoneToCheck,
    phoneWithPlus,
    `91${phoneToCheck}`,
    `+91${phoneToCheck}`,
    phoneToCheck.replace(/\s+/g, '')
  ];

  console.log(`🔍 Checking if ${phoneWithPlus} exists in database...\n`);

  // Check WhatsApp sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('whatsapp_sessions')
    .select('phone_number, user_id, created_at, last_interaction_at')
    .or(`phone_number.eq.${phoneWithPlus},phone_number.eq.${phoneToCheck},phone_number.ilike.%${phoneToCheck}%`);

  console.log('📱 WhatsApp Sessions:');
  if (sessions && sessions.length > 0) {
    sessions.forEach(s => {
      console.log(`   ✅ Found: ${s.phone_number} (User ID: ${s.user_id}, Last interaction: ${s.last_interaction_at})`);
    });
  } else {
    console.log('   ❌ Not found in whatsapp_sessions');
  }

  // Check users table
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, phone_number, msg91_phone_number, email')
    .or(`phone_number.ilike.%${phoneToCheck}%,msg91_phone_number.ilike.%${phoneToCheck}%`);

  console.log('\n👤 Users Table:');
  if (users && users.length > 0) {
    users.forEach(u => {
      console.log(`   ✅ Found: phone_number=${u.phone_number}, msg91_phone=${u.msg91_phone_number}, email=${u.email}`);
    });
  } else {
    console.log('   ❌ Not found in users table');
  }

  // Check message logs
  const { data: sessionsForLogs } = await supabase
    .from('whatsapp_sessions')
    .select('id, phone_number')
    .or(`phone_number.eq.${phoneWithPlus},phone_number.eq.${phoneToCheck},phone_number.ilike.%${phoneToCheck}%`);

  if (sessionsForLogs && sessionsForLogs.length > 0) {
    const sessionIds = sessionsForLogs.map(s => s.id);
    const { data: logs, error: logsError } = await supabase
      .from('whatsapp_message_logs')
      .select('*')
      .in('session_id', sessionIds)
      .limit(5);

    console.log('\n💬 Message Logs:');
    if (logs && logs.length > 0) {
      console.log(`   ✅ Found ${logs.length} messages`);
      logs.forEach(log => {
        console.log(`      - ${log.sender_type}: ${log.message_content?.substring(0, 50)}...`);
      });
    } else {
      console.log('   ❌ No message logs found');
    }
  }

  console.log('\n📊 Summary:');
  const hasSession = sessions && sessions.length > 0;
  const hasUser = users && users.length > 0;
  
  if (hasSession || hasUser) {
    console.log(`   ✅ Phone number EXISTS in database`);
    console.log(`   ✅ Should be able to send template messages`);
  } else {
    console.log(`   ❌ Phone number NOT FOUND in database`);
    console.log(`   ⚠️  User needs to contact your WhatsApp bot first`);
    console.log(`   💡 Solution: Have ${phoneWithPlus} send a message to your WhatsApp bot`);
  }
}

checkPhoneExists();


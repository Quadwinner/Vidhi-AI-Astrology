// Load environment variables from .env if available
require('dotenv').config()

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://ieakxiipnpwvyvpsjnkl.supabase.co'
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllYWt4aWlwbnB3dnl2cHNqbmtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxOTA4NzcsImV4cCI6MjA3MDc2Njg3N30.R_seea1Eefbitn2ZI-ye0oASLsoazA7lynGTk7B1pH4'

async function checkAllPhoneCounts() {
  try {
    console.log('📊 Checking Phone Numbers from All Sources\n')
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        dryRun: true,
        useCategoryBased: true,
        filterCategory: 'Love'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    
    console.log('=' .repeat(70))
    console.log('📱 PHONE NUMBER EXTRACTION SUMMARY')
    console.log('=' .repeat(70))
    console.log(`\n✅ Total unique phone numbers found: ${result.total}`)
    console.log(`📋 Filtered category: ${result.filterCategory || 'Love'}`)
    
    if (result.recipients && result.recipients.length > 0) {
      console.log(`\n📝 Sources:`)
      console.log(`   • whatsapp_sessions`)
      console.log(`   • users.phone_number`)
      console.log(`   • users.msg91_phone_number`)
      console.log(`   • whatsapp_message_logs (via session join)`)
      
      console.log(`\n📞 Sample Phone Numbers (first 20):`)
      console.log('-'.repeat(70))
      result.recipients.slice(0, 20).forEach((user, idx) => {
        console.log(`${String(idx + 1).padStart(3)}. ${user.phone_number.padEnd(18)} | ${user.name.padEnd(20)} | ${user.category || 'Love'}`)
      })
      
      if (result.recipients.length > 20) {
        console.log(`\n... and ${result.recipients.length - 20} more`)
      }
      
      console.log(`\n✅ Total: ${result.recipients.length} phone numbers ready for campaign`)
    } else {
      console.log('\n⚠️  No users found matching love/marriage category')
    }
    
    console.log('\n' + '=' .repeat(70))
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

checkAllPhoneCounts()


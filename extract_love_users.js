// Load environment variables from .env if available
require('dotenv').config()

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://ieakxiipnpwvyvpsjnkl.supabase.co'
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllYWt4aWlwbnB3dnl2cHNqbmtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxOTA4NzcsImV4cCI6MjA3MDc2Njg3N30.R_seea1Eefbitn2ZI-ye0oASLsoazA7lynGTk7B1pH4'

async function extractLoveUsers() {
  try {
    console.log('🔍 Extracting users with love/marriage questions...\n')
    
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
    
    console.log('📊 Love Life & Marriage Users Analysis')
    console.log('=' .repeat(60))
    console.log(`✅ Total unique users who asked about love/marriage: ${result.total}`)
    console.log(`📱 Filtered category: ${result.filterCategory || 'Love'}`)
    
    if (result.recipients && result.recipients.length > 0) {
      console.log(`\n📋 Sample Users (first 10):`)
      console.log('=' .repeat(60))
      
      result.recipients.slice(0, 10).forEach((user, idx) => {
        console.log(`\n${idx + 1}. Phone: ${user.phone_number}`)
        console.log(`   Name: ${user.name}`)
        console.log(`   User ID: ${user.user_id || 'N/A'}`)
        console.log(`   Category: ${user.category || 'Love'}`)
        console.log('-'.repeat(60))
      })
      
      console.log(`\n📈 Full List:`)
      console.log('=' .repeat(60))
      console.log(JSON.stringify(result.recipients, null, 2))
      
      console.log(`\n✅ Total users found: ${result.recipients.length}`)
    } else {
      console.log('\n⚠️  No users found matching love/marriage category')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

extractLoveUsers()


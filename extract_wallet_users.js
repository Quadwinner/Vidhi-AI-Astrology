require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ieakxiipnpwvyvpsjnkl.supabase.co'
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllYWt4aWlwbnB3dnl2cHNqbmtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxOTA4NzcsImV4cCI6MjA3MDc2Njg3N30.R_seea1Eefbitn2ZI-ye0oASLsoazA7lynGTk7B1pH4'

const supabase = createClient(supabaseUrl, supabaseKey)

async function extractUsersWithWalletBalance() {
  try {
    console.log('Fetching users with wallet balance > 10...\n')

    // Query users with wallet_balance > 10
    const { data, error, count } = await supabase
      .from('users')
      .select('id, email, wallet_balance, currency_code, coin_balance, plan_tier, subscription_status, country, updated_at', { count: 'exact' })
      .gt('wallet_balance', 10)
      .order('wallet_balance', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return
    }

    console.log(`Total users with wallet balance > 10: ${count}\n`)
    console.log('Users data:')
    console.table(data)

    // Calculate summary statistics
    if (data && data.length > 0) {
      const totalBalance = data.reduce((sum, user) => sum + (user.wallet_balance || 0), 0)
      const avgBalance = totalBalance / data.length
      const maxBalance = Math.max(...data.map(u => u.wallet_balance || 0))
      const minBalance = Math.min(...data.map(u => u.wallet_balance || 0))

      console.log('\nSummary Statistics:')
      console.log('-------------------')
      console.log(`Total Users: ${count}`)
      console.log(`Total Wallet Balance: ${totalBalance}`)
      console.log(`Average Wallet Balance: ${avgBalance.toFixed(2)}`)
      console.log(`Max Wallet Balance: ${maxBalance}`)
      console.log(`Min Wallet Balance: ${minBalance}`)

      // Group by currency
      const byCurrency = data.reduce((acc, user) => {
        const currency = user.currency_code || 'N/A'
        if (!acc[currency]) {
          acc[currency] = { count: 0, total: 0 }
        }
        acc[currency].count++
        acc[currency].total += user.wallet_balance || 0
        return acc
      }, {})

      console.log('\nBreakdown by Currency:')
      console.log('----------------------')
      console.table(byCurrency)
    }

    return { count, data }
  } catch (err) {
    console.error('Error:', err)
  }
}

// Run the function
extractUsersWithWalletBalance()


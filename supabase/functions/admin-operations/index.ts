import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      throw new Error('No authorization header')
    }

    // Verify the user is authenticated and is an admin
    const token = authorization.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin (allow shubhamkush012@gmail.com as emergency admin)
    const isEmergencyAdmin = user.email?.toLowerCase() === 'shubhamkush012@gmail.com'
    let isAdmin = isEmergencyAdmin

    if (!isEmergencyAdmin) {
      const { data: userData, error: adminError } = await supabaseClient
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (adminError || !userData?.is_admin) {
        throw new Error('Admin access required')
      }
      isAdmin = true
    }

    const { action, start_date, end_date, ...data } = await req.json()

    let result;

    switch (action) {
      case 'get_stats':
        // Get admin dashboard statistics with optional date filtering
        let usersQuery = supabaseClient.from('users').select('*', { count: 'exact', head: true })
        let chatsQuery = supabaseClient.from('chat_history').select('*', { count: 'exact', head: true })
        let callsQuery = supabaseClient.from('call_logs').select('*', { count: 'exact', head: true })

        // Apply date filters if provided
        if (start_date) {
          usersQuery = usersQuery.gte('updated_at', start_date)
          chatsQuery = chatsQuery.gte('created_at', start_date)
          callsQuery = callsQuery.gte('created_at', start_date)
        }

        const [
          { count: totalUsers },
          { count: totalBlogs },
          { count: activePrices },
          { count: totalSettings },
          { count: totalChats },
          { count: totalCalls }
        ] = await Promise.all([
          usersQuery,
          supabaseClient.from('blogs').select('*', { count: 'exact', head: true }),
          supabaseClient.from('prices').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabaseClient.from('settings').select('*', { count: 'exact', head: true }),
          chatsQuery,
          callsQuery
        ])

        result = {
          stats: {
            totalUsers: totalUsers || 0,
            totalBlogs: totalBlogs || 0,
            activePrices: activePrices || 0,
            totalSettings: totalSettings || 0,
            totalChats: totalChats || 0,
            totalCalls: totalCalls || 0
          }
        }
        break

      case 'get_user_analytics':
        // Get user analytics for admin dashboard with optional date filtering
        let analyticsQuery = supabaseClient
          .from('users')
          .select(`
            plan_tier,
            subscription_status,
            updated_at,
            coin_balance
          `)

        // Apply date filter if provided
        if (start_date) {
          analyticsQuery = analyticsQuery.gte('updated_at', start_date)
        }

        const { data: userAnalytics, error: analyticsError } = await analyticsQuery

        if (analyticsError) throw analyticsError

        // Process analytics data
        const analytics = {
          planDistribution: {} as Record<string, number>,
          subscriptionStatus: {} as Record<string, number>,
          newUsersLast30Days: 0,
          averageCoinBalance: 0
        }

        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        if (userAnalytics) {
          userAnalytics.forEach((user: any) => {
            // Plan distribution
            const planTier = user.plan_tier || 'free'
            analytics.planDistribution[planTier] = (analytics.planDistribution[planTier] || 0) + 1

            // Subscription status
            const subStatus = user.subscription_status || 'none'
            analytics.subscriptionStatus[subStatus] = (analytics.subscriptionStatus[subStatus] || 0) + 1

            // New users in last 30 days
            if (user.updated_at && new Date(user.updated_at) >= thirtyDaysAgo) {
              analytics.newUsersLast30Days++
            }
          })

          // Calculate average coin balance
          const totalBalance = userAnalytics.reduce((sum: number, user: any) => sum + (user.coin_balance || 0), 0)
          analytics.averageCoinBalance = Math.round(totalBalance / userAnalytics.length)
        }

        result = { analytics }
        break

      case 'export_data':
        // Export data for admin (blogs, users, prices)
        const { table, format } = data

        let exportData;
        switch (table) {
          case 'blogs':
            const { data: blogs } = await supabaseClient.from('blogs').select('*')
            exportData = blogs
            break
          case 'users':
            const { data: users } = await supabaseClient
              .from('users')
              .select('id, email, plan_tier, subscription_status, coin_balance, updated_at, is_admin')
            exportData = users
            break
          case 'prices':
            const { data: prices } = await supabaseClient.from('prices').select('*')
            exportData = prices
            break
          case 'settings':
            const { data: settings } = await supabaseClient.from('settings').select('*')
            exportData = settings
            break
          default:
            throw new Error('Invalid table for export')
        }

        result = {
          data: exportData,
          exportedAt: new Date().toISOString(),
          recordCount: exportData?.length || 0
        }
        break

      default:
        throw new Error('Invalid action')
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      },
    )

  } catch (error) {
    console.error('Admin operation error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      },
    )
  }
})
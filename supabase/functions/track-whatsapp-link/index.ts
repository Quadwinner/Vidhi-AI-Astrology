import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const trackingId = url.searchParams.get('id')
    const phone = url.searchParams.get('phone')
    const campaign = url.searchParams.get('campaign')
    const template = url.searchParams.get('template')
    const originalUrl = url.searchParams.get('url')

    if (!trackingId || !originalUrl) {
      return new Response('Missing required parameters', { status: 400, headers: corsHeaders })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user agent and IP
    const userAgent = req.headers.get('user-agent') || ''
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''

    // Find user_id from phone number if provided
    let userId: string | null = null
    if (phone) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .or(`phone_number.eq.${phone},msg91_phone_number.eq.${phone}`)
        .single()
      
      if (user) {
        userId = user.id
      }
    }

    // Log the click
    const clickData = {
      phone_number: phone || 'unknown',
      user_id: userId,
      campaign_name: campaign || 'unknown',
      template_name: template || null,
      original_url: originalUrl,
      user_agent: userAgent,
      ip_address: ipAddress
    }
    
    console.log(`[track-whatsapp-link] Attempting to log click:`, JSON.stringify(clickData, null, 2))
    
    const { data: insertData, error: insertError } = await supabase
      .from('whatsapp_link_clicks')
      .insert(clickData)
      .select()

    if (insertError) {
      console.error('[track-whatsapp-link] ❌ INSERT ERROR:', JSON.stringify(insertError, null, 2))
      console.error('[track-whatsapp-link] Error details:', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      })
      // Still redirect even if logging fails
    } else {
      console.log(`[track-whatsapp-link] ✅ Click tracked successfully:`, JSON.stringify(insertData, null, 2))
      console.log(`[track-whatsapp-link] Click: ${phone} -> ${campaign} -> ${originalUrl}`)
    }

    // Redirect to original URL
    return Response.redirect(originalUrl, 302)

  } catch (error) {
    console.error('Error in track-whatsapp-link:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


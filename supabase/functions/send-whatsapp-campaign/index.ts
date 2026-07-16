import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AISENSY_API_URL = 'https://backend.aisensy.com/campaign/t1/api/v2'

// Generate tracking URL for link clicks
function generateTrackingUrl(
  originalUrl: string,
  phoneNumber: string,
  campaignName: string,
  templateName: string,
  userId?: string
): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://ieakxiipnpwvyvpsjnkl.supabase.co'
  const trackingId = crypto.randomUUID()
  
  const params = new URLSearchParams({
    id: trackingId,
    phone: phoneNumber,
    campaign: campaignName,
    template: templateName,
    url: originalUrl
  })
  
  return `${supabaseUrl}/functions/v1/track-whatsapp-link?${params.toString()}`
}

// Check if a string is a URL
function isUrl(str: string): boolean {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

// Automatically track links in template params
function trackLinksInParams(
  templateParams: any[],
  paramsFallbackValue: Record<string, any>,
  phoneNumber: string,
  campaignName: string,
  templateName: string,
  userId?: string
): { templateParams: any[], paramsFallbackValue: Record<string, any> } {
  const trackedParams = [...templateParams]
  const trackedFallback = { ...paramsFallbackValue }
  
  console.log(`[trackLinksInParams] Input - templateParams:`, templateParams)
  console.log(`[trackLinksInParams] Input - paramsFallbackValue:`, paramsFallbackValue)
  
  // Check each param value for URLs in paramsFallbackValue
  for (const [key, value] of Object.entries(paramsFallbackValue)) {
    if (typeof value === 'string' && isUrl(value)) {
      console.log(`[trackLinksInParams] Found URL in paramsFallbackValue.${key}: ${value}`)
      // Replace URL with tracking URL
      const trackingUrl = generateTrackingUrl(
        value,
        phoneNumber,
        campaignName,
        templateName,
        userId
      )
      trackedFallback[key] = trackingUrl
      console.log(`[trackLinksInParams] Replaced with tracking URL: ${trackingUrl.substring(0, 100)}...`)
      
      // For AiSensy, if templateParams has '$link' or similar placeholder, replace it
      // Or if templateParams array position matches, update it
      for (let i = 0; i < trackedParams.length; i++) {
        const param = trackedParams[i]
        // Check if this is a link placeholder (like '$link', '{{link}}', etc.)
        if (typeof param === 'string' && (
          param.toLowerCase().includes('link') || 
          param === value ||
          param.includes(value)
        )) {
          trackedParams[i] = trackingUrl
          console.log(`[trackLinksInParams] Updated templateParams[${i}] to tracking URL`)
        }
      }
    }
  }
  
  // Also check templateParams array directly for URLs
  for (let i = 0; i < trackedParams.length; i++) {
    const param = trackedParams[i]
    if (typeof param === 'string' && isUrl(param)) {
      console.log(`[trackLinksInParams] Found URL in templateParams[${i}]: ${param}`)
      trackedParams[i] = generateTrackingUrl(
        param,
        phoneNumber,
        campaignName,
        templateName,
        userId
      )
      console.log(`[trackLinksInParams] Replaced templateParams[${i}] with tracking URL`)
    }
  }
  
  console.log(`[trackLinksInParams] Output - templateParams:`, trackedParams)
  console.log(`[trackLinksInParams] Output - paramsFallbackValue:`, trackedFallback)
  
  return { templateParams: trackedParams, paramsFallbackValue: trackedFallback }
}

// Category keywords mapping
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Love: [
    'love', 'boyfriend', 'girlfriend', 'partner', 'dating',
    'crush', 'affair', 'romance', 'romantic', 'ishq', 'pyar', 'pyaar', 'mohabbat',
    'breakup', 'break up', 'break-up', 'ex-', 'relationship',
    'compatibility', 'soulmate', 'prem', 'bf', 'gf'
  ],
  Marriage: [
    'marriage', 'marry', 'wedding', 'spouse', 'husband', 'wife',
    'shadi', 'shaadi', 'vivah', 'rishta', 'life partner',
    'propose', 'proposal', 'engagement', 'divorce',
    'married', 'matrimony', 'bride', 'groom'
  ],
  Career: ['career', 'job', 'work', 'profession', 'business', 'employment', 'salary', 'promotion', 'interview', 'office', 'colleague', 'boss', 'workplace'],
  Health: ['health', 'disease', 'illness', 'medicine', 'doctor', 'hospital', 'treatment', 'fitness', 'exercise', 'diet', 'wellness', 'surgery', 'pain'],
  Money: ['money', 'wealth', 'finance', 'income', 'salary', 'investment', 'property', 'business', 'profit', 'loss', 'financial', 'rich', 'poor', 'savings'],
  Spiritual: ['spiritual', 'karma', 'destiny', 'purpose', 'soul', 'god', 'prayer', 'meditation', 'enlightenment', 'moksha', 'dharma', 'past life', 'reincarnation']
}

// Map category to campaign template name (must match exact case in AiSensy)
const CATEGORY_CAMPAIGNS: Record<string, string> = {
  Love: 'AstroAuraAi_Love',        // Campaign name in AiSensy (matches working payload)
  Marriage: 'astroaura_marriage_marketing',  // Marriage-specific campaign
  Career: 'astroaura_career_marketing',      // Must match exact case in AiSensy
  Health: 'astroaura_health_marketing',      // Must match exact case in AiSensy
  Money: 'astroaura_money_marketing',        // Must match exact case in AiSensy
  Spiritual: 'astroaura_spiritual_marketing', // Must match exact case in AiSensy
  default: 'astroaura_marketing'             // Fallback template
}

// Function to categorize a question based on keywords
function categorizeQuestion(question: string): string {
  const lowerQuestion = question.toLowerCase()
  const categoryScores: Record<string, number> = {}

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const keyword of keywords) {
      if (lowerQuestion.includes(keyword)) {
        score++
      }
    }
    if (score > 0) {
      categoryScores[category] = score
    }
  }

  // Return category with highest score, or 'default' if no match
  const topCategory = Object.keys(categoryScores).reduce((a, b) => 
    categoryScores[a] > categoryScores[b] ? a : b, 'default'
  )

  return categoryScores[topCategory] > 0 ? topCategory : 'default'
}

// Function to get user's most common category from chat history
async function getUserCategory(supabase: any, userId: string): Promise<string> {
  const { data: chatHistory, error } = await supabase
    .from('chat_history')
    .select('message_content')
    .eq('user_id', userId)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(50) // Check last 50 questions

  if (error || !chatHistory || chatHistory.length === 0) {
    return 'default'
  }

  const categoryCounts: Record<string, number> = {}
  
  for (const msg of chatHistory) {
    const category = categorizeQuestion(msg.message_content || '')
    categoryCounts[category] = (categoryCounts[category] || 0) + 1
  }

  // Return most common category
  const topCategory = Object.keys(categoryCounts).reduce((a, b) => 
    categoryCounts[a] > categoryCounts[b] ? a : b, 'default'
  )

  return topCategory
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const aiSensyApiKey = Deno.env.get('AISENSY_API_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    const {
      campaignName,
      testMode = false,
      testPhone = null,
      useCategoryBased = false,
      dryRun = false,
      filterCategory = null
    } = await req.json()

    // If useCategoryBased is true, campaignName is ignored and we use category-specific templates
    if (!useCategoryBased && !dryRun && !campaignName) {
      return new Response(
        JSON.stringify({ error: 'campaignName is required (or set useCategoryBased=true)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let recipients: { phone_number: string; name: string; user_id?: string; category?: string }[] = []
    const phoneSet = new Set<string>()

    // NOTE: Approved marketing templates can be sent to users who:
    // 1. Have messaged your WhatsApp bot (24-hour window for free-form messages)
    // 2. Have opted in via website/email/SMS (can send approved templates anytime)
    // 3. Have your number saved and contacted you before (implied consent)
    // The 200 users who received campaigns yesterday likely opted in through website/email

    if (testMode && testPhone) {
      recipients = [{ phone_number: testPhone, name: 'Test User', category: 'default' }]
    } else {
      // 1. Get WhatsApp bot users
      const { data: sessions, error: sessionsError } = await supabase
        .from('whatsapp_sessions')
        .select('phone_number, user_id, user_data')

      if (sessionsError) {
        console.warn('Failed to fetch whatsapp_sessions:', sessionsError.message)
      }

      for (const s of sessions || []) {
        if (s.phone_number && !phoneSet.has(s.phone_number)) {
          phoneSet.add(s.phone_number)
          recipients.push({
            phone_number: s.phone_number,
            name: s.user_data?.profile_name || s.user_data?.name || 'User',
            user_id: s.user_id
          })
        }
      }

      // 2. Get users with phone_number (website login)
      const { data: usersWithPhone, error: usersPhoneError } = await supabase
        .from('users')
        .select('id, phone_number, email')
        .not('phone_number', 'is', null)

      if (usersPhoneError) {
        console.warn('Failed to fetch users phone_number:', usersPhoneError.message)
      }

      for (const u of usersWithPhone || []) {
        const phone = u.phone_number?.replace(/\s+/g, '')
        if (phone && !phoneSet.has(phone)) {
          phoneSet.add(phone)
          recipients.push({
            phone_number: phone,
            name: u.email?.split('@')[0] || 'User',
            user_id: u.id
          })
        }
      }

      // 3. Get users with msg91_phone_number (OTP login)
      const { data: usersWithMsg91, error: usersMsg91Error } = await supabase
        .from('users')
        .select('id, msg91_phone_number, email')
        .not('msg91_phone_number', 'is', null)

      if (usersMsg91Error) {
        console.warn('Failed to fetch users msg91_phone_number:', usersMsg91Error.message)
      }

      for (const u of usersWithMsg91 || []) {
        const phone = u.msg91_phone_number?.replace(/\s+/g, '')
        if (phone && !phoneSet.has(phone)) {
          phoneSet.add(phone)
          recipients.push({
            phone_number: phone,
            name: u.email?.split('@')[0] || 'User',
            user_id: u.id
          })
        }
      }

      // 4. Get phone numbers from whatsapp_message_logs (join with whatsapp_sessions)
      // First get distinct session_ids from message logs
      const { data: messageLogs, error: messageLogsError } = await supabase
        .from('whatsapp_message_logs')
        .select('session_id')

      if (messageLogsError) {
        console.warn('Failed to fetch whatsapp_message_logs:', messageLogsError.message)
      } else {
        console.log(`Found ${messageLogs?.length || 0} total message logs`)
      }

      // Get unique session IDs
      const uniqueSessionIds = [...new Set((messageLogs || []).map(log => log.session_id).filter(Boolean))]
      console.log(`Found ${uniqueSessionIds.length} unique session IDs from message logs`)

      // Fetch sessions for these IDs
      if (uniqueSessionIds.length > 0) {
        const { data: sessionsFromLogs, error: sessionsFromLogsError } = await supabase
          .from('whatsapp_sessions')
          .select('phone_number, user_id, user_data')
          .in('id', uniqueSessionIds)

        if (sessionsFromLogsError) {
          console.warn('Failed to fetch sessions from message logs:', sessionsFromLogsError.message)
        } else {
          console.log(`Found ${sessionsFromLogs?.length || 0} sessions from message logs`)
          
          let newFromLogs = 0
          for (const s of sessionsFromLogs || []) {
            if (s.phone_number && !phoneSet.has(s.phone_number)) {
              phoneSet.add(s.phone_number)
              newFromLogs++
              recipients.push({
                phone_number: s.phone_number,
                name: s.user_data?.profile_name || s.user_data?.name || 'User',
                user_id: s.user_id
              })
            }
          }
          console.log(`Added ${newFromLogs} new phone numbers from message logs`)
        }
      }

      console.log(`Found ${recipients.length} unique phone numbers from all sources`)

      // If category-based or dry run with filtering, determine category for each user
      if (useCategoryBased || dryRun || filterCategory) {
        console.log('Determining categories from chat history...')
        for (const recipient of recipients) {
          if (recipient.user_id) {
            recipient.category = await getUserCategory(supabase, recipient.user_id)
            console.log(`User ${recipient.phone_number}: ${recipient.category}`)
          } else {
            recipient.category = 'default'
          }
        }
      }
    }

    // If only fetching numbers (no send)
    if (dryRun) {
      const filtered = filterCategory
        ? recipients.filter((r) => (r.category || 'default') === filterCategory)
        : recipients

      return new Response(
        JSON.stringify({
          message: 'Dry run (no sends). Returning recipient list.',
          total: filtered.length,
          filterCategory: filterCategory || 'all',
          recipients: filtered.map((r) => ({
            phone_number: r.phone_number,
            name: r.name,
            category: r.category || 'default'
          }))
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const campaignType = useCategoryBased ? 'category-based templates' : `"${campaignName}"`
    console.log(`Sending ${campaignType} to ${recipients.length} recipients`)

    const results = {
      total: recipients.length,
      success: 0,
      failed: 0,
      errors: [] as string[],
      categoryBreakdown: {} as Record<string, number>
    }

    for (const recipient of recipients) {
      try {
        // Determine which campaign to use
        const finalCampaignName = useCategoryBased 
          ? (CATEGORY_CAMPAIGNS[recipient.category || 'default'] || CATEGORY_CAMPAIGNS.default)
          : campaignName

        // Track category breakdown
        if (useCategoryBased && recipient.category) {
          results.categoryBreakdown[recipient.category] = (results.categoryBreakdown[recipient.category] || 0) + 1
        }

        // Format phone number for AiSensy (keep + sign, remove spaces)
        const formattedPhone = recipient.phone_number.replace(/\s+/g, '')
        // Ensure it starts with + if not already
        const destinationPhone = formattedPhone.startsWith('+') ? formattedPhone : `+${formattedPhone}`
        
        const payload: any = {
          apiKey: aiSensyApiKey,
          campaignName: finalCampaignName,
          destination: destinationPhone,
          userName: recipient.name || 'Stratnova Technologies LLP',
          templateParams: [],
          source: 'new-landing-page form',
          buttons: [],
          carouselCards: [],
          location: {},
          attributes: {},
          paramsFallbackValue: {}
        }
        
        // Add image and template params for Love campaigns
        if (finalCampaignName === 'AstroAuraAi_Love' || finalCampaignName === 'astroaura_loves_marketing1' || finalCampaignName === 'Love_AuraAi') {
          payload.media = {
            url: 'https://ieakxiipnpwvyvpsjnkl.supabase.co/storage/v1/object/public/campaign-images/AA4_ad2%20(1).jpg',
            filename: 'love_campaign.jpg'
          }
          
          // Add template params for AstroAuraAi_Love template
          if (finalCampaignName === 'AstroAuraAi_Love') {
            const firstName = recipient.name?.split(' ')[0] || 'user'
            const originalLink = 'https://astroaura.ai/chat'
            
            // Generate tracking URL for the link
            const trackingUrl = generateTrackingUrl(
              originalLink,
              destinationPhone,
              finalCampaignName,
              'AstroAuraAi_Love',
              recipient.user_id
            )
            
            // Set template params with actual values (not placeholders)
            payload.templateParams = [firstName, trackingUrl]
            payload.paramsFallbackValue = {
              FirstName: firstName,
              link: trackingUrl // Use tracking URL in fallback too
            }
            
            console.log(`[send-whatsapp-campaign] AstroAuraAi_Love payload:`, {
              templateParams: payload.templateParams,
              paramsFallbackValue: payload.paramsFallbackValue,
              trackingUrl: trackingUrl.substring(0, 100) + '...'
            })
          }
        }
        
        // Automatically track ALL links in template params (works for ALL other templates)
        // Note: AstroAuraAi_Love is handled above, this is for other templates
        if (finalCampaignName !== 'AstroAuraAi_Love') {
          const tracked = trackLinksInParams(
            payload.templateParams,
            payload.paramsFallbackValue,
            destinationPhone,
            finalCampaignName,
            finalCampaignName,
            recipient.user_id
          )
          payload.templateParams = tracked.templateParams
          payload.paramsFallbackValue = tracked.paramsFallbackValue
        }
        
        console.log(`[Debug] Sending to AiSensy:`, JSON.stringify(payload, null, 2))

        const response = await fetch(AISENSY_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        const result = await response.json()
        console.log(`[Debug] AiSensy response for ${recipient.phone_number}:`, JSON.stringify(result, null, 2))
        console.log(`[Debug] HTTP Status: ${response.status}, Response OK: ${response.ok}`)

        // Check for errors first (even if HTTP status is OK)
        const hasError = result.error || result.statusCode || result.status === 'error' || result.status === 'failed' || 
                        (result.message && (result.message.toLowerCase().includes('error') || result.message.toLowerCase().includes('fail') || result.message.toLowerCase().includes('invalid')))
        
        // Check success - AiSensy API returns different formats
        // Some return: { success: "true" } or { success: true }
        // Some return: { status: "success" } or { message: "success" }
        // Some return: { error: "..." } on failure
        const isSuccess = response.ok && !hasError && (
          result.success === 'true' || 
          result.success === true || 
          result.status === 'success' ||
          result.status === 'sent' ||
          (result.message && (result.message.toLowerCase().includes('success') || result.message.toLowerCase().includes('sent'))) ||
          (result.data && result.data.status === 'success')
        )
        
        if (hasError) {
          console.error(`[Error] AiSensy returned error for ${recipient.phone_number}:`, JSON.stringify(result, null, 2))
        }

        if (isSuccess) {
          results.success++
          const categoryInfo = useCategoryBased ? ` (${recipient.category})` : ''
          console.log(`✅ Sent to ${recipient.phone_number}${categoryInfo}`)
        } else {
          results.failed++
          const errorMsg = result.message || result.error || result.data?.error || result.statusCode || JSON.stringify(result)
          
          // Check for WhatsApp policy errors
          const isPolicyError = errorMsg.toLowerCase().includes('healthy ecosystem') || 
                               errorMsg.toLowerCase().includes('not delivered') ||
                               errorMsg.toLowerCase().includes('opt-in') ||
                               errorMsg.toLowerCase().includes('24 hour')
          
          if (isPolicyError) {
            const policyMsg = `${recipient.phone_number}: WhatsApp policy error - User must message your bot within 24 hours or opt-in for marketing`
            results.errors.push(policyMsg)
            console.log(`⚠️  ${policyMsg}`)
          } else {
            results.errors.push(`${recipient.phone_number}: ${errorMsg}`)
            console.log(`❌ Failed for ${recipient.phone_number}:`, errorMsg)
          }
          console.log(`❌ Full response:`, JSON.stringify(result, null, 2))
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (err) {
        results.failed++
        results.errors.push(`${recipient.phone_number}: ${err.message}`)
        console.error(`❌ Error for ${recipient.phone_number}:`, err)
      }
    }

    console.log(`Campaign complete: ${results.success}/${results.total} sent`)

    return new Response(
      JSON.stringify({
        message: 'Campaign completed',
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Campaign error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


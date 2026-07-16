import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { render as renderSvgToPng } from 'https://deno.land/x/resvg_wasm@0.2.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TwilioWebhookData {
  MessageSid: string
  From: string
  To: string
  Body: string
  NumMedia?: string
  ProfileName?: string
  WaId: string
}

interface WhatsAppSession {
  id: string
  phone_number: string
  state: string
  user_data: any
  created_at: string
  updated_at: string
}

// --- CleverTap config (backend tracking for WhatsApp bot) ---
const CLEVERTAP_ACCOUNT_ID = Deno.env.get('CLEVERTAP_ACCOUNT_ID')
const CLEVERTAP_PASSCODE = Deno.env.get('CLEVERTAP_PASSCODE')
const CLEVERTAP_REGION = Deno.env.get('CLEVERTAP_REGION') || 'in1'
// For "global" region, use api.clevertap.com (no region prefix)
// For other regions, use {region}.api.clevertap.com
const CLEVERTAP_API_BASE = Deno.env.get('CLEVERTAP_API_BASE') || 
  (CLEVERTAP_REGION === 'global' 
    ? 'https://api.clevertap.com/1/upload'
    : `https://${CLEVERTAP_REGION}.api.clevertap.com/1/upload`)

async function trackCleverTapEvent(
  identity: string,
  eventName: string,
  eventProperties: Record<string, any> = {},
) {
  if (!CLEVERTAP_ACCOUNT_ID || !CLEVERTAP_PASSCODE) {
    return
  }

  const payload = {
    d: [
      {
        identity,
        type: 'event',
        evtName: eventName,
        ts: Math.floor(Date.now() / 1000),
        evtData: eventProperties,
      },
    ],
  }

  try {
    console.log(`[CleverTap] Sending event: ${eventName} to ${CLEVERTAP_API_BASE}`)
    const res = await fetch(CLEVERTAP_API_BASE, {
      method: 'POST',
      headers: {
        'X-CleverTap-Account-Id': CLEVERTAP_ACCOUNT_ID,
        'X-CleverTap-Passcode': CLEVERTAP_PASSCODE,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[CleverTap] Event upload failed (${res.status}):`, text)
      console.error(`[CleverTap] Account ID: ${CLEVERTAP_ACCOUNT_ID}, Region: ${CLEVERTAP_REGION}, API Base: ${CLEVERTAP_API_BASE}`)
    } else {
      const result = await res.json()
      console.log(`[CleverTap] Event tracked successfully: ${eventName}`, result)
    }
  } catch (err) {
    console.error('[CleverTap] Event tracking error:', err)
    console.error(`[CleverTap] Account ID: ${CLEVERTAP_ACCOUNT_ID}, Region: ${CLEVERTAP_REGION}, API Base: ${CLEVERTAP_API_BASE}`)
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse Twilio webhook data
    const formData = await req.formData()
    const twilioData: TwilioWebhookData = {
      MessageSid: formData.get('MessageSid') as string,
      From: formData.get('From') as string,
      To: formData.get('To') as string,
      Body: formData.get('Body') as string,
      NumMedia: formData.get('NumMedia') as string,
      ProfileName: formData.get('ProfileName') as string,
      WaId: formData.get('WaId') as string,
    }

    console.log('Received webhook:', twilioData)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Extract phone number (remove whatsapp: prefix)
    const phoneNumber = twilioData.From.replace('whatsapp:', '')
    const messageBody = twilioData.Body?.trim() || ''

    // Get or create session - safely check if it's brand new
    const { data: existingSession, error: existingSessionError } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('phone_number', phoneNumber)
      .maybeSingle()

    if (existingSessionError && existingSessionError.code !== 'PGRST116') {
      console.warn('Error checking existing session:', existingSessionError)
    }

    const isBrandNewSession = !existingSession
    let session = await getOrCreateSession(supabase, phoneNumber, twilioData.ProfileName)

    // Log the message
    await logMessage(supabase, session.id, 'user', messageBody, twilioData.MessageSid)
    await trackCleverTapEvent(phoneNumber, 'WhatsApp Message Received', {
      session_state: session.state,
      message_preview: messageBody.slice(0, 120),
    })

    // Check if we should send template (for new sessions or greeting state with greeting messages)
    const normalizedMessage = messageBody.toLowerCase().trim()
    // Check if message starts with common greetings (hi, hy, hey, hello, etc.)
    const isGreetingMessage = !messageBody || 
      normalizedMessage === 'hi' || 
      normalizedMessage === 'hy' || 
      normalizedMessage === 'hey' || 
      normalizedMessage === 'hii' ||
      normalizedMessage.startsWith('hi ') ||
      normalizedMessage.startsWith('hy ') ||
      normalizedMessage.startsWith('hey ')
    const isStartCommand = normalizedMessage === 'start' || normalizedMessage === 'quick start' || normalizedMessage === 'free chart+1 q&a'
    const isSupportCommand = normalizedMessage === 'support' || normalizedMessage === 'help' || normalizedMessage === 'hello'
    const isButtonResponse = ['1', '2', '3'].includes(normalizedMessage)
    // Send template for brand new sessions (unless they're already starting or going to support), or greeting state with greeting messages
    // Don't send template if user is responding with button numbers or support commands
    const shouldSendTemplate = !isButtonResponse && !isSupportCommand && ((isBrandNewSession && !isStartCommand) || (session.state === 'greeting' && isGreetingMessage))

    if (shouldSendTemplate) {
      // Send template message with buttons for greeting
      const templateSent = await sendAuraTemplate(phoneNumber)
      if (templateSent) {
        await logMessage(supabase, session.id, 'bot', 'Template greeting sent')
        await trackCleverTapEvent(phoneNumber, 'WhatsApp Message Sent', {
          session_state: session.state,
          message_type: 'template',
        })
        return new Response(null, {
          status: 200,
          headers: corsHeaders,
        })
      } else {
        console.warn('Template send failed, falling back to text greeting')
      }
    }

    // Handle the message based on current state and content
    const response = await handleMessage(supabase, session, messageBody)

    // Send response via Twilio (if not already sent by handler)
    if (response) {
      const messageSent = await sendTwilioMessage(phoneNumber, response)
      
      if (!messageSent) {
        console.error('Failed to send message to', phoneNumber)
      }
      
      // Log bot response
      await logMessage(supabase, session.id, 'bot', response)
      if (messageSent) {
        await trackCleverTapEvent(phoneNumber, 'WhatsApp Message Sent', {
          session_state: session.state,
          message_type: 'text',
          message_preview: response.slice(0, 120),
        })
      }
    }

    return new Response(null, { 
      status: 200, 
      headers: corsHeaders 
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Error processing webhook', { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})

async function getOrCreateSession(supabase: any, phoneNumber: string, profileName?: string): Promise<WhatsAppSession> {
  // Check for existing session
  const { data: existingSession } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single()

  if (existingSession) {
    return existingSession
  }

  // Create new session
  const { data: newSession } = await supabase
    .from('whatsapp_sessions')
    .insert({
      phone_number: phoneNumber,
      state: 'greeting',
      user_data: { profile_name: profileName }
    })
    .select()
    .single()

  return newSession
}

async function logMessage(supabase: any, sessionId: string, sender: string, content: string, messageId?: string) {
  await supabase
    .from('whatsapp_message_logs')
    .insert({
      session_id: sessionId,
      sender_type: sender,
      message_content: content,
      message_id: messageId
    })
}

async function handleMessage(supabase: any, session: WhatsAppSession, messageBody: string): Promise<string | null> {
  const normalizedMessage = messageBody.toLowerCase().trim()

  console.log(`Handling message "${messageBody}" for session state: ${session.state}`)

  // Handle reset commands (hi, hy, hey, restart, reset) - but NOT hello, that goes to support
  const isResetCommand = normalizedMessage === 'hi' || 
    normalizedMessage === 'hy' || 
    normalizedMessage === 'hey' || 
    normalizedMessage === 'hii' || 
    normalizedMessage.startsWith('hi ') ||
    normalizedMessage.startsWith('hy ') ||
    normalizedMessage.startsWith('hey ') ||
    normalizedMessage === 'restart' || 
    normalizedMessage === 'reset'
  
  if (isResetCommand) {
    // Reset session to greeting
    await updateSessionState(supabase, session.id, 'greeting', {})
    return await handleGreeting(supabase, session, messageBody)
  }

  // Handle support keywords (including "hello" button which should go to support)
  if (normalizedMessage === 'support' || normalizedMessage === 'help' || normalizedMessage === 'hello') {
    return await handleSupportMenu(supabase, session)
  }

  // Handle menu/back to main menu
  if (normalizedMessage === 'menu' || normalizedMessage === '0') {
    await updateSessionState(supabase, session.id, 'greeting', {})
    return await handleGreeting(supabase, session, messageBody)
  }

  // Handle button taps and start commands
  if (normalizedMessage === 'free chart+1 q&a' || normalizedMessage === 'start' || normalizedMessage === 'quick start' || normalizedMessage === '1') {
    // If in greeting state and user types "1", start birth chart flow
    if (session.state === 'greeting') {
      return await handleStartFlow(supabase, session)
    }
    // If in support menu and user types "1", check subscription
    if (session.state === 'support_menu') {
      return await handleSubscriptionCheck(supabase, session)
    }
    return await handleStartFlow(supabase, session)
  }

  // Handle button "2" - Support menu
  if (normalizedMessage === '2') {
    if (session.state === 'greeting') {
      return await handleSupportMenu(supabase, session)
    }
    if (session.state === 'support_menu') {
      return await handlePaymentHelp(supabase, session)
    }
    // If not in expected state, return null to avoid fallthrough
    return null
  }

  // Handle button "3" - Human support
  if (normalizedMessage === '3') {
    if (session.state === 'support_menu') {
      return `📞 *Connect with Support*

Our team will contact you within 24 hours.

Email: contact@astroaura.ai

Reply *MENU* to return`
    }
    // If not in support menu, return null
    return null
  }

  // Handle button "4" - Recharge wallet
  if (normalizedMessage === '4' || normalizedMessage === 'recharge' || normalizedMessage === 'recharge wallet') {
    if (session.state === 'support_menu') {
      return await handleRechargeWallet(supabase, session)
    }
    return null
  }

  // Handle messages based on current state
  switch (session.state) {
    case 'greeting':
      // Only show greeting if message is not a button response
      if (!['1', '2', '3'].includes(normalizedMessage)) {
        return await handleGreeting(supabase, session, messageBody)
      }
      return null
    
    case 'support_menu':
      // Route based on menu selection (already handled above, but keep as fallback)
      if (normalizedMessage === '1') {
        return await handleSubscriptionCheck(supabase, session)
      } else if (normalizedMessage === '2') {
        return await handlePaymentHelp(supabase, session)
      } else if (normalizedMessage === '3' || normalizedMessage === 'agent') {
        return `📞 *Connect with Support*

Our team will contact you within 24 hours.

Email: contact@astroaura.ai

Reply *MENU* to return`
      } else if (normalizedMessage === '4' || normalizedMessage === 'recharge') {
        return await handleRechargeWallet(supabase, session)
      }
      // If not a button response, show menu again
      if (!['1', '2', '3', '4'].includes(normalizedMessage)) {
        return await handleSupportMenu(supabase, session)
      }
      return null
    
    case 'awaiting_phone_verification':
      return await handlePhoneVerification(supabase, session, messageBody)
    
    case 'awaiting_recharge_verification':
      return await handleRechargeVerification(supabase, session, messageBody)
    
    case 'awaiting_recharge_amount':
      return await handleRechargeAmount(supabase, session, messageBody)
    
    case 'awaiting_name':
      return await handleNameInput(supabase, session, messageBody)
    
    case 'awaiting_dob':
      return await handleDOBInput(supabase, session, messageBody)
    
    case 'awaiting_time':
      return await handleTimeInput(supabase, session, messageBody)
    
    case 'awaiting_place':
      return await handlePlaceInput(supabase, session, messageBody)
    
    case 'generating_chart':
      return 'Please wait while I generate your chart... ⏳'
    
    case 'chart_ready':
      return await handleQuestionInput(supabase, session, messageBody)
    
    default:
      // Reset to greeting if unknown state
      await updateSessionState(supabase, session.id, 'greeting', {})
      return await handleGreeting(supabase, session, messageBody)
  }
}

async function handleStartFlow(supabase: any, session: WhatsAppSession): Promise<string> {
  // Update session state
  await updateSessionState(supabase, session.id, 'awaiting_name', {})
  
  return `Great! Let's create your personalized birth chart! 🌟

Please tell me your *full name*:`
}

async function handleGreeting(supabase: any, session: WhatsAppSession, message: string): Promise<string | null> {
  // Send greeting with buttons
  const sent = await sendTwilioMessageWithButtons(session.phone_number,
    `👋 Welcome to AstroAura!\n\nHow can I help you?`,
    ['Create free birth chart + 1 Q&A', 'Check subscription or get help']
  )
  if (sent) {
    await logMessage(supabase, session.id, 'bot', 'Welcome message with buttons sent')
  }
  return null // Already sent, don't send again
}

async function handleSupportMenu(supabase: any, session: WhatsAppSession): Promise<string | null> {
  await updateSessionState(supabase, session.id, 'support_menu', {})
  await trackCleverTapEvent(session.phone_number, 'Support Menu Opened', {
    session_state: session.state
  })
  
  // Send support menu with buttons (now includes recharge option)
  const sent = await sendTwilioMessageWithButtons(session.phone_number,
    `🛟 *AstroAura Support*\n\nHow can I help you today?`,
    ['Check my subscription status', 'Payment issue/failed transaction', 'Talk to human support', 'Recharge wallet']
  )
  if (sent) {
    await logMessage(supabase, session.id, 'bot', 'Support menu with buttons sent')
    await trackCleverTapEvent(session.phone_number, 'WhatsApp Message Sent', {
      session_state: 'support_menu',
      message_type: 'buttons',
    })
  }
  return null // Already sent, don't send again
}

async function handleSubscriptionCheck(supabase: any, session: WhatsAppSession): Promise<string> {
  await updateSessionState(supabase, session.id, 'awaiting_phone_verification', {
    action: 'check_subscription'
  })
  
  return `To check your subscription, please provide your registered:

📱 *Phone number* (with country code, e.g., +919876543210)
OR
📧 *Email address*`
}

async function handlePaymentHelp(supabase: any, session: WhatsAppSession): Promise<string> {
  await updateSessionState(supabase, session.id, 'awaiting_phone_verification', {
    action: 'payment_help'
  })
  
  return `I'll help you with payment issues.

First, please provide your registered:

📱 *Phone number* (with country code, e.g., +919876543210)
OR
📧 *Email address*`
}

async function handlePhoneVerification(
  supabase: any, 
  session: WhatsAppSession, 
  input: string
): Promise<string> {
  const trimmedInput = input.trim()
  const isEmail = trimmedInput.includes('@')
  const cleanPhone = trimmedInput.replace(/\s/g, '')
  const isPhone = /^\+?\d{10,15}$/.test(cleanPhone)
  
  if (!isEmail && !isPhone) {
    return `❌ Invalid format. Please provide:
📱 Phone number (e.g., +919876543210)
OR
📧 Email address (e.g., user@example.com)`
  }
  
  let query = supabase
    .from('users')
    .select('id, email, phone_number, msg91_phone_number, plan_tier, subscription_status, coin_balance, wallet_balance')
  
  if (isEmail) {
    query = query.eq('email', trimmedInput.toLowerCase())
  } else {
    query = query.or(`phone_number.eq.${cleanPhone},msg91_phone_number.eq.${cleanPhone}`)
  }
  
  const { data: user, error } = await query.maybeSingle()
  
  if (error || !user) {
    return `❌ No account found with this ${isEmail ? 'email' : 'phone number'}.

Please check and try again, or contact support if you need help.`
  }
  
  const userData = {
    ...session.user_data,
    verified_user_id: user.id,
    verified_email: user.email
  }
  
  const action = session.user_data.action
  if (action === 'check_subscription') {
    return await showSubscriptionStatus(supabase, session, user, userData)
  } else if (action === 'payment_help') {
    return await showPaymentHelp(supabase, session, user, userData)
  }
  
  await updateSessionState(supabase, session.id, 'support_menu', userData)
  return await handleSupportMenu(supabase, session)
}

async function showSubscriptionStatus(supabase: any, session: WhatsAppSession, user: any, userData: any): Promise<string> {
  const { data: subscription } = await supabase
    .from('users_subscriptions')
    .select(`
      *,
      prices (
        amount,
        currency,
        subscription_plans (
          plan_name,
          plan_tier
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  let message = `📊 *Subscription Status*\n\n`
  message += `📧 Email: ${user.email}\n`
  message += `🎯 Plan: *${user.plan_tier || 'Free'}*\n`
  message += `📈 Status: ${user.subscription_status || 'inactive'}\n\n`
  
  if (subscription) {
    const planName = subscription.prices?.subscription_plans?.plan_name || 'Unknown'
    const amount = subscription.prices?.amount || 0
    const currency = subscription.prices?.currency || 'INR'
    const periodEnd = new Date(subscription.current_period_end).toLocaleDateString('en-IN')
    
    message += `💳 Plan: ${planName}\n`
    message += `💰 Price: ${currency} ${amount}\n`
    message += `📅 Renews on: ${periodEnd}\n\n`
  }
  
  message += `📊 *Current Usage*\n`
  message += `💰 Wallet: ₹${(user.wallet_balance || 0) / 100}\n\n`
  message += `Reply *MENU* for more options`
  
  await updateSessionState(supabase, session.id, 'support_menu', userData)
  await trackCleverTapEvent(user.email || session.phone_number, 'Subscription Status Checked', {
    plan_tier: user.plan_tier,
    subscription_status: user.subscription_status
  })
  
  return message
}

async function showPaymentHelp(supabase: any, session: WhatsAppSession, user: any, userData: any): Promise<string> {
  const { data: failedPayments } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['failed', 'cancelled', 'pending'])
    .order('created_at', { ascending: false })
    .limit(3)
  
  let message = `💳 *Payment Help*\n\n`
  
  if (failedPayments && failedPayments.length > 0) {
    message += `Found ${failedPayments.length} recent failed payment(s):\n\n`
    
    failedPayments.forEach((payment, idx) => {
      const date = new Date(payment.created_at).toLocaleDateString('en-IN')
      const amount = payment.amount
      const currency = payment.currency.toUpperCase()
      message += `${idx + 1}. ${currency} ${amount} - ${payment.status} (${date})\n`
    })
    
    message += `\n*Common Solutions:*\n`
    message += `✅ Check if payment was deducted from bank\n`
    message += `✅ Try different payment method\n`
    message += `✅ Clear app cache and retry\n`
    message += `✅ Contact your bank if amount deducted\n\n`
    message += `💬 Need more help? Reply *AGENT* to talk to support team\n\n`
  } else {
    message += `✅ No failed payments found for your account.\n\n`
    message += `If you're experiencing payment issues:\n`
    message += `• Try a different payment method\n`
    message += `• Check your bank/card limits\n`
    message += `• Contact support: Reply *AGENT*\n\n`
  }
  
  message += `Reply *MENU* for more options`
  
  await updateSessionState(supabase, session.id, 'support_menu', userData)
  await trackCleverTapEvent(user.email || session.phone_number, 'Payment Help Requested', {
    failed_payments_count: failedPayments?.length || 0
  })
  
  return message
}

async function handleRechargeWallet(supabase: any, session: WhatsAppSession): Promise<string> {
  await updateSessionState(supabase, session.id, 'awaiting_recharge_verification', {
    action: 'recharge_wallet'
  })
  await trackCleverTapEvent(session.phone_number, 'Wallet Recharge Started', {
    source: 'whatsapp'
  })
  
  return `💰 *Wallet Recharge*

To recharge your wallet, please provide your registered:

📱 *Phone number* (with country code, e.g., +919876543210)
OR
📧 *Email address*`
}

async function handleRechargeVerification(
  supabase: any, 
  session: WhatsAppSession, 
  input: string
): Promise<string> {
  const trimmedInput = input.trim()
  const isEmail = trimmedInput.includes('@')
  const cleanPhone = trimmedInput.replace(/\s/g, '')
  const isPhone = /^\+?\d{10,15}$/.test(cleanPhone)
  
  if (!isEmail && !isPhone) {
    return `❌ Invalid format. Please provide:
📱 Phone number (e.g., +919876543210)
OR
📧 Email address (e.g., user@example.com)`
  }
  
  let query = supabase
    .from('users')
    .select('id, email, phone_number, msg91_phone_number, wallet_balance')
  
  if (isEmail) {
    query = query.eq('email', trimmedInput.toLowerCase())
  } else {
    query = query.or(`phone_number.eq.${cleanPhone},msg91_phone_number.eq.${cleanPhone}`)
  }
  
  const { data: user, error } = await query.maybeSingle()
  
  if (error || !user) {
    return `❌ No account found with this ${isEmail ? 'email' : 'phone number'}.

Please check and try again, or sign up at https://astroaura.ai/`
  }
  
  const userData = {
    ...session.user_data,
    verified_user_id: user.id,
    verified_email: user.email,
    current_wallet_balance: user.wallet_balance || 0
  }
  
  await updateSessionState(supabase, session.id, 'awaiting_recharge_amount', userData)
  
  const currentBalance = (user.wallet_balance || 0) / 100
  
  return `✅ Account verified!

📧 Email: ${user.email}
💰 Current Balance: ₹${currentBalance}

*Select recharge amount:*

1. ₹100
2. ₹250
3. ₹500
4. ₹1000

Or type a custom amount (min ₹10)`
}

async function handleRechargeAmount(
  supabase: any, 
  session: WhatsAppSession, 
  input: string
): Promise<string> {
  const normalizedInput = input.trim().toLowerCase()
  
  // Handle menu/back commands
  if (normalizedInput === 'menu' || normalizedInput === 'back' || normalizedInput === '0') {
    await updateSessionState(supabase, session.id, 'support_menu', session.user_data)
    await handleSupportMenu(supabase, session)
    return ''
  }
  
  let amount: number
  
  // Map button options to amounts
  const amountMap: Record<string, number> = {
    '1': 100,
    '2': 250,
    '3': 500,
    '4': 1000
  }
  
  if (amountMap[normalizedInput]) {
    amount = amountMap[normalizedInput]
  } else {
    // Parse custom amount (remove ₹ or Rs if present)
    const cleanedAmount = normalizedInput.replace(/[₹rs\s]/gi, '')
    amount = parseInt(cleanedAmount, 10)
    
    if (isNaN(amount) || amount < 10) {
      return `❌ Invalid amount. Please enter a valid amount (minimum ₹10).

*Select recharge amount:*
1. ₹100
2. ₹250
3. ₹500
4. ₹1000

Or type a custom amount (min ₹10)
Reply *MENU* to go back`
    }
    
    if (amount > 10000) {
      return `❌ Maximum recharge is ₹10,000. Please enter a smaller amount.

Reply *MENU* to go back`
    }
  }
  
  const userId = session.user_data?.verified_user_id
  if (!userId) {
    await updateSessionState(supabase, session.id, 'support_menu', {})
    return `❌ Session expired. Please start again.

Reply *MENU* to go back`
  }
  
  // Generate payment link using create-topup-session
  const paymentLink = await generateRechargePaymentLink(supabase, userId, amount, session.phone_number)
  
  if (!paymentLink) {
    await trackCleverTapEvent(session.phone_number, 'Wallet Recharge Failed', {
      amount,
      reason: 'payment_link_generation_failed'
    })
    return `❌ Sorry, unable to generate payment link. Please try again later or visit https://astroaura.ai/

Reply *MENU* to go back`
  }
  
  await updateSessionState(supabase, session.id, 'support_menu', {
    ...session.user_data,
    pending_recharge_amount: amount
  })
  
  await trackCleverTapEvent(session.phone_number, 'Wallet Recharge Link Sent', {
    amount,
    source: 'whatsapp'
  })
  
  return `💳 *Recharge ₹${amount}*

Click the link below to complete payment:

${paymentLink}

⏰ Link valid for 30 minutes

After payment, your wallet will be credited automatically.

Reply *MENU* for more options`
}

async function generateRechargePaymentLink(
  supabase: any,
  userId: string,
  amount: number,
  phoneNumber: string
): Promise<string | null> {
  try {
    // Create Razorpay payment link directly
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    
    if (!keyId || !keySecret) {
      console.error('[generateRechargePaymentLink] Razorpay credentials not configured')
      return null
    }
    
    const credentials = btoa(`${keyId}:${keySecret}`)
    const amountInPaise = amount * 100
    
    // Create Razorpay Payment Link
    const response = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        description: `AstroAura Wallet Recharge - ₹${amount}`,
        customer: {
          contact: phoneNumber
        },
        notify: {
          sms: false,
          email: false
        },
        reminder_enable: false,
        notes: {
          user_id: userId,
          topup_amount: String(amountInPaise),
          currency: 'INR',
          source: 'whatsapp',
          whatsapp_phone: phoneNumber
        },
        callback_url: Deno.env.get('SITE_URL') ? `${Deno.env.get('SITE_URL')}/payment-success?type=topup` : undefined,
        callback_method: 'get',
        expire_by: Math.floor(Date.now() / 1000) + 1800 // 30 minutes
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[generateRechargePaymentLink] Razorpay error:', response.status, errorText)
      return null
    }
    
    const data = await response.json()
    console.log('[generateRechargePaymentLink] Payment link created:', data.id, data.short_url)
    
    return data.short_url || null
  } catch (error) {
    console.error('[generateRechargePaymentLink] Exception:', error)
    return null
  }
}

async function handleNameInput(supabase: any, session: WhatsAppSession, name: string): Promise<string> {
  // Save name and move to next state
  const userData = { ...session.user_data, name: name.trim() }
  await updateSessionState(supabase, session.id, 'awaiting_dob', userData)

  return `Nice to meet you, ${name}! ✨

Now, please share your *birth date* in DD/MM/YYYY format.

For example: 15/08/1995`
}

async function handleDOBInput(supabase: any, session: WhatsAppSession, dob: string): Promise<string> {
  // Basic date validation
  const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/
  if (!datePattern.test(dob.trim())) {
    return `Please enter your birth date in DD/MM/YYYY format.

For example: 15/08/1995`
  }

  // Save DOB and move to next state
  const userData = { ...session.user_data, dob: dob.trim() }
  await updateSessionState(supabase, session.id, 'awaiting_time', userData)

  return `Perfect! 📅

Next, please share your *birth time*.

Format: HH:MM AM/PM (like 2:30 PM)
Or type *"unknown"* if you're not sure.`
}

async function handleTimeInput(supabase: any, session: WhatsAppSession, time: string): Promise<string> {
  // Save time and move to next state
  const userData = { ...session.user_data, time: time.trim() }
  await updateSessionState(supabase, session.id, 'awaiting_place', userData)

  return `Got it! 🕐

Finally, please share your *birth place*.

Format: City, Country
For example: Mumbai, India`
}

async function handlePlaceInput(supabase: any, session: WhatsAppSession, place: string): Promise<string> {
  const trimmedPlace = place.trim()
  const validationError = validateBirthPlaceInput(trimmedPlace)

  if (validationError) {
    await updateSessionState(supabase, session.id, 'awaiting_place', {
      ...session.user_data,
      place: trimmedPlace
    })
    return validationError
  }

  const userData = { ...session.user_data, place: trimmedPlace }
  await updateSessionState(supabase, session.id, 'generating_chart', userData)

  await sendTwilioMessage(session.phone_number, '✨ Creating your cosmic chart... Please wait a moment! 🔮')

  try {
    const chartAssets = await generateWhatsAppChartAssets(supabase, session.id, userData)

    if (chartAssets?.imageUrl) {
      await sendTwilioMessage(
        session.phone_number,
        '🌌 Here is your personalized birth chart!',
        chartAssets.imageUrl
      )
    }

    const chartData = {
      name: userData.name,
      dob: userData.dob,
      time: userData.time,
      place: chartAssets?.location?.originalPlace || userData.place,
      generated_at: new Date().toISOString(),
      chart_image_path: chartAssets?.storagePath,
      chart_image_bucket: chartAssets?.bucket,
      chart_image_url: chartAssets?.imageUrl
    }

    await supabase
      .from('whatsapp_sessions')
      .update({ 
        chart_data: chartData,
        chart_created: true,
        state: 'chart_ready'
      })
      .eq('id', session.id)

    return `Excellent! 🌍 I have all your details:

👤 *${chartData.name}*
📅 Born: ${chartData.dob}
🕐 Time: ${chartData.time}
📍 Place: ${chartData.place}

✨ *Your birth chart is ready!* 

🤖 You can now ask me *ONE astrology question* about your chart.

What would you like to know about your cosmic blueprint?`

  } catch (error) {
    console.error('Chart generation error:', error)
    const errorMessage = error instanceof Error ? error.message : ''

    if (errorMessage.includes('Location lookup failed') || errorMessage.includes('Unable to resolve the birth place')) {
      await updateSessionState(supabase, session.id, 'awaiting_place', userData)
      return `I couldn't find that location. Please enter your *birth place* again in this exact format:

City, Country (State optional)
For example: Mumbai, India`
    }

    await updateSessionState(supabase, session.id, 'chart_ready', userData)
    return `I have your details, but there was an issue generating the chart. 

You can still ask me a question about your birth details:

👤 *${userData.name}*
📅 Born: ${userData.dob}
🕐 Time: ${userData.time}
📍 Place: ${userData.place}

What would you like to know?`
  }
}

async function makeVedicastroRequest(endpoint: string, params: object, desc: string) {
  const apiKey = Deno.env.get('VEDICASTRO_API_KEY')
  if (!apiKey) {
    throw new Error('VEDICASTRO_API_KEY not configured')
  }
  
  const url = new URL(VEDICASTRO_API_BASE_URL + endpoint)
  const allParams: Record<string, any> = { api_key: apiKey, lang: 'en', ...params }
  Object.entries(allParams).forEach(([key, value]) => {
    url.searchParams.set(key, String(value))
  })

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) })
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[VedicAstro API Error] ${desc}: ${response.status} - ${errorText}`)
    throw new Error(`VedicAstro API failed for ${desc}: ${response.status}`)
  }

  const text = await response.text()
  if (text.includes('out of api calls') || text.includes('renew subscription')) {
    throw new Error('VedicAstro API quota exceeded')
  }

  try {
    const json = JSON.parse(text)
    return json.response || json
  } catch {
    return text
  }
}

async function fetchVedicAstroData(params: { dob: string; tob: string; lat: number; lon: number; tz: number }) {
  console.log('[fetchVedicAstroData] Fetching astro data with params:', params)
  
  const baseParams = {
    dob: params.dob,
    tob: params.tob,
    lat: params.lat,
    lon: params.lon,
    tz: params.tz
  }

  try {
    // Fetch multiple endpoints in parallel
    const [planetDetails, houses, yogas, mahadasha] = await Promise.all([
      makeVedicastroRequest('/horoscope/planet-details', baseParams, 'Planet Details').catch(() => null),
      makeVedicastroRequest('/horoscope/planets-in-houses', baseParams, 'Planets in Houses').catch(() => null),
      makeVedicastroRequest('/extended-horoscope/yoga-list', baseParams, 'Yogas').catch(() => null),
      makeVedicastroRequest('/dashas/maha-dasha', baseParams, 'Mahadasha').catch(() => null)
    ])

    console.log('[fetchVedicAstroData] Data fetched successfully')
    
    return {
      planets: planetDetails || {},
      houses: houses || [],
      yogas: yogas || [],
      dasha: mahadasha || []
    }
  } catch (error) {
    console.error('[fetchVedicAstroData] Error:', error)
    throw error
  }
}

function formatAstroDataForPrompt(astroData: any, name: string): string {
  return `Chart data for ${name}:\nPlanets: ${JSON.stringify(astroData.planets)}\nHouses: ${JSON.stringify(astroData.houses)}\nYogas: ${JSON.stringify(astroData.yogas)}`
}

type LLMProvider = 'anthropic' | 'openai' | 'google'

const LLM_PROVIDER_DEFAULTS: Record<LLMProvider, { apiKey: string; model: string }> = {
  anthropic: {
    apiKey: 'ANTHROPIC_API_KEY',
    model: 'claude-sonnet-4-5-20250929',
  },
  openai: {
    apiKey: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
  },
  google: {
    apiKey: 'GEMINI_API_KEY',
    model: 'gemini-2.0-flash-exp',
  },
}

async function callAnthropicChat(apiKey: string, model: string, systemPrompt: string, question: string): Promise<string> {
  console.log('[callAnthropicChat] Calling Anthropic API, model:', model)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
      max_tokens: 800
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[callAnthropicChat] API error:', response.status, error)
    throw new Error(`Anthropic API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const answer = data.content[0]?.text || 'No response generated'
  console.log('[callAnthropicChat] Response received, length:', answer.length)
  return answer
}

async function callOpenAIChat(apiKey: string, model: string, systemPrompt: string, question: string): Promise<string> {
  console.log('[callOpenAIChat] Calling OpenAI API, model:', model)
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      max_tokens: 800
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[callOpenAIChat] API error:', response.status, error)
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const answer = data.choices[0]?.message?.content || 'No response generated'
  console.log('[callOpenAIChat] Response received, length:', answer.length)
  return answer
}

async function callGoogleChat(apiKey: string, model: string, systemPrompt: string, question: string): Promise<string> {
  console.log('[callGoogleChat] Calling Google Gemini API, model:', model)
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `${systemPrompt}\n\nUser Question: ${question}`
        }]
      }],
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7,
      }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[callGoogleChat] API error:', response.status, error)
    throw new Error(`Google Gemini API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated'
  console.log('[callGoogleChat] Response received, length:', answer.length)
  return answer
}

function shouldRetryWithFallback(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (!message) return false
  return (
    message.includes('overload') ||
    message.includes('insufficient_quota') ||
    message.includes('exceeded') ||
    message.includes('429') ||
    message.includes('503') ||
    message.includes('timeout') ||
    message.includes('temporarily unavailable') ||
    message.includes('authentication_error') ||
    message.includes('invalid x-api-key') ||
    message.includes('401')
  )
}

async function generateLLMAnswerWithFallback(
  promptData: { api_provider: string | null; model_name: string | null; secret_name: string | null },
  systemPrompt: string,
  question: string,
): Promise<string> {
  const primaryProvider = (promptData.api_provider || 'anthropic').toLowerCase() as LLMProvider

  const orderedProviders: LLMProvider[] = [primaryProvider]
  ;(['google', 'openai', 'anthropic'] as LLMProvider[]).forEach((provider) => {
    if (!orderedProviders.includes(provider)) {
      orderedProviders.push(provider)
    }
  })

  const errors: string[] = []

  for (const provider of orderedProviders) {
    const defaults = LLM_PROVIDER_DEFAULTS[provider]
    const apiKeyName = provider === primaryProvider
      ? (promptData.secret_name || defaults.apiKey)
      : defaults.apiKey
    const modelName = provider === primaryProvider
      ? (promptData.model_name || defaults.model)
      : defaults.model

    if (!apiKeyName) {
      console.warn('[generateLLMAnswerWithFallback] Missing apiKeyName for provider', provider)
      continue
    }

    const apiKey = Deno.env.get(apiKeyName)
    if (!apiKey) {
      console.warn(`[generateLLMAnswerWithFallback] Skipping ${provider}, missing env ${apiKeyName}`)
      continue
    }

    try {
      console.log(`[generateLLMAnswerWithFallback] Attempting provider ${provider} with model ${modelName}`)
      if (provider === 'anthropic') {
        return await callAnthropicChat(apiKey, modelName, systemPrompt, question)
      }
      if (provider === 'openai') {
        return await callOpenAIChat(apiKey, modelName, systemPrompt, question)
      }
      if (provider === 'google') {
        return await callGoogleChat(apiKey, modelName, systemPrompt, question)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      errors.push(`${provider}: ${errMsg}`)
      console.error(`[generateLLMAnswerWithFallback] Provider ${provider} failed:`, errMsg)
      if (!shouldRetryWithFallback(err)) {
        throw err instanceof Error ? err : new Error(errMsg)
      }
      console.warn('[generateLLMAnswerWithFallback] Retriable error, continuing to next provider')
    }
  }

  throw new Error(`All LLM providers failed. Attempts: ${errors.join(' | ')}`)
}

async function handleQuestionInput(supabase: any, session: WhatsAppSession, question: string): Promise<string> {
  try {
    console.log('[handleQuestionInput] Processing question:', question)
    console.log('[handleQuestionInput] Session chart_data:', JSON.stringify(session.chart_data))
    
    const chartData = session.chart_data
    if (!chartData || !chartData.dob || !chartData.time || !chartData.place) {
      console.error('[handleQuestionInput] Missing chart data')
      return '❌ I need your birth chart first. Please restart by typing "START" to create your chart.'
    }

    // Send waiting message immediately
    const waitingMessage = '🔮 AstroAura is analyzing your chart... Please wait a moment! ⏳'
    await sendTwilioMessage(session.phone_number, waitingMessage)
    await logMessage(supabase, session.id, 'bot', waitingMessage)
    await trackCleverTapEvent(session.phone_number, 'WhatsApp Message Sent', {
      session_state: session.state,
      message_type: 'typing_indicator',
    })

    console.log('[handleQuestionInput] Getting location details...')
    // Get location details
    const locationDetails = await geocodeBirthPlace(chartData.place)
    console.log('[handleQuestionInput] Location details:', JSON.stringify(locationDetails))
    
    console.log('[handleQuestionInput] Fetching VedicAstro data...')
    // Fetch astrological data from VedicAstro API
    const astroData = await fetchVedicAstroData({
      dob: chartData.dob,
      tob: normalizeTimeInput(chartData.time).slice(0, 5),
      lat: locationDetails.lat,
      lon: locationDetails.lon,
      tz: locationDetails.timezoneOffsetHours
    })
    console.log('[handleQuestionInput] Astro data fetched successfully')

    // Get system prompt from database
    const PROMPT_NAME = 'text_chat_default'
    console.log('[handleQuestionInput] Fetching prompt from DB:', PROMPT_NAME)
    const { data: promptData, error: promptError } = await supabase
      .from('system_prompts')
      .select('prompt_text, api_provider, model_name, secret_name')
      .eq('prompt_name', PROMPT_NAME)
      .eq('is_active', true)
      .single()

    if (promptError || !promptData) {
      console.error('[handleQuestionInput] Failed to fetch prompt:', promptError)
      // Fallback response
  return `🔮 *Your Cosmic Answer:*

Based on your birth chart, I can see interesting planetary alignments that influence your personality and life path. 

✨ *Want more detailed readings?* 
Visit our website: https://astroaura.ai/`
    }

    console.log('[handleQuestionInput] Prompt fetched, provider:', promptData.api_provider)

    // Prepare system prompt
    let promptText = promptData.prompt_text
    try {
      const parsed = JSON.parse(promptText)
      if (parsed.system_prompt) promptText = parsed.system_prompt
    } catch {}

    const whatsappInstructions = `

CRITICAL FORMATTING RULES FOR WHATSAPP RESPONSES:
- You may reply in Hindi, English, or Hinglish depending on what feels most natural for the user.
- Keep tone warm, respectful, and professional. Be conversational without sounding casual.
- Use WhatsApp markdown: *bold* for headings, _italic_ for subtle emphasis, and • for bullet lists.
- Break content into short paragraphs (2-3 sentences). Add blank lines between sections.
- Include structured sections such as *Overall Energy*, *Timing*, *Guidance*, etc., when relevant.
- Keep total response under 1,200 words. Ensure every section ends with a complete sentence.
- End with a professional closing sentence that invites the user to continue the conversation.

DO NOT:
- Send unfinished thoughts or trailing sentences.
- Overuse emojis—sprinkle only where they add warmth.
- Repeat the exact same closing in every response.
`

    const systemPrompt = (promptText + whatsappInstructions)
      .replace(/{{PROFILE_NAME}}/g, chartData.name || 'User')
      .replace(/{{CURRENT_DATE}}/g, new Date().toDateString())
      .replace('{{ASTROLOGY_RULEBOOK_JSON}}', '{}')
      .replace('{{D1_PLANETS_JSON}}', JSON.stringify(astroData.planets || {}))
      .replace('{{HOUSES_JSON}}', JSON.stringify(astroData.houses || {}))
      .replace('{{YOGAS_JSON}}', JSON.stringify(astroData.yogas || []))
      .replace('{{DASHA_TIMELINE_JSON}}', JSON.stringify(astroData.dasha || []))

    console.log('[handleQuestionInput] Calling LLM, provider:', promptData.api_provider)
    const answer = await generateLLMAnswerWithFallback(promptData, systemPrompt, question)

    console.log('[handleQuestionInput] LLM response received, length:', answer.length)

    // Format response for WhatsApp
    const cleanedAnswer = formatWhatsAppAnswer(answer)
    const responseBody = `🔮 *Your Cosmic Answer:*

${cleanedAnswer}`
    const response = appendPromoLink(responseBody)

    // Mark as completed
    await updateSessionState(supabase, session.id, 'completed', { question: question.trim() })
    await trackCleverTapEvent(session.phone_number, 'WhatsApp Question Answered', {
      question: question.trim(),
      answer_length: response.length,
    })

    console.log('[handleQuestionInput] Response ready, sending...')
    return response

  } catch (error) {
    console.error('[handleQuestionInput] Error generating AI response:', error)
    console.error('[handleQuestionInput] Error stack:', error instanceof Error ? error.stack : error)
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
    if (message.includes('overload') || message.includes('insufficient_quota')) {
      return `⚠️ अभी सर्वर पर बहुत अधिक ट्रैफिक है, इसलिए मैं जवाब नहीं दे पा रहा हूँ। कृपया 30 सेकंड बाद दोबारा प्रयास करें या विस्तृत रीडिंग के लिए https://astroaura.ai/ पर जाएँ।`
    }
    return `❌ Sorry, I ran into a technical issue while generating your answer. Please try again in a moment or visit https://astroaura.ai/ for a full reading.`
  }
}

async function updateSessionState(supabase: any, sessionId: string, newState: string, userData: any) {
  await supabase
    .from('whatsapp_sessions')
    .update({ 
      state: newState, 
      user_data: userData,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)

  // Lightweight session state tracking in CleverTap (best-effort)
  try {
    const { data } = await supabase
      .from('whatsapp_sessions')
      .select('phone_number')
      .eq('id', sessionId)
      .single()

    if (data?.phone_number) {
      await trackCleverTapEvent(data.phone_number, 'WhatsApp Session State Changed', {
        new_state: newState,
      })
    }
  } catch (err) {
    console.warn('[CleverTap] Failed to track session state change:', err)
  }
}

function formatWhatsAppAnswer(rawAnswer: string): string {
  if (!rawAnswer) return ''

  const sectionified = rawAnswer
    .replace(/\r/g, '')
    .split('\n')
    .map(line => {
      const trimmed = line.trim()

      if (!trimmed) return ''
      if (/^[-–—]{3,}$/.test(trimmed)) return ''

      const headingMatch = trimmed.match(/^#{1,6}\s*(.+)$/)
      if (headingMatch) {
        return `*${headingMatch[1].trim()}*`
      }

      const colonHeadingMatch = trimmed.match(/^([A-Z][^:]{2,40}):\s*(.*)$/i)
      if (colonHeadingMatch && colonHeadingMatch[2].length > 0) {
        return `*${colonHeadingMatch[1].trim()}*\n${colonHeadingMatch[2].trim()}`
      }

      return trimmed
    })
    .join('\n')

  let cleaned = sectionified
    .replace(/[ \t]+\n/g, '\n')           // trim trailing spaces on lines
    .replace(/\n{3,}/g, '\n\n')           // limit consecutive blank lines
    .replace(/ {2,}/g, ' ')               // collapse multiple spaces
    .replace(/\s+([,.;!?])/g, '$1')       // remove spaces before punctuation
    .replace(/^\s*-\s+/gm, '• ')          // convert hyphen bullets to dot bullets
    .replace(/\*\s+/g, '*')               // ensure bold markers stick to text
    .replace(/\n\*(.+?)\*/g, match => `\n${match.trim()}`) // trim heading lines
    .trim()

  // Ensure headings have a blank line after them
  cleaned = cleaned.replace(/(\*[^*\n]+\*)\n(?!\n)/g, '$1\n')
  cleaned = cleaned.replace(/(\*[^*\n]+\*)\n([^*\n])/g, (_, heading, bodyStart) => `${heading}\n${bodyStart}`)
  cleaned = cleaned.replace(/\n{2,}•/g, '\n•') // keep bullet lists compact

  // Ensure we don't leave a dangling unfinished sentence
  const lastSentenceEnd = Math.max(
    cleaned.lastIndexOf('.'),
    cleaned.lastIndexOf('!'),
    cleaned.lastIndexOf('?'),
    cleaned.lastIndexOf('।')
  )
  if (lastSentenceEnd > 0 && lastSentenceEnd < cleaned.length - 100) {
    cleaned = cleaned.substring(0, lastSentenceEnd + 1).trim()
  }

  return cleaned
}

function appendPromoLink(message: string): string {
  const promoBlock = `\n\n✨ *Want more detailed readings?*\nVisit our website: https://astroaura.ai/`
  const trimmed = message.trim()
  if (trimmed.includes('https://astroaura.ai')) {
    return trimmed
  }
  return `${trimmed}${promoBlock}`
}

function splitLongMessage(message: string, maxLength: number = 1500): string[] {
  if (message.length <= maxLength) {
    return [message]
  }

  const parts: string[] = []
  let currentPart = ''
  
  // Split by paragraphs first (double newlines)
  const paragraphs = message.split(/\n\n+/)
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed limit, start new part
    if (currentPart && (currentPart.length + paragraph.length + 2) > maxLength) {
      parts.push(currentPart.trim())
      currentPart = paragraph
    } else {
      currentPart += (currentPart ? '\n\n' : '') + paragraph
    }
    
    // If current part is still too long, split by sentences
    if (currentPart.length > maxLength) {
      const sentences = currentPart.split(/([.!?]\s+)/)
      let sentencePart = ''
      
      for (let i = 0; i < sentences.length; i += 2) {
        const sentence = sentences[i] + (sentences[i + 1] || '')
        
        if (sentencePart && (sentencePart.length + sentence.length) > maxLength) {
          parts.push(sentencePart.trim())
          sentencePart = sentence
        } else {
          sentencePart += sentence
        }
      }
      
      currentPart = sentencePart
    }
  }
  
  if (currentPart.trim()) {
    parts.push(currentPart.trim())
  }
  
  return parts.length > 0 ? parts : [message.substring(0, maxLength)]
}

async function sendTwilioMessageWithButtons(to: string, message: string, buttons: string[]): Promise<boolean> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumberRaw = Deno.env.get('TWILIO_WHATSAPP_NUMBER')

  if (!accountSid || !authToken || !fromNumberRaw) {
    console.error('Missing Twilio credentials')
    return false
  }

  const cleanedFromNumber = fromNumberRaw.replace(/^whatsapp:/, '')
  const fromNumber = `whatsapp:${cleanedFromNumber}`
  
  if (!fromNumber.startsWith('whatsapp:')) {
    console.error(`[sendTwilioMessageWithButtons] CRITICAL: From number missing whatsapp: prefix!`)
    return false
  }

  // Format message with buttons
  let formattedMessage = message + '\n\n'
  buttons.forEach((button, index) => {
    formattedMessage += `${index + 1}. ${button}\n`
  })

  return await sendTwilioMessage(to, formattedMessage)
}

async function sendTwilioMessage(to: string, message: string, mediaUrl?: string): Promise<boolean> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumberRaw = Deno.env.get('TWILIO_WHATSAPP_NUMBER')

  if (!accountSid || !authToken || !fromNumberRaw) {
    console.error('Missing Twilio credentials')
    return false
  }

  // Ensure From number has whatsapp: prefix to avoid SMS charges
  // Remove any existing whatsapp: prefix first, then add it to ensure consistency
  const cleanedFromNumber = fromNumberRaw.replace(/^whatsapp:/, '')
  const fromNumber = `whatsapp:${cleanedFromNumber}`
  
  // Log the From number to verify it has whatsapp: prefix (for debugging SMS charges)
  console.log(`[sendTwilioMessage] From number (raw env): ${fromNumberRaw}, cleaned: ${cleanedFromNumber}, final: ${fromNumber}`)
  
  // Validate the number format
  if (!cleanedFromNumber || cleanedFromNumber.length < 10) {
    console.error(`[sendTwilioMessage] CRITICAL: Invalid WhatsApp number format: ${cleanedFromNumber}`)
    return false
  }
  
  if (!fromNumber.startsWith('whatsapp:')) {
    console.error(`[sendTwilioMessage] CRITICAL: From number missing whatsapp: prefix! This will send as SMS!`)
    return false
  }

  // Split message if too long
  const messageParts = splitLongMessage(message)
  console.log(`[sendTwilioMessage] Message split into ${messageParts.length} parts`)

  const auth = btoa(`${accountSid}:${authToken}`)
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

  // Send each part with a delay between them
  for (let i = 0; i < messageParts.length; i++) {
    const part = messageParts[i]
  
  const body = new URLSearchParams({
    From: fromNumber,
    To: `whatsapp:${to}`,
      Body: part
  })

    // Only add media URL to the first message
    if (mediaUrl && i === 0) {
    body.append('MediaUrl', mediaUrl)
      console.log(`[sendTwilioMessage] Adding MediaUrl: ${mediaUrl.substring(0, 100)}...`)
  }

  try {
      // Log the actual request body being sent to Twilio (for debugging)
      console.log(`[sendTwilioMessage] Sending part ${i + 1}/${messageParts.length} - From: ${fromNumber}, To: whatsapp:${to}`)
      
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body
    })

    if (!response.ok) {
      const errorText = await response.text()
        console.error(`Twilio API error (part ${i + 1}/${messageParts.length}):`, errorText)
      return false
    } else {
      const result = await response.json()
        // Log full Twilio response to verify message type
        console.log(`[sendTwilioMessage] Part ${i + 1}/${messageParts.length} - SID: ${result.sid}, Status: ${result.status}, Direction: ${result.direction}, To: ${result.to}, From: ${result.from}, NumSegments: ${result.num_segments || 'N/A'}`)
        if (mediaUrl && i === 0) {
          console.log(`[sendTwilioMessage] Media message - MediaUrl: ${mediaUrl.substring(0, 80)}..., MediaCount: ${result.num_media || 'N/A'}, MediaSid: ${result.media_sid || 'N/A'}`)
        }
        
        // Critical check: Verify message was sent via WhatsApp, not SMS
        const isFromWhatsApp = result.from && result.from.startsWith('whatsapp:')
        const isToWhatsApp = result.to && result.to.startsWith('whatsapp:')
        
        if (!isFromWhatsApp) {
          console.error(`[sendTwilioMessage] ⚠️ CRITICAL: Message sent as SMS! From field: "${result.from}" (missing whatsapp: prefix)`)
        }
        if (!isToWhatsApp) {
          console.error(`[sendTwilioMessage] ⚠️ CRITICAL: Message sent as SMS! To field: "${result.to}" (missing whatsapp: prefix)`)
        }
        
        // num_segments can exist for WhatsApp too, but if both from/to don't have whatsapp: prefix, it's definitely SMS
        if (result.num_segments && result.num_segments > 0 && (!isFromWhatsApp || !isToWhatsApp)) {
          console.warn(`[sendTwilioMessage] ⚠️ WARNING: Message has ${result.num_segments} segments and missing whatsapp: prefix - this indicates SMS, not WhatsApp!`)
        } else if (result.num_segments && result.num_segments > 0 && isFromWhatsApp && isToWhatsApp) {
          // WhatsApp messages can have segments too, so this is normal
          console.log(`[sendTwilioMessage] ✓ Message sent via WhatsApp with ${result.num_segments} segment(s)`)
        }
        
      // Check if message has error code (even if API call succeeded)
      if (result.error_code) {
        console.error('Message has error code:', result.error_code, 'Status:', result.status)
        return false
      }
      }

      // Wait 500ms before sending next part (to avoid rate limiting)
      if (i < messageParts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
    }
  } catch (error) {
      console.error(`Error sending message part ${i + 1}:`, error)
    return false
  }
  }

  return true
}

async function sendTwilioTemplate(to: string, contentSid: string, contentVariables?: Record<string, string>, messagingServiceSid?: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumberRaw = Deno.env.get('TWILIO_WHATSAPP_NUMBER')

  if (!accountSid || !authToken || !fromNumberRaw) {
    console.error('Missing Twilio credentials')
    return null
  }

  // Ensure From number has whatsapp: prefix to avoid SMS charges
  const fromNumber = fromNumberRaw.startsWith('whatsapp:') ? fromNumberRaw : `whatsapp:${fromNumberRaw}`

  if (!contentSid) {
    console.error('ContentSid is required for template messages')
    return null
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  
  const body = new URLSearchParams({
    To: `whatsapp:${to}`,
    ContentSid: contentSid
  })

  if (messagingServiceSid) {
    body.append('MessagingServiceSid', messagingServiceSid)
    body.append('From', fromNumber)
  } else {
    body.append('From', fromNumber)
  }

  if (contentVariables && Object.keys(contentVariables).length > 0) {
    body.append('ContentVariables', JSON.stringify(contentVariables))
  }

  const auth = btoa(`${accountSid}:${authToken}`)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Twilio Template API error:', errorText)
      return null
    } else {
      const result = await response.json()
      console.log('Template message sent successfully:', result.sid)
      return result
    }
  } catch (error) {
    console.error('Error sending template message:', error)
    return null
  }
}

async function getTemplateImageUrl(supabase: any): Promise<string | null> {
  // Try to get image URL from environment variable first
  const envImageUrl = Deno.env.get('WHATSAPP_TEMPLATE_IMAGE_URL')
  if (envImageUrl) {
    console.log('[getTemplateImageUrl] Using image URL from environment variable')
    return envImageUrl
  }

  // Get from Supabase Storage using signed URL (works even if bucket is not public)
  const bucket = Deno.env.get('WHATSAPP_TEMPLATE_BUCKET') || 'astro-data'
  const imagePath = 'whatsapp-templates/AA_ad3.jpg'
  
  try {
    // Create a signed URL that's valid for 1 hour
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(imagePath, 60 * 60) // 1 hour expiry
    
    if (signedError) {
      console.error('[getTemplateImageUrl] Error creating signed URL:', signedError)
      // Fallback to public URL format
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${imagePath}`
      console.log('[getTemplateImageUrl] Falling back to public URL:', publicUrl)
      return publicUrl
    }
    
    if (signedUrlData?.signedUrl) {
      console.log('[getTemplateImageUrl] Generated signed URL successfully')
      return signedUrlData.signedUrl
    }
  } catch (error) {
    console.error('[getTemplateImageUrl] Exception getting image URL:', error)
    // Fallback to public URL format
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${imagePath}`
    console.log('[getTemplateImageUrl] Using fallback public URL:', publicUrl)
    return publicUrl
  }

  return null
}

async function sendAuraTemplate(to: string, contentVariables?: Record<string, string>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Send image first if available
  const imageUrl = await getTemplateImageUrl(supabase)
  if (imageUrl) {
    console.log(`[sendAuraTemplate] ✓ Image URL obtained: ${imageUrl.substring(0, 100)}...`)
    console.log(`[sendAuraTemplate] Sending template image first to ${to}`)
    
    // Send image with a small caption to ensure it's sent properly
    // WhatsApp requires either a body or mediaUrl, but having both is fine
    const imageSent = await sendTwilioMessage(to, '🌟 Welcome to AstroAura!', imageUrl)
    
    if (imageSent) {
      console.log(`[sendAuraTemplate] ✓ Image sent successfully, waiting before template...`)
      // Wait a bit before sending template to ensure image is received first
      await new Promise(resolve => setTimeout(resolve, 2000)) // Increased to 2 seconds
    } else {
      console.warn('[sendAuraTemplate] ⚠️ Failed to send image, continuing with template anyway')
    }
  } else {
    console.warn('[sendAuraTemplate] ⚠️ No image URL available, sending template only')
  }

  // Send template message
  console.log(`[sendAuraTemplate] Sending template message to ${to}`)
  const contentSid = Deno.env.get('WHATSAPP_TEMPLATE_CONTENT_SID') || 'HX4bc31770828628e52393e6b8428bf851'
  const templateResult = await sendTwilioTemplate(to, contentSid, contentVariables)
  console.log(`[sendAuraTemplate] Template send result:`, templateResult ? 'success' : 'failed')
  return templateResult
}

function normalizeTimeInput(rawTime?: string): string {
  if (!rawTime || rawTime.trim() === '') {
    return '12:00:00'
  }

  const normalized = rawTime.trim().toLowerCase()
  if (normalized === 'unknown') {
    return '12:00:00'
  }

  const ampmMatch = normalized.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)$/i)
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10)
    const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0
    const period = ampmMatch[3].toLowerCase()

    if (period === 'pm' && hours !== 12) {
      hours += 12
    } else if (period === 'am' && hours === 12) {
      hours = 0
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
  }

  const parts = normalized.split(':')
  const hours24 = parseInt(parts[0] || '0', 10)
  const minutes24 = parseInt(parts[1] || '0', 10)

  return `${hours24.toString().padStart(2, '0')}:${minutes24.toString().padStart(2, '0')}:00`
}

function validateBirthPlaceInput(place: string): string | null {
  if (!place || place.length < 3) {
    return `Please enter your *birth place* in the format City, Country.

For example: Mumbai, India`
  }

  if (!place.includes(',')) {
    return `Please include both the city and country separated by a comma.

Example: Mumbai, India`
  }

  const [city, country] = place.split(',').map(part => part.trim())
  if (!city || city.length < 2 || !country || country.length < 2) {
    return `Please make sure you provide both the city and the country.

Example: Mumbai, India`
  }

  return null
}

const VEDICASTRO_API_BASE_URL = "https://api.vedicastroapi.com/v3-json"

async function generateWhatsAppChartAssets(supabase: any, sessionId: string, userData: any) {
  if (!userData?.dob || !userData?.time || !userData?.place) {
    throw new Error('Incomplete birth details for chart generation')
  }

  const locationDetails = await geocodeBirthPlace(userData.place)
  const normalizedTime = normalizeTimeInput(userData.time)
  const timeForApi = normalizedTime.slice(0, 5)
  const svgString = await fetchNorthChartSvg({
    dob: userData.dob,
    tob: timeForApi,
    lat: locationDetails.lat,
    lon: locationDetails.lon,
    tz: locationDetails.timezoneOffsetHours
  })

  if (!svgString) {
    throw new Error('Chart SVG was empty')
  }

  const pngBytes = await renderSvgToPng(svgString)
  const uploadResult = await uploadChartImage(supabase, sessionId, pngBytes)

  return {
    imageUrl: uploadResult.signedUrl,
    storagePath: uploadResult.path,
    bucket: uploadResult.bucket,
    location: locationDetails,
    svg: svgString
  }
}

async function geocodeBirthPlace(place: string) {
  const apiKey = Deno.env.get('GEOAPIFY_API_KEY')
  if (!apiKey) {
    throw new Error('GEOAPIFY_API_KEY is not configured')
  }

  const url = new URL('https://api.geoapify.com/v1/geocode/search')
  url.searchParams.set('text', place)
  url.searchParams.set('limit', '1')
  url.searchParams.set('format', 'json')
  url.searchParams.set('apiKey', apiKey)

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
  if (!response.ok) {
    throw new Error(`Location lookup failed with status ${response.status}`)
  }

  const data = await response.json()
  const result = data?.results?.[0]
  if (!result) {
    throw new Error('Unable to resolve the birth place. Please provide a more specific location.')
  }

  const timezoneInfo = result.timezone || {}
  const stdOffsetSeconds = typeof timezoneInfo.offset_STD_seconds === 'number' ? timezoneInfo.offset_STD_seconds : 0
  const dstOffsetSeconds = typeof timezoneInfo.offset_DST_seconds === 'number' ? timezoneInfo.offset_DST_seconds : stdOffsetSeconds
  const effectiveOffset = timezoneInfo.is_dst ? dstOffsetSeconds : stdOffsetSeconds

  return {
    lat: Number(result.lat),
    lon: Number(result.lon),
    timezoneOffsetHours: Number((effectiveOffset / 3600).toFixed(2)),
    timezoneName: timezoneInfo.name || timezoneInfo.name_alt || null,
    originalPlace: result.formatted || place
  }
}

async function fetchNorthChartSvg(params: { dob: string; tob: string; lat: number; lon: number; tz: number }) {
  const apiKey = Deno.env.get('VEDICASTRO_API_KEY')
  if (!apiKey) {
    throw new Error('VEDICASTRO_API_KEY is not set')
  }

  const url = new URL(`${VEDICASTRO_API_BASE_URL}/horoscope/chart-image`)
  const queryParams: Record<string, string | number> = {
    api_key: apiKey,
    lang: 'en',
    div: 'D1',
    style: 'north',
    dob: params.dob,
    tob: params.tob,
    lat: params.lat,
    lon: params.lon,
    tz: params.tz
  }

  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, String(value))
  })

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) })
  if (!response.ok) {
    throw new Error(`VedicAstro chart-image failed with status ${response.status}`)
  }

  const text = await response.text()

  if (text.includes('out of api calls') || text.includes('renew subscription')) {
    throw new Error('VedicAstro API quota exceeded')
  }

  try {
    const json = JSON.parse(text)
    
    if (typeof json === 'string') {
      return json
    }

    const responsePayload = json?.response ?? json?.data ?? null
    if (typeof responsePayload === 'string') {
      return responsePayload
    }

    if (responsePayload && typeof responsePayload === 'object') {
      if (typeof responsePayload.svg === 'string' && responsePayload.svg.trim().length > 0) {
        return responsePayload.svg
      }
      if (typeof responsePayload.chart === 'string' && responsePayload.chart.trim().length > 0) {
        return responsePayload.chart
      }
      if (typeof responsePayload.image === 'string' && responsePayload.image.trim().length > 0) {
        return responsePayload.image
      }
    }

    console.warn('[fetchNorthChartSvg] Unexpected chart response shape:', json)
    return ''
  } catch {
    return text
  }
}

async function uploadChartImage(supabase: any, sessionId: string, pngBytes: Uint8Array) {
  const bucket = Deno.env.get('WHATSAPP_CHART_BUCKET') || 'astro-data'
  const path = `whatsapp_charts/${sessionId}/${Date.now()}.png`
  const binary = pngBytes.buffer.slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength)
  const blob = new Blob([binary], { type: 'image/png' })

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { upsert: true, contentType: 'image/png' })

  if (uploadError) {
    throw new Error(`Failed to upload chart image: ${uploadError.message}`)
  }

  const { data: signedUrlData, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60)

  if (signedError || !signedUrlData) {
    throw new Error(`Failed to create signed URL for chart image: ${signedError?.message}`)
  }

  return {
    signedUrl: signedUrlData.signedUrl,
    path,
    bucket
  }
}
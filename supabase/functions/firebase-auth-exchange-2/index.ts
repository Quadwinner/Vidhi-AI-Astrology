import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Received request body:', JSON.stringify(body))

    const { firebaseToken } = body

    if (!firebaseToken) {
      console.error('Missing firebaseToken in request body')
      throw new Error('Firebase token is required')
    }

    const FIREBASE_PROJECT_ID = 'astroauraai-b41b5'
    const FIREBASE_WEB_API_KEY = 'AIzaSyDq4UODoqgepbdqFu47_jtrZOo-JQkNfn0'
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`
    
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: firebaseToken })
    })

    if (!verifyResponse.ok) {
      const errorBody = await verifyResponse.text()
      console.error('Firebase token verification failed:', errorBody)
      throw new Error('Invalid Firebase token')
    }

    const verifyData = await verifyResponse.json()
    const firebaseUser = verifyData.users?.[0]

    if (!firebaseUser) {
      console.error('Firebase verification response missing user:', verifyData)
      throw new Error('Firebase user not found')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('APP_SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('APP_SUPABASE_SERVICE_ROLE_KEY')

    console.log('Environment check:', {
      hasUrl: Boolean(supabaseUrl),
      hasServiceRole: Boolean(supabaseServiceRoleKey),
      url: supabaseUrl?.substring(0, 30) + '...'
    })

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables', {
        hasUrl: Boolean(supabaseUrl),
        hasServiceRole: Boolean(supabaseServiceRoleKey),
        availableEnvVars: Object.keys(Deno.env.toObject()).filter(k => k.includes('SUPABASE'))
      })
      throw new Error('Supabase configuration missing')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    const email = firebaseUser.email
    const phoneNumber = firebaseUser.phoneNumber
    const firebaseUid = firebaseUser.localId
    const displayName = firebaseUser.displayName || email?.split('@')[0] || phoneNumber || 'User'
    const photoURL = firebaseUser.photoUrl || null

    if (!email && !phoneNumber) {
      throw new Error('Firebase user must have either email or phone number')
    }

    let supabaseUserId: string

    let existingUser = null
    let page = 1
    const pageSize = 1000

    while (!existingUser && page <= 5) {
      const { data: usersData, error: lookupError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: pageSize
      })
    
    if (lookupError) {
      console.error('Error looking up users:', lookupError)
      throw new Error('Failed to lookup existing users')
    }

      existingUser = usersData.users.find(
        u => (email && u.email === email) || 
             (phoneNumber && u.phone === phoneNumber) || 
             u.user_metadata?.firebase_uid === firebaseUid
    )

      if (usersData.users.length < pageSize) break
      page++
    }

    if (existingUser) {
      supabaseUserId = existingUser.id
      console.log('Found existing Supabase user:', supabaseUserId)
      
      const updateData: any = {
        user_metadata: {
          firebase_uid: firebaseUid,
          full_name: displayName,
          avatar_url: photoURL
        }
      }
      
      if (phoneNumber && !existingUser.phone) {
        updateData.phone = phoneNumber
      }
      
      await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, updateData)
    } else {
      const createUserData: any = {
        email_confirm: true,
        user_metadata: {
          firebase_uid: firebaseUid,
          full_name: displayName,
          avatar_url: photoURL
        }
      }
      
      if (email) {
        createUserData.email = email
      }
      
      if (phoneNumber) {
        createUserData.phone = phoneNumber
        createUserData.phone_confirm = true
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser(createUserData)

      if (createError) {
        if (createError.message?.includes('already been registered') || createError.code === 'email_exists') {
          let retryUser: any = null
          let retryPage = 1
          while (!retryUser && retryPage <= 5) {
            const { data: retryUsersData } = await supabaseAdmin.auth.admin.listUsers({
              page: retryPage,
              perPage: pageSize
            })
            retryUser = retryUsersData?.users?.find(
              (u: any) => (email && u.email === email) || (phoneNumber && u.phone === phoneNumber)
            )
            if (!retryUsersData?.users || retryUsersData.users.length < pageSize) break
            retryPage++
          }
          if (retryUser) {
            supabaseUserId = retryUser.id
            console.log('Found user after race condition:', supabaseUserId)
          } else {
            throw createError
          }
        } else {
        console.error('Error creating user:', createError)
        throw new Error('Failed to create Supabase user')
      }
      } else {
        supabaseUserId = newUser?.user?.id || ''
      console.log('Created new Supabase user:', supabaseUserId)
    }
    }

    const upsertUserData = {
      id: supabaseUserId,
      phone_number: phoneNumber || null,
      email: email || null
    }

    const { error: upsertError } = await supabaseAdmin
      .from('users')
      .upsert(upsertUserData, { onConflict: 'id' })

    if (upsertError) {
      console.warn('Failed to upsert phone_number in users table:', upsertError)
    }

    const linkType = email ? 'magiclink' : 'recovery'
    const linkIdentifier = email || phoneNumber

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: linkType,
      email: email || undefined,
      phone: phoneNumber || undefined,
      options: {
        redirectTo: Deno.env.get('APP_SITE_URL') || 'http://localhost:3000'
      }
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Link generation error:', linkError)
      throw new Error('Failed to generate authentication link')
    }

    return new Response(
      JSON.stringify({
        success: true,
        supabase_user_id: supabaseUserId,
        email: email || null,
        phone_number: phoneNumber || null,
        action_link: linkData.properties.action_link,
        token_hash: linkData.properties.hashed_token || null,
        type: linkType,
        message: 'Firebase user linked to Supabase successfully.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Firebase auth exchange error:', error)
    return new Response(
      JSON.stringify({ error: (error as any).message || 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
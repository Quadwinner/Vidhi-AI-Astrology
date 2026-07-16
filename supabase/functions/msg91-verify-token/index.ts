import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getCurrencyFromPhone(phone: string): string {
  if (!phone) return 'USD';
  const p = phone.startsWith('+') ? phone : `+${phone}`;
  if (p.startsWith('+91')) return 'INR';
  if (p.startsWith('+44')) return 'GBP';
  if (p.startsWith('+971')) return 'AED';
  return 'USD';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { access_token, phone, firstName, lastName, email, whatsappMarketingOptIn, variant_name = 'control' } = await req.json();

    if (!access_token) {
      return new Response(
        JSON.stringify({ error: 'Access token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get MSG91 auth key from environment
    const msg91AuthKey = Deno.env.get('MSG91_AUTH_KEY');
    if (!msg91AuthKey) {
      console.error('MSG91_AUTH_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'MSG91 authentication not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify access token with MSG91
    const verifyResponse = await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authkey: msg91AuthKey,
        'access-token': access_token,
      }),
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('MSG91 verification failed:', verifyResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired OTP token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const verifyData = await verifyResponse.json();
    console.log('MSG91 verification success:', verifyData);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize phone number (ensure it starts with +)
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

    // Try multiple phone formats for searching
    const phoneVariants = [
      normalizedPhone,
      phone,
      normalizedPhone.replace(/^\+/, ''),
      phone.replace(/^\+/, ''),
    ];

    // Try to find existing user by phone number
    let existingUser = null;
    let supabaseUserId: string | null = null;

    try {
      // Use admin API to list users and find by phone
      // Note: listUsers may be paginated, so we search through all pages
      let page = 1;
      let hasMore = true;

      while (hasMore && !existingUser) {
        const { data: usersList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });

        if (listError) {
          console.warn('Error listing users:', listError);
          break;
        }

        if (usersList?.users && usersList.users.length > 0) {
          existingUser = usersList.users.find((u: any) => {
            const userPhone = u.phone || u.user_metadata?.phone || u.user_metadata?.phone_number;
            return phoneVariants.some(variant => userPhone === variant || userPhone?.includes(variant));
          });

          // Check if there are more pages
          hasMore = usersList.users.length === 1000;
          page++;
        } else {
          hasMore = false;
        }
      }
    } catch (searchErr) {
      console.warn('Error searching for existing user:', searchErr);
      // Continue to try creating user
    }

    if (existingUser) {
      // User exists, use their ID
      supabaseUserId = existingUser.id;
      console.log('✓ Found existing user:', supabaseUserId);
    } else {
      // Try to create new user in Supabase Auth
      const userData: any = {
        phone: normalizedPhone,
        phone_confirmed: true,
        user_metadata: {},
      };

      // Generate temporary email if not provided (required for generateLink)
      // Format: phone+{sanitized_phone}@msg91.temp
      const sanitizedPhoneForEmail = normalizedPhone.replace(/[^0-9]/g, '');
      const tempEmail = email?.trim() || `phone+${sanitizedPhoneForEmail}@msg91.temp`;

      userData.email = tempEmail;
      userData.user_metadata.phone = normalizedPhone;
      userData.user_metadata.is_phone_only = !email; // Flag to indicate phone-only user

      if (firstName) userData.user_metadata.first_name = firstName.trim();
      if (lastName) userData.user_metadata.last_name = lastName.trim();
      if (email) {
        userData.user_metadata.email = email.trim();
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser(userData);

      if (createError) {
        // If user already exists, search again more thoroughly
        if (createError.message?.includes('already registered') ||
          createError.message?.includes('already exists') ||
          createError.message?.includes('User already registered')) {
          console.log('User creation failed - user already exists. Searching again...');

          // Search all pages more thoroughly
          let retryPage = 1;
          let retryFound = null;
          while (!retryFound && retryPage <= 10) {
            const { data: retryList } = await supabaseAdmin.auth.admin.listUsers({
              page: retryPage,
              perPage: 1000,
            });

            if (retryList?.users) {
              retryFound = retryList.users.find((u: any) => {
                const userPhone = u.phone || u.user_metadata?.phone || u.user_metadata?.phone_number;
                if (!userPhone) return false;
                return phoneVariants.some(variant => {
                  const uPhone = userPhone.toString().trim();
                  const variantStr = variant.toString().trim();
                  return uPhone === variantStr || uPhone.includes(variantStr) || variantStr.includes(uPhone);
                });
              });

              if (retryFound) {
                supabaseUserId = retryFound.id;
                console.log('✓ Found existing user after retry:', supabaseUserId);
                break;
              }

              if (retryList.users.length < 1000) break;
              retryPage++;
            } else {
              break;
            }
          }

          if (!supabaseUserId) {
            throw new Error('User exists but could not be located. Please contact support.');
          }
        } else {
          console.error('Error creating user:', createError);
          throw new Error(`Failed to create user account: ${createError.message}`);
        }
      } else {
        supabaseUserId = newUser?.user?.id || '';
        console.log('✓ Created new user:', supabaseUserId);
      }
    }

    // Ensure we have user ID before generating link
    // If we don't have it yet, try one more comprehensive search
    if (!supabaseUserId) {
      console.log('User ID not found, performing comprehensive search...');
      try {
        let searchPage = 1;
        let foundUser = null;

        while (!foundUser && searchPage <= 10) {
          const { data: searchList } = await supabaseAdmin.auth.admin.listUsers({
            page: searchPage,
            perPage: 1000,
          });

          if (searchList?.users && searchList.users.length > 0) {
            foundUser = searchList.users.find((u: any) => {
              const userPhone = u.phone || u.user_metadata?.phone || u.user_metadata?.phone_number;
              return phoneVariants.some(variant => {
                if (!userPhone) return false;
                const normalizedUserPhone = userPhone.toString().trim();
                const normalizedVariant = variant.toString().trim();
                return normalizedUserPhone === normalizedVariant ||
                  normalizedUserPhone.includes(normalizedVariant) ||
                  normalizedVariant.includes(normalizedUserPhone);
              });
            });

            if (foundUser) {
              supabaseUserId = foundUser.id;
              console.log('Found user ID in comprehensive search:', supabaseUserId);
              break;
            }

            if (searchList.users.length < 1000) break;
            searchPage++;
          } else {
            break;
          }
        }
      } catch (searchErr) {
        console.warn('Error in comprehensive user search:', searchErr);
      }
    }

    // If we still don't have user ID, we MUST have it to proceed
    if (!supabaseUserId) {
      console.error('Cannot proceed without user ID');
      return new Response(
        JSON.stringify({ error: 'User account not found. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store phone number in users table FIRST (before generating link)
    console.log('[PHONE_STORAGE] Attempting to store phone:', normalizedPhone, 'for user:', supabaseUserId);

    // First, check if user row exists in users table
    const { data: existingUserRow, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id, phone_number, msg91_phone_number, email, coin_balance, wallet_balance, currency_code')
      .eq('id', supabaseUserId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
      console.warn('[PHONE_STORAGE] Error checking existing user row:', checkError);
    }

    const currentTimestamp = new Date().toISOString();

    // Prepare upsert data - ensure we have all required fields
    const upsertUserData: any = {
      id: supabaseUserId,
      phone_number: normalizedPhone,
      msg91_phone_number: normalizedPhone,
    };


    // Scenario A: User ALREADY EXISTS - Preserve their data
    if (existingUserRow) {
      // SCENARIO A: User ALREADY EXISTS - Preserve their data
      console.log(`[MSG91 Verify] Existing user '${supabaseUserId}' found. Preserving wallet.`);
      upsertUserData.wallet_balance = existingUserRow.wallet_balance;
      upsertUserData.currency_code = existingUserRow.currency_code;
      upsertUserData.plan_tier = existingUserRow.plan_tier || 'free';
    } else {
      // SCENARIO B: NEW USER - Initialize with DYNAMIC Bonus
      console.log(`[MSG91 Verify] New user setup for variant '${variant_name}'...`);
      const detectedCurrency = getCurrencyFromPhone(normalizedPhone);
      upsertUserData.currency_code = detectedCurrency;

      let startBalance = 0;

      // 1. Attempt to find the price for the specific variant
      const { data: variantPriceData } = await supabaseAdmin
        .from('service_prices')
        .select('price_amount')
        .eq('service_key', 'chat_message')
        .eq('currency_code', detectedCurrency)
        .eq('variant_name', variant_name)
        .single();

      if (variantPriceData) {
        startBalance = variantPriceData.price_amount;
        console.log(`[MSG91 Verify] Found price for variant '${variant_name}': ${startBalance}`);
      } else {
        // 2. Fallback to the 'control' variant if the specific variant price is missing
        console.warn(`[MSG91 Verify] No 'chat_message' price found for variant '${variant_name}'. Falling back to 'control'.`);
        const { data: controlPriceData } = await supabaseAdmin
          .from('service_prices')
          .select('price_amount')
          .eq('service_key', 'chat_message')
          .eq('currency_code', detectedCurrency)
          .eq('variant_name', 'control')
          .single();

        if (controlPriceData) {
          startBalance = controlPriceData.price_amount;
          console.log(`[MSG91 Verify] Using fallback 'control' price: ${startBalance}`);
        } else {
          console.error(`[CRITICAL] Missing 'chat_message' price for currency '${detectedCurrency}' in both '${variant_name}' and 'control' variants.`);
          startBalance = 0;
        }
      }

      // 3. Set Initial Values
      upsertUserData.wallet_balance = startBalance;
      upsertUserData.coin_balance = 0; // Legacy coins are 0
      upsertUserData.plan_tier = 'free';
      upsertUserData.pricing_variant = variant_name; // <-- ADD THIS LINE
      console.log(`[New User Setup] Phone: ${normalizedPhone} -> Currency: ${detectedCurrency}, Dynamic Bonus: ${startBalance}`);
    }

    // Preserve existing plan_tier if user row exists
    if (existingUserRow && !existingUserRow.plan_tier) {
      upsertUserData.plan_tier = 'free';
    }

    if (email) {
      upsertUserData.email = email.trim();
      console.log('[PHONE_STORAGE] Also storing email:', email.trim());
    } else if (existingUserRow?.email) {
      // Preserve existing email if no new email provided
      upsertUserData.email = existingUserRow.email;
    }

    // Handle WhatsApp marketing opt-in
    if (whatsappMarketingOptIn === true) {
      upsertUserData.whatsapp_marketing_opt_in = true;
      upsertUserData.whatsapp_marketing_opt_in_date = currentTimestamp;
      upsertUserData.whatsapp_marketing_opt_in_source = 'website_signup';
      console.log('[WHATSAPP_OPT_IN] User opted in to WhatsApp marketing');
    } else if (existingUserRow?.whatsapp_marketing_opt_in) {
      // Preserve existing opt-in status if user already opted in
      upsertUserData.whatsapp_marketing_opt_in = existingUserRow.whatsapp_marketing_opt_in;
      upsertUserData.whatsapp_marketing_opt_in_date = existingUserRow.whatsapp_marketing_opt_in_date;
      upsertUserData.whatsapp_marketing_opt_in_source = existingUserRow.whatsapp_marketing_opt_in_source;
    }

    upsertUserData.updated_at = currentTimestamp;

    console.log('[PHONE_STORAGE] Upsert data:', {
      id: upsertUserData.id,
      phone_number: upsertUserData.phone_number,
      msg91_phone_number: upsertUserData.msg91_phone_number,
      has_email: !!upsertUserData.email,
      coin_balance: upsertUserData.coin_balance
    });

    // Check if phone number already exists for another user (unique constraint)
    const { data: phoneConflictCheck, error: conflictCheckError } = await supabaseAdmin
      .from('users')
      .select('id, phone_number')
      .eq('phone_number', normalizedPhone)
      .neq('id', supabaseUserId)
      .maybeSingle();

    if (phoneConflictCheck) {
      console.warn('[PHONE_STORAGE] ⚠️ Phone number already exists for another user:', {
        phone: normalizedPhone,
        existing_user_id: phoneConflictCheck.id,
        current_user_id: supabaseUserId
      });

      // Attempt to clear the conflicting phone number so we can reassign it
      try {
        const { error: clearConflictError } = await supabaseAdmin
          .from('users')
          .update({ phone_number: null, msg91_phone_number: null })
          .eq('id', phoneConflictCheck.id);

        if (clearConflictError) {
          console.error('[PHONE_STORAGE] ❌ Failed to clear conflicting phone number:', clearConflictError);
        } else {
          console.log('[PHONE_STORAGE] ✓ Cleared conflicting phone number from user:', phoneConflictCheck.id);
        }
      } catch (conflictCleanupErr) {
        console.error('[PHONE_STORAGE] ❌ Error while clearing conflicting phone number:', conflictCleanupErr);
      }
    }

    // Check for conflicts specifically in msg91_phone_number column
    const { data: msg91ConflictCheck } = await supabaseAdmin
      .from('users')
      .select('id, msg91_phone_number')
      .eq('msg91_phone_number', normalizedPhone)
      .neq('id', supabaseUserId)
      .maybeSingle();

    if (msg91ConflictCheck) {
      console.warn('[PHONE_STORAGE] ⚠️ msg91_phone_number already exists for another user:', {
        phone: normalizedPhone,
        existing_user_id: msg91ConflictCheck.id,
        current_user_id: supabaseUserId
      });

      try {
        const { error: clearMsg91ConflictError } = await supabaseAdmin
          .from('users')
          .update({ msg91_phone_number: null })
          .eq('id', msg91ConflictCheck.id);

        if (clearMsg91ConflictError) {
          console.error('[PHONE_STORAGE] ❌ Failed to clear msg91_phone_number conflict:', clearMsg91ConflictError);
        } else {
          console.log('[PHONE_STORAGE] ✓ Cleared msg91_phone_number conflict from user:', msg91ConflictCheck.id);
        }
      } catch (msg91ConflictErr) {
        console.error('[PHONE_STORAGE] ❌ Error while clearing msg91_phone_number conflict:', msg91ConflictErr);
      }
    }

    // Use UPDATE first if row exists, INSERT if not
    let storageSuccess = false;
    let finalResult: any = null;

    if (existingUserRow) {
      // Row exists - use UPDATE
      console.log('[PHONE_STORAGE] User row exists, using UPDATE...');
      const { data: updateResult, error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          phone_number: normalizedPhone,
          msg91_phone_number: normalizedPhone,
          updated_at: currentTimestamp,
          ...(email ? { email: email.trim() } : {})
        })
        .eq('id', supabaseUserId)
        .select('id, phone_number, email, coin_balance, plan_tier');

      if (updateError) {
        console.error('[PHONE_STORAGE] ❌ UPDATE failed:', {
          error: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint
        });
      } else {
        finalResult = updateResult;
        storageSuccess = true;
        console.log('[PHONE_STORAGE] ✓ Phone number updated successfully:', updateResult);
      }
    } else {
      // Row doesn't exist - use INSERT
      console.log('[PHONE_STORAGE] User row does not exist, using INSERT...');
      const { data: insertResult, error: insertError } = await supabaseAdmin
        .from('users')
        .insert(upsertUserData)
        .select('id, phone_number, email, coin_balance, plan_tier');

      if (insertError) {
        console.error('[PHONE_STORAGE] ❌ INSERT failed:', {
          error: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        });

        // If INSERT fails, maybe row was created by trigger - try UPDATE
        console.log('[PHONE_STORAGE] Retrying with UPDATE after failed INSERT...');
        const { data: retryUpdateResult, error: retryUpdateError } = await supabaseAdmin
          .from('users')
          .update({
            phone_number: normalizedPhone,
            msg91_phone_number: normalizedPhone,
            updated_at: currentTimestamp
          })
          .eq('id', supabaseUserId)
          .select('id, phone_number, msg91_phone_number, email');

        if (retryUpdateError) {
          console.error('[PHONE_STORAGE] ❌ Retry UPDATE also failed:', retryUpdateError);
        } else {
          finalResult = retryUpdateResult;
          storageSuccess = true;
          console.log('[PHONE_STORAGE] ✓ Phone number stored via retry UPDATE:', retryUpdateResult);
        }
      } else {
        finalResult = insertResult;
        storageSuccess = true;
        console.log('[PHONE_STORAGE] ✓ Phone number inserted successfully:', insertResult);
      }
    }

    if (!storageSuccess) {
      console.error('[PHONE_STORAGE] ❌❌❌ CRITICAL: Failed to store phone number after all attempts!', {
        user_id: supabaseUserId,
        phone: normalizedPhone,
        existing_row: existingUserRow
      });
    }

    // Get user email for generateLink (required by Supabase)
    // If user doesn't have email, create a temporary one
    let userEmail: string | null = null;
    try {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(supabaseUserId);
      userEmail = userData?.user?.email || null;

      // If user doesn't have email, create temporary email and update user
      if (!userEmail) {
        const sanitizedPhoneForEmail = normalizedPhone.replace(/[^0-9]/g, '');
        userEmail = `phone+${sanitizedPhoneForEmail}@msg91.temp`;

        // Update user with temporary email
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          supabaseUserId,
          { email: userEmail }
        );

        if (updateError) {
          console.warn('Failed to update user with temp email:', updateError);
        } else {
          console.log('Updated user with temporary email:', userEmail);
        }
      }

      console.log('User email for link generation:', userEmail);
    } catch (userErr) {
      console.warn('Error getting/updating user email:', userErr);
      // Fallback: create temp email
      const sanitizedPhoneForEmail = normalizedPhone.replace(/[^0-9]/g, '');
      userEmail = `phone+${sanitizedPhoneForEmail}@msg91.temp`;
    }

    // Generate magic link - Supabase requires email
    console.log('Generating login link for user:', supabaseUserId, 'email:', userEmail);
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail!, // Now we always have an email
      options: {
        redirectTo: Deno.env.get('APP_SITE_URL') || 'http://localhost:3000',
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Failed to generate login link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Failed to create login session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Verify phone number was stored (double-check and retry if needed)
    try {
      const { data: verifyUserData, error: verifyError } = await supabaseAdmin
        .from('users')
        .select('id, phone_number, msg91_phone_number, email, coin_balance, plan_tier, updated_at')
        .eq('id', supabaseUserId)
        .single();

      if (verifyError) {
        console.error('[PHONE_STORAGE] ❌ Could not verify storage:', {
          error: verifyError.message,
          user_id: supabaseUserId
        });
      } else {
        const phoneMatch = verifyUserData?.phone_number === normalizedPhone &&
          verifyUserData?.msg91_phone_number === normalizedPhone;
        console.log('[PHONE_STORAGE] ✓ Verification result:', {
          user_id: verifyUserData?.id,
          stored_phone: verifyUserData?.phone_number,
          stored_msg91_phone: verifyUserData?.msg91_phone_number,
          expected_phone: normalizedPhone,
          phone_matches: phoneMatch ? '✅ YES' : '❌ NO',
          stored_email: verifyUserData?.email,
          coin_balance: verifyUserData?.coin_balance,
          plan_tier: verifyUserData?.plan_tier,
          updated_at: verifyUserData?.updated_at
        });

        // If phone number doesn't match, force update it
        if (!phoneMatch) {
          console.error('[PHONE_STORAGE] ⚠️ WARNING: Phone number mismatch! Forcing update...', {
            stored: verifyUserData?.phone_number,
            expected: normalizedPhone
          });

          // Force update the phone number
          const { data: forceUpdateResult, error: forceUpdateError } = await supabaseAdmin
            .from('users')
            .update({
              phone_number: normalizedPhone,
              msg91_phone_number: normalizedPhone,
              updated_at: currentTimestamp
            })
            .eq('id', supabaseUserId)
            .select('id, phone_number, msg91_phone_number');

          if (forceUpdateError) {
            console.error('[PHONE_STORAGE] ❌ Force update failed:', forceUpdateError);
          } else {
            console.log('[PHONE_STORAGE] ✓ Phone number force updated:', forceUpdateResult);
          }
        }
      }
    } catch (verifyErr) {
      console.error('[PHONE_STORAGE] ❌ Error verifying storage:', verifyErr);
    }

    // Extract token_hash from action_link
    let tokenHash: string | null = null;
    try {
      const actionLinkUrl = new URL(linkData.properties.action_link);

      // Try to get token_hash from query params first
      tokenHash = actionLinkUrl.searchParams.get('token_hash');

      // If not in query params, try hash fragment
      if (!tokenHash && actionLinkUrl.hash) {
        const hashParams = new URLSearchParams(actionLinkUrl.hash.substring(1));
        tokenHash = hashParams.get('token_hash');
      }

      // If still not found, try parsing the hash manually
      if (!tokenHash && actionLinkUrl.hash) {
        const hashMatch = actionLinkUrl.hash.match(/token_hash=([^&]+)/);
        if (hashMatch) {
          tokenHash = hashMatch[1];
        }
      }

      // Also check if token_hash is directly in linkData properties
      if (!tokenHash && linkData?.properties?.hashed_token) {
        tokenHash = linkData.properties.hashed_token;
      }

      console.log('Extracted token_hash:', tokenHash ? 'Found' : 'Not found', {
        action_link: linkData.properties.action_link.substring(0, 100) + '...',
        has_hash: !!actionLinkUrl.hash,
        has_search: actionLinkUrl.search.length > 0
      });
    } catch (urlErr) {
      console.warn('Error extracting token_hash from action_link:', urlErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        supabase_user_id: supabaseUserId,
        phone: normalizedPhone,
        token_hash: tokenHash,
        action_link: linkData.properties.action_link,
        type: 'magiclink', // Using magiclink type with email
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('MSG91 token verification error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


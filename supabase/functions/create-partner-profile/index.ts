import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsWrappedHandler } from '../_shared/cors.ts';

/**
 * Supabase Edge Function: create-partner-profile
 *
 * Purpose:
 * - Receives birth details for a new partner.
 * - Validates the incoming data.
 * - Inserts the data into the `compatibility_profiles` table.
 * - This is a FREE action and does NOT deduct from the user's wallet.
 *
 * Expected Request Body (JSON):
 * {
 *   "partner_name": "Priya Sharma",
 *   "partner_gender": "Female",
 *   "date_of_birth": "2006-06-21", // YYYY-MM-DD format
 *   "time_of_birth": "07:00", // HH:MM 24-hour format
 *   "birth_place": "Visakhapatnam, Andhra Pradesh, India",
 *   "birth_lat": "17.6868",
 *   "birth_lng": "83.2185",
 *   "birth_timezone": "Asia/Kolkata" // IANA timezone name
 * }
 */

async function handler(req: Request) {
  try {
    // --- 1. Initialize Clients & Authenticate User ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'User is not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 2. Parse and Validate Request Body ---
    const body = await req.json();

    if (!body.partner_name || !body.source_profile_id) {
       return new Response(JSON.stringify({ error: 'Missing partner_name or source_profile_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const requiredFields = [
      'partner_name', 'partner_gender', 'date_of_birth', 'time_of_birth',
      'birth_place', 'birth_lat', 'birth_lng', 'birth_timezone'
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return new Response(JSON.stringify({ error: `Missing required field: ${field}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // --- 3. Prepare and Insert Data into the Database ---
    const profileToInsert = {
      user_id: user.id, // Link the profile to the authenticated user
      source_profile_id: body.source_profile_id, 
      partner_name: body.partner_name,
      partner_gender: body.partner_gender,
      date_of_birth: body.date_of_birth,
      time_of_birth: body.time_of_birth,
      birth_place: body.birth_place,
      birth_lat: body.birth_lat,
      birth_lng: body.birth_lng,
      birth_timezone: body.birth_timezone,
    };

    const { data: newProfile, error } = await supabaseAdmin
      .from('compatibility_profiles')
      .insert(profileToInsert)
      .select()
      .single();

    if (error) {
      console.error('Database insertion error:', error);
      return new Response(JSON.stringify({ error: 'Failed to save partner profile.', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 4. Return Success Response ---
    console.log(`[SUCCESS] User ${user.id} created new partner profile: ${newProfile.id}`);
    return new Response(JSON.stringify({ success: true, profile: newProfile }), {
      status: 201, // 201 Created
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Critical error in create-partner-profile function:', err);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred.', details: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// This wraps the handler in a CORS-enabled wrapper
Deno.serve(createCorsWrappedHandler(handler));
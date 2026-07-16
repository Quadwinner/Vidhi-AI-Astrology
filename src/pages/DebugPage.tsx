// File: src/pages/DebugPage.tsx
// --- NEW TEMPORARY FILE FOR DEBUGGING ---

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { User } from '@supabase/supabase-js';

export default function DebugPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileError, setProfileError] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const runChecks = async () => {
      // First, get the currently authenticated user from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        // If a user is logged in, try to fetch their data from the 'public.users' table
        // This is the EXACT same logic that the AuthContext uses.
        const { data, error } = await supabase
          .from('users')
          .select('id, plan_tier, coin_balance')
          .eq('id', user.id)
          .single();

        setProfileData(data);
        setProfileError(error);
      }
      setIsLoading(false);
    };

    runChecks();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', lineHeight: '1.6' }}>
      <h1>Database Connection Test</h1>
      <p>This page checks the raw data returned from the database for the logged-in user.</p>
      
      <hr />

      <h2>1. Authentication Check</h2>
      {isLoading ? (
        <p>Loading user...</p>
      ) : currentUser ? (
        <div>
          <p style={{ color: 'green' }}>✓ User is logged in.</p>
          <pre>{JSON.stringify(currentUser, null, 2)}</pre>
        </div>
      ) : (
        <p style={{ color: 'red' }}>✗ No user is logged in.</p>
      )}

      <hr />

      <h2>2. `public.users` Table Query Result</h2>
      {isLoading ? (
        <p>Fetching data from `users` table...</p>
      ) : (
        <div>
          <h3>Data Received:</h3>
          <pre style={{ border: '1px solid #ccc', padding: '10px', background: '#f5f5f5' }}>
            {JSON.stringify(profileData, null, 2)}
          </pre>

          <h3>Error Received:</h3>
          <pre style={{ border: '1px solid #ccc', padding: '10px', background: '#f5f5f5' }}>
            {JSON.stringify(profileError, null, 2)}
          </pre>
        </div>
      )}

      <hr />
      
      <h2>3. Analysis</h2>
      {profileData && !profileError && (
        <p style={{ color: 'green', fontWeight: 'bold' }}>
          ✓ SUCCESS: The RLS policy is working. The frontend received the correct data from the database. The problem must be in the React state management.
        </p>
      )}
      {!profileData && profileError?.code === 'PGRST116' && (
        <p style={{ color: 'red', fontWeight: 'bold' }}>
          ✗ FAILED: The query returned an error: "{profileError.message}". This confirms the Row Level Security policy is blocking access. The `auth.uid() = id` check is failing.
        </p>
      )}
      {!profileData && !profileError && currentUser && (
         <p style={{ color: 'orange', fontWeight: 'bold' }}>
           ✓ INFO: The query returned `null` for both data and error. This means the RLS policy allowed the query, but no row was found where the `id` column matched the authenticated user's ID. This points to a data mismatch.
         </p>
      )}
    </div>
  );
}
// File: src/utils/subscription.ts

import { supabase } from '../supabaseClient';
import { User } from '@supabase/supabase-js';

/**
 * Checks if a given user has an active subscription.
 *
 * @param user The Supabase user object.
 * @returns A boolean promise: true if the user has an active subscription, false otherwise.
 */
export const checkActiveSubscription = async (user: User | null): Promise<boolean> => {
  // If there's no user, there's no subscription.
  if (!user) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('users_subscriptions')
      .select('status, current_period_end')
      .eq('user_id', user.id)
      .single(); // We expect only one active subscription per user.

    // If there's an error or no subscription record is found.
    if (error || !data) {
      // 'PGRST116' is the specific Supabase error code for "No rows found".
      // We can safely ignore this error, as it just means the user isn't subscribed.
      if (error && error.code !== 'PGRST116') {
        console.error('Error checking subscription:', error);
      }
      return false;
    }

    // Check if the subscription status is 'active' and the current period has not ended yet.
    const isStatusActive = data.status === 'active';
    const isPeriodValid = new Date(data.current_period_end) > new Date();

    return isStatusActive && isPeriodValid;

  } catch (err) {
    console.error('An unexpected error occurred while checking subscription:', err);
    return false;
  }
};
// src/pages/PaymentSuccessPage.tsx
// --- FINAL CORRECTED VERSION ---

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  // Use `isSubscribed` and `refreshUserStatus` from YOUR AuthContext
  const { isSubscribed, refreshUserStatus, user, planTier, subscriptionStatus } = useAuth();
  const [status, setStatus] = useState('processing');

  useEffect(() => {
    trackEvent('Payment Success Page Viewed');
  }, []);

  const manualUpdateSubscription = async () => {
    if (!user) return;
    
    try {
      console.log('Manual subscription update started...');
      
      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (fetchError && fetchError.code === 'PGRST116') {
        // Create user
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            plan_tier: 'monthly',
            subscription_status: 'active',
            subscription_start_date: new Date().toISOString(),
            subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            coin_balance: 5
          })
          .select();
          
        if (createError) {
          console.error('Create error:', createError);
          alert('Failed to create user record. Please contact support.');
          return;
        }
        console.log('User created:', newUser);
      } else {
        // Update user
        const { error: updateError } = await supabase
          .from('users')
          .update({
            plan_tier: 'monthly',
            subscription_status: 'active',
            subscription_start_date: new Date().toISOString(),
            subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq('id', user.id);
          
        if (updateError) {
          console.error('Update error:', updateError);
          alert('Failed to update subscription. Please contact support.');
          return;
        }
        console.log('User updated successfully');
      }
      
      // Refresh AuthContext and redirect
      await refreshUserStatus();
      setStatus('complete');
      setTimeout(() => navigate('/profiles'), 1000);
      
    } catch (error) {
      console.error('Manual update error:', error);
      alert('Manual update failed. Please contact support.');
    }
  };

  useEffect(() => {
    // This function will be called by the interval
    const checkStatus = async () => {
      console.log('Checking subscription status...');
      
      // Check database directly as fallback
      if (user) {
        const { data: userData, error } = await supabase
          .from('users')
          .select('subscription_status, plan_tier')
          .eq('id', user.id)
          .single();
          
        console.log('Database check result:', userData, error);
        
        if (!error && userData?.subscription_status === 'active') {
          console.log('Direct database check: subscription is active');
          // Refresh AuthContext before redirecting
          await refreshUserStatus();
          setStatus('complete');
          setTimeout(() => navigate('/profiles'), 1500);
          return;
        }
        
        // If user doesn't exist, try to create them with active subscription
        if (error && error.code === 'PGRST116') {
          console.log('User not found in database, creating with active subscription...');
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              plan_tier: 'monthly',
              subscription_status: 'active',
              subscription_start_date: new Date().toISOString(),
              subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              coin_balance: 5
            })
            .select();
            
          if (!createError && newUser) {
            console.log('User created with active subscription:', newUser);
            // Refresh AuthContext before redirecting
            await refreshUserStatus();
            setStatus('complete');
            setTimeout(() => navigate('/profiles'), 1500);
            return;
          }
        }
      }
      
      await refreshUserStatus();
      // Also force-refresh coin balance after topups
      // By re-reading the session we trigger AuthContext fetchUserStatus
      // which pulls latest users.coin_balance
      await new Promise(r => setTimeout(r, 50));
    };

    // For direct Razorpay integration, check immediately
    checkStatus();

    // If the user is already subscribed upon landing, the payment was successful
    if (isSubscribed) {
      setStatus('complete');
      setTimeout(() => navigate('/profiles'), 1500);
      return;
    }

    // Start polling to check if the subscription was updated
    const intervalId = setInterval(checkStatus, 1000); // Check every 1 second for faster response

    // Set a timeout to stop polling after ~10 seconds (reduced from 30)
    const timeoutId = setTimeout(() => {
      setStatus('timed_out');
      clearInterval(intervalId);
    }, 10000);

    // Cleanup function
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
    // We only want this effect to run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // This separate effect listens for changes to `isSubscribed` caused by the polling
  useEffect(() => {
    if (isSubscribed) {
      setStatus('complete');
      setTimeout(() => navigate('/profiles'), 1500);
    }
  }, [isSubscribed, navigate]);

  useEffect(() => {
    if (status === 'complete') {
      trackEvent('Payment Success', {
        user_id: user?.id,
        email: user?.email,
        plan_tier: planTier,
        subscription_status: subscriptionStatus,
        timestamp: new Date().toISOString()
      });

      // Also send to CleverTap as charged event
      if (typeof window !== 'undefined' && (window as any).clevertap) {
        (window as any).clevertap.event.push('Charged', {
          'Amount': 0, // Will be updated by webhook with actual amount
          'Currency': 'INR',
          'Plan': planTier,
          'Payment Status': 'Success'
        });
      }
    } else if (status === 'timed_out') {
      trackEvent('Payment Verification Timeout', {
        user_id: user?.id,
        email: user?.email
      });
    }
  }, [status, user?.id, user?.email, planTier, subscriptionStatus]);

  let content;
  if (status === 'processing') {
    content = (
      <>
        <h2>Finalizing Your Subscription...</h2>
        <p>Please wait a moment while we confirm your payment. Do not refresh this page.</p>
      </>
    );
  } else if (status === 'complete') {
    content = (
      <>
        <h2>Thank You! Your Subscription is Active.</h2>
        <p>Redirecting you to your dashboard now...</p>
      </>
    );
  } else { // timed_out
    content = (
      <>
        <h2>There Seems to be a Delay.</h2>
        <p>
          We are still processing your payment. Your dashboard will update as soon as it's confirmed.
          <br />
          <br />
          <button 
            onClick={manualUpdateSubscription}
            style={{
              backgroundColor: '#3399cc',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer',
              margin: '10px'
            }}
          >
            Manually Update My Subscription
          </button>
          <br />
          <br />
          Or feel free to <a href="/profiles">proceed to your dashboard</a> now, and the changes will appear shortly.
        </p>
      </>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '100px 20px' }}>
      {content}
    </div>
  );
}
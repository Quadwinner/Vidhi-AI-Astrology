// src/pages/HomePage.tsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLoadScript } from '../hooks/useLoadScript';
import { useNotificationPermission } from '../hooks/useNotificationPermission';
import { supabase } from '../supabaseClient';

import '../styles/aura-home.css';
import AuthModal from '../components/AuthModal';
import NotificationPermissionPrompt from '../components/NotificationPermissionPrompt';
import FaqSection from '../components/FaqSection';
import FeaturesSection from '../components/FeaturesSection';
import HeroSection from '../components/HeroSection';
import KundliSection from '../components/KundliSection';
// import MobileAppSection from '../components/MobileAppSection'; // hidden for now
import SubscriptionSection from '../components/SubscriptionSection';
import TestimonialsSection from '../components/TestimonialsSection';
import { usePricing } from '../context/PricingContext';

const PENDING_KUNDLI_DETAILS_KEY = 'pendingKundliDetails';

declare global {
  interface Window { Razorpay: any; }
}

export default function HomePage() {
  const navigate = useNavigate();
  // --- 1. Get userProfiles from useAuth to perform the check ---
  const {
    user,
    currency,
    signInWithFirebaseGoogle,
    requestPhoneOtp,
    verifyPhoneOtp,
    requestFirebasePhoneOtp,
    verifyFirebasePhoneOtp,
    verifyMsg91Otp,
    planTier,
    checkingStatus,
    pricingVariant,
    refreshUserStatus,
    userProfiles // Added this
  } = useAuth();

  const { variantIsLoading } = usePricing();

  const { variant } = usePricing();

  const isRazorpayLoaded = useLoadScript('https://checkout.razorpay.com/v1/checkout.js');

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  // Web push notification permission
  const {
    permission: notificationPermission,
    isSupported: isNotificationSupported,
    shouldShowPrompt,
    markPromptShown,
  } = useNotificationPermission();

  const subscriptionRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const faqRef = useRef<HTMLElement>(null);
  const { showSubscriptions } = usePricing();

  const phoneAuthHandlers = useMemo(() => ({
    requestOtp: requestPhoneOtp,
    verifyOtp: verifyPhoneOtp,
  }), [requestPhoneOtp, verifyPhoneOtp]);

  const firebasePhoneAuthHandlers = useMemo(() => ({
    requestOtp: requestFirebasePhoneOtp,
    verifyOtp: verifyFirebasePhoneOtp,
  }), [requestFirebasePhoneOtp, verifyFirebasePhoneOtp]);

  const msg91AuthHandlers = useMemo(() => ({
    verifyOtp: (payload: { accessToken: string; phone: string; firstName?: string; lastName?: string; email?: string; }) => {
      return verifyMsg91Otp({
        ...payload,
        variant: pricingVariant
      });
    }
  }), [verifyMsg91Otp, pricingVariant]);

  useEffect(() => {
    if (checkingStatus || !currency || variantIsLoading) return;

    // Wait until currency is determined (it might be null briefly on initial load)
    // if (!currency) return;

    const determineLocationAndFetchPlans = async () => {
      setLoading(true);
      setError(null);

      // LOGIC SIMPLIFIED: We derive country purely from the Context Currency now
      let countryCode = 'US';
      const upperCurr = currency.toUpperCase();

      if (upperCurr === 'INR') countryCode = 'IN';
      else if (upperCurr === 'GBP') countryCode = 'GB';
      else if (upperCurr === 'AED') countryCode = 'AE';
      else if (upperCurr === 'EUR') countryCode = 'DE'; // Generic EU
      else countryCode = 'US';

      console.log(`[HomePage] Fetching plans for Currency: ${currency}, Country: ${countryCode}, Variant: ${pricingVariant}`);
      try {
        const { data, error: plansError } = await supabase.functions.invoke(
          'get-location-and-plans',
          { body: { country: countryCode, variant: pricingVariant } } // <-- PASS THE VARIANT
        );

        if (plansError) throw new Error(plansError.message);
        setPlans(data.plans || []);
      } catch (plansError) {
        console.error('Error fetching plans:', plansError);
        setError('Could not load subscription plans.');
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };

    determineLocationAndFetchPlans();

    // Add currency to dependency array so it refetches if currency changes
  }, [user, currency, checkingStatus, pricingVariant,variantIsLoading]);

  // This useEffect for scrolling remains unchanged
  useEffect(() => {
    if (location.hash === '#pricing' && subscriptionRef.current) {
      subscriptionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    if (location.hash === '#faq' && faqRef.current) {
      faqRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location, loading]);

  // This useEffect now contains the fix for the loophole
  useEffect(() => {
    // Run only when auth status is fully resolved
    if (user && !checkingStatus && userProfiles) { // Added userProfiles check
      const pendingDetailsJSON = sessionStorage.getItem(PENDING_KUNDLI_DETAILS_KEY);

      if (pendingDetailsJSON) {
        // --- 2. THE FIX: Check the user's profile count BEFORE creating a new one ---
        if (userProfiles.length > 0 && planTier !== 'yearly') {
          // If the user already has a profile and is on a free plan, block them.
          alert("You have already used your one free Kundli report. Please upgrade your plan to create more.");
          // Clear the pending details so this doesn't run again.
          sessionStorage.removeItem(PENDING_KUNDLI_DETAILS_KEY);
          return; // Stop the process.
        }

        // If the check above passes, then we proceed to create the profile.
        sessionStorage.removeItem(PENDING_KUNDLI_DETAILS_KEY);

        const createPendingProfile = async () => {
          try {
            const details = JSON.parse(pendingDetailsJSON);

            // The two-step database insert logic
            const { data: profileData, error: profileError } = await supabase
              .from('user_profiles')
              .insert({ name: details.name, user_id: user.id })
              .select()
              .single();

            if (profileError) throw profileError;

            const { error: birthDetailsError } = await supabase
              .from('user_birth_details')
              .insert({
                profile_id: profileData.id,
                date_of_birth: details.date_of_birth,
                time_of_birth: details.time_of_birth,
                gender: details.gender,
                birth_place: details.birth_place,
                birth_lat: details.birth_lat,
                birth_lng: details.birth_lng,
                birth_timezone: details.birth_timezone,
              });

            if (birthDetailsError) throw birthDetailsError;

            await refreshUserStatus();
            navigate('/reports');

          } catch (error) {
            console.error('Failed to save pending Kundli details:', error);
            alert('There was an issue creating your Kundli profile. Please try again from the homepage.');
          }
        };

        createPendingProfile();
      }
    }
    // Dependency array is updated to include the new checks
  }, [user, checkingStatus, userProfiles, planTier, navigate, refreshUserStatus]);

  // Show web push notification prompt on homepage (for all users)
  useEffect(() => {
    if (shouldShowPrompt('manual') && isNotificationSupported) {
      const timer = setTimeout(() => {
        setShowNotificationPrompt(true);
        markPromptShown('manual');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [shouldShowPrompt, isNotificationSupported, markPromptShown]);

  // Automatic re-registration for users who already granted permission
  useEffect(() => {
    const reRegisterExistingUsers = async () => {
      // @ts-ignore - CleverTap types not available
      const clevertap = (window as any).clevertap;

      // Check if already re-registered
      const hasReRegistered = localStorage.getItem('ct_push_reregistered');
      if (hasReRegistered) {
        return;
      }

      // Only for users who already have permission granted
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return;
      }

      // Wait for CleverTap to load
      if (!clevertap?.notifications?.push) {
        console.log('[Re-registration] CleverTap not ready yet, skipping...');
        return;
      }

      try {
        console.log('[Re-registration] Starting silent re-registration for existing user...');

        // Silently register push token with CleverTap
        await clevertap.notifications.push({
          titleText: 'Notifications Updated',
          bodyText: 'Your notification settings have been improved.',
          skipDialog: true,
          serviceWorkerPath: '/clevertap_sw.js',
          vapidPublicKey: 'BBP6tWBZCnyNnN39wXWHaKJP_K2WbDM4034HIr2Md_aTb36mqkkldoFP_rxh55v-_G1rIxSZE0Q6rEMXIT5pVuo'
        });

        // Mark as re-registered
        localStorage.setItem('ct_push_reregistered', 'true');
        console.log('✅ [Re-registration] User successfully re-registered for push notifications');

        // Update profile
        if (clevertap.profile?.push) {
          clevertap.profile.push({
            Site: {
              push_enabled: true,
              re_registered: true,
              re_registered_at: new Date().toISOString()
            }
          });
        }
      } catch (error) {
        console.warn('[Re-registration] Failed to re-register user:', error);
        // Don't set reregistered flag on failure, will retry on next page load
      }
    };

    // Wait 5 seconds after page load to ensure CleverTap is ready
    const timer = setTimeout(() => {
      reRegisterExistingUsers();
    }, 5000);

    return () => clearTimeout(timer);
  }, []); // Run once on mount

  // Updated handleSubscribe function to use direct subscription creation
  const handleSubscribe = async (priceId: number | string) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsSubscribing(true);
    setActivePlanId(typeof priceId === 'string' ? parseInt(priceId) : priceId);

    try {
      // Find the plan from the plans array to get the correct amount and plan type
      const selectedPlan = plans.find(plan => plan.price.id === priceId);
      if (!selectedPlan) {
        throw new Error('Selected plan not found');
      }

      const planType = selectedPlan.interval === 'month' ? 'monthly' : 'yearly';
      const amount = selectedPlan.price.amount; // Use the actual amount from the plan

      console.log('Selected plan:', selectedPlan);
      console.log('Plan type:', planType);
      console.log('Amount:', amount);

      // Direct Razorpay integration
      if (!isRazorpayLoaded) throw new Error('Razorpay script is not yet loaded.');

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID,
        amount: amount,
        currency: selectedPlan.price.currency.toUpperCase(), // Use currency from location-based plan
        name: 'AuraAI Astrology',
        description: `${planType === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`,
        handler: async (response: any) => {
          console.log('💳 Payment successful:', response);

          try {

            // Use UPSERT for reliable insert-or-update
            // --- AFTER THE FIX (CORRECT) ---

            // Get current user state first
            const { data: existingUser, error: fetchError } = await supabase
              .from('users')
              .select('coin_balance') // Only need coin_balance
              .eq('id', user.id)
              .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // Ignore "no rows found" error for new users
              throw fetchError;
            }

            // --- CORRECT COIN CALCULATION LOGIC ---
            // 1. Get the number of coins to add from the selected plan's entitlements.
            const coinsToAdd = selectedPlan.entitlements?.coins_granted_on_subscription || 0;

            // 2. Get the user's current coin balance (defaults to 0 if they don't exist yet).
            const currentCoins = existingUser?.coin_balance || 0;

            // 3. Calculate the new total.
            const newCoinBalance = currentCoins + coinsToAdd;

            // Use UPSERT for reliable insert-or-update
            const { data: result, error: upsertError } = await supabase
              .from('users')
              .upsert({
                id: user.id,
                email: user.email,
                plan_tier: planType,
                subscription_status: 'active',
                subscription_start_date: new Date().toISOString(),
                subscription_end_date: new Date(Date.now() + (planType === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString(),
                coin_balance: newCoinBalance // Use the new calculated balance
              }, {
                onConflict: 'id'
              })
              .select();
            if (upsertError) {
              console.error('❌ Upsert error:', upsertError);
              alert('Payment successful but subscription update failed: ' + upsertError.message);
              return;
            }

            console.log('✅ Subscription updated via upsert:', result);

            // Verify the update
            const { data: verifyUser, error: verifyError } = await supabase
              .from('users')
              .select('*')
              .eq('id', user.id)
              .single();

            console.log('✅ Verified user state:', verifyUser);

            if (verifyUser?.subscription_status === 'active') {
              console.log('🎉 Subscription confirmed active!');
              // Refresh AuthContext before navigating
              await refreshUserStatus();
              navigate('/payment-success');
            } else {
              console.error('⚠️ Subscription status not active:', verifyUser?.subscription_status);
              alert('Payment successful but subscription status is: ' + verifyUser?.subscription_status);
            }

          } catch (error) {
            console.error('❌ Payment handler error:', error);
            alert('Payment successful but there was an error: ' + (error as Error).message);
          }
        },
        prefill: {
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split('@')[0]
        },
        theme: { color: '#3399cc' },
        modal: {
          ondismiss: function () {
            setIsSubscribing(false);
            setActivePlanId(null);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        alert('Payment failed. Please try again.');
        console.error('Payment failed:', response.error);
        setIsSubscribing(false);
        setActivePlanId(null);
      });
      rzp.open();

    } catch (err: any) {
      console.error('Subscription Error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      // Note: We don't set loading to false here because Razorpay modal handles it
    }
  };

  // The returned JSX remains unchanged
  return (
    <main className="aura-home">

      {/* Web Push Notification Permission Prompt */}
      {showNotificationPrompt && (
        <NotificationPermissionPrompt
          trigger="manual"
          variant="banner"
          onClose={() => setShowNotificationPrompt(false)}
        />
      )}

      <HeroSection
        user={user}
        onGoogleSignIn={signInWithFirebaseGoogle}
        phoneAuth={{
          requestOtp: requestPhoneOtp,
          verifyOtp: verifyPhoneOtp,
        }}
        msg91Auth={msg91AuthHandlers}
      />

      {/* Features Section follows immediately */}
      <FeaturesSection />

      {!checkingStatus && (
        <SubscriptionSection
          ref={subscriptionRef}
          plans={plans}
          isLoading={loading}
          error={error}
          onSubscribe={handleSubscribe}
          isSubscribing={isSubscribing}
          activePlanId={activePlanId}
          currentUserPlanId={planTier}
        />
      )}

      <KundliSection />

      <section ref={faqRef}>
        <FaqSection />
      </section>

      <TestimonialsSection />

      {/* Mobile app section hidden for now */}
      {/* <MobileAppSection /> */}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onGoogleSignIn={signInWithFirebaseGoogle}
        phoneAuth={phoneAuthHandlers}
        firebasePhoneAuth={firebasePhoneAuthHandlers}
        msg91Auth={msg91AuthHandlers}
      />
    </main>
  );
};
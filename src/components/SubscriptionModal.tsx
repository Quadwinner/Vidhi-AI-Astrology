// src/components/SubscriptionModal.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLoadScript } from '../hooks/useLoadScript';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';

import { usePricing } from '../context/PricingContext';
import AuthModal from './AuthModal';
import Modal from './Modal';
import './SubscriptionModal.css';
import SubscriptionSection from './SubscriptionSection';

export interface PlanWithPrice {
  id: string;
  name: string;
  description: string;
  interval: 'month' | 'year';
  price: {
    id: number | string;
    amount: number;
    currency: string;
    gateway_price_id?: string;
    originalAmount?: number;
    wallet_credit_amount?: number;
  };
  entitlements?: { 
    questions_per_month: number;
    daily_horoscope_enabled: boolean;
    divisional_charts_enabled: boolean;
    ai_call_talk_minutes: number;
    weekly_forecasts_enabled: boolean;
    max_profiles: number;
    max_saved_threads: number;
    coins_granted_on_subscription: number; 
  };
}

declare global {
  interface Window { Razorpay: any; }
}

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
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
    refreshUserStatus,
    pricingVariant 
  } = useAuth();

  const { showSubscriptions } = usePricing();

  const isRazorpayLoaded = useLoadScript('https://checkout.razorpay.com/v1/checkout.js');

  const [plans, setPlans] = useState<PlanWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [activePlanId, setActivePlanId] = useState<number | null>(null); 
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false); 

  const phoneAuthHandlers = useMemo(() => ({
    requestOtp: requestPhoneOtp,
    verifyOtp: verifyPhoneOtp,
  }), [requestPhoneOtp, verifyPhoneOtp]);

  const firebasePhoneAuthHandlers = useMemo(() => ({
    requestOtp: requestFirebasePhoneOtp,
    verifyOtp: verifyFirebasePhoneOtp,
  }), [requestFirebasePhoneOtp, verifyFirebasePhoneOtp]);

  const msg91AuthHandlers = useMemo(() => ({
    verifyOtp: verifyMsg91Otp,
  }), [verifyMsg91Otp]);

  useEffect(() => {
    if (isOpen) {
      trackEvent('Monetization Modal Viewed', {
        variant: pricingVariant, 
        view_type: showSubscriptions ? 'Subscriptions and Wallet' : 'Wallet Only' 
      });
    }
  }, [isOpen, pricingVariant, showSubscriptions]); 

  useEffect(() => {
    if (!isOpen || checkingStatus || !pricingVariant) {
      return;
    }

    const determineLocationAndFetchPlans = async () => {
      setLoading(true);
      setError(null);
      let countryCode = 'US';

      if (user && currency) {
        const upperCurr = currency.toUpperCase();
        if (upperCurr === 'INR') countryCode = 'IN';
        else if (upperCurr === 'GBP') countryCode = 'GB';
        else if (upperCurr === 'AED') countryCode = 'AE';
        else countryCode = 'US';
      } else {
        try {
          const apiKey = process.env.REACT_APP_GEOAPIFY_API_KEY;
          if (apiKey) {
            const response = await fetch(`https://api.geoapify.com/v1/ipinfo?apiKey=${apiKey}`);
            if (response.ok) {
              const geoData = await response.json();
              countryCode = geoData.country?.iso_code || 'US';
            }
          }
        } catch (geoError) {
          console.error('GeoIP failed, defaulting to US.');
        }
      }

      console.log(`[SubscriptionModal] Fetching plans for Variant: ${pricingVariant}`);

      try {
        const { data, error: plansError } = await supabase.functions.invoke(
          'get-location-and-plans',
          { body: { country: countryCode, variant: pricingVariant } } 
        );

        if (plansError) throw new Error(plansError.message);
        setPlans(data.plans || []);
      } catch (plansError) {
        console.error('Error fetching plans:', plansError);
        setError('Could not load plans.');
      } finally {
        setLoading(false);
      }
    };

    determineLocationAndFetchPlans();
    
  }, [isOpen, user, currency, checkingStatus, pricingVariant]); 

  useEffect(() => {
    if (!isOpen) {
      setPlans([]);
      setLoading(true);
    }
  }, [isOpen]);

  const handleSubscribe = async (priceId: number | string) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    const ctAvailable = typeof window !== 'undefined' &&
      ((window as any).clevertap &&
        typeof (window as any).clevertap.event?.push === 'function');
    console.log('[SubscriptionModal] CleverTap available:', ctAvailable);

    setIsSubscribing(true);
    setActivePlanId(Number(priceId));
    try {
      const selectedPlan = plans.find(plan => plan.price.id === priceId);
      if (!selectedPlan) {
        throw new Error('Selected plan not found');
      }

      const planType = selectedPlan.interval === 'month' ? 'monthly' : 'yearly';

      trackEvent('Subscription Started', {
        plan_name: selectedPlan.name,
        plan_interval: planType,
        plan_price: selectedPlan.price.amount / 100,
        plan_currency: selectedPlan.price.currency,
        price_id: String(priceId),
        user_id: user.id,
        source: 'Subscription Modal'
      });

      console.log('[SubscriptionModal] Subscription Started event tracked:', {
        plan_name: selectedPlan.name,
        plan_interval: planType,
        plan_price: selectedPlan.price.amount / 100
      });

      const amount = selectedPlan.price.amount;

      console.log('Selected plan:', selectedPlan);
      console.log('Plan type:', planType);
      console.log('Amount:', amount);

      if (!isRazorpayLoaded) throw new Error('Razorpay script is not yet loaded.');

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID, 
        amount: amount,
        currency: selectedPlan.price.currency.toUpperCase(), 
        name: 'Vidhi Astrology',
        description: `${planType === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`,
        handler: async (response: any) => {
          console.log('💳 Payment successful:', response);

          trackEvent('Subscription Succeeded', {
            plan_name: selectedPlan.name,
            plan_interval: planType,
            plan_price: selectedPlan.price.amount / 100,
            plan_currency: selectedPlan.price.currency,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            user_id: user.id,
            source: 'Subscription Modal',
            variant: pricingVariant
          });

          console.log('[SubscriptionModal] Subscription Succeeded event tracked:', {
            plan_name: selectedPlan.name,
            razorpay_payment_id: response.razorpay_payment_id
          });

          try {
            const { data: existingUser, error: fetchError } = await supabase
              .from('users')
              .select('coin_balance')
              .select('*')
              .eq('id', user.id)
              .single();

            console.log('📊 Current user data:', existingUser);
            console.log('📊 Fetch error:', fetchError);

            const coinsToAdd = selectedPlan.entitlements?.coins_granted_on_subscription || 0;
            const currentCoins = existingUser?.coin_balance || 0;
            const newCoinBalance = currentCoins + coinsToAdd;

            const { data: result, error: upsertError } = await supabase
              .from('users')
              .upsert({
                id: user.id,
                email: user.email,
                plan_tier: planType,
                subscription_status: 'active',
                subscription_start_date: new Date().toISOString(),
                subscription_end_date: new Date(Date.now() + (planType === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString(),
                coin_balance: newCoinBalance
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

            const { data: verifyUser, error: verifyError } = await supabase
              .from('users')
              .select('*')
              .eq('id', user.id)
              .single();

            console.log('✅ Verified user state:', verifyUser);

            if (verifyUser?.subscription_status === 'active') {
              console.log('🎉 Subscription confirmed active!');
              await refreshUserStatus();
              onClose();
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
        trackEvent('Subscription Failed', {
          plan_name: selectedPlan.name,
          plan_interval: planType,
          plan_price: selectedPlan.price.amount / 100,
          plan_currency: selectedPlan.price.currency,
          error_code: response.error?.code,
          error_description: response.error?.description,
          error_reason: response.error?.reason,
          user_id: user.id,
          source: 'Subscription Modal',
          variant: pricingVariant
        });

        console.log('[SubscriptionModal] Subscription Failed event tracked:', {
          plan_name: selectedPlan.name,
          error: response.error
        });

        alert('Payment failed. Please try again.');
        console.error('Payment failed:', response.error);
        setIsSubscribing(false);
        setActivePlanId(null);
      });

      // Track Payment Gateway Initiated (before opening Razorpay)
      trackEvent('Payment Gateway Initiated', {
        plan_name: selectedPlan.name,
        plan_interval: planType,
        plan_price: selectedPlan.price.amount / 100,
        plan_currency: selectedPlan.price.currency,
        price_id: String(priceId),
        gateway: 'Razorpay',
        source: 'Subscription Modal'
      });

      if (ctAvailable) {
        (window as any).clevertap.event.push('Payment Gateway Initiated', {
          'Plan': selectedPlan.name,
          'Amount': selectedPlan.price.amount / 100,
          'Currency': selectedPlan.price.currency,
          'Gateway': 'Razorpay'
        });
      }

      rzp.open();

    } catch (err: any) {
      console.error('Subscription Error:', err);

      const selectedPlan = plans.find(plan => plan.price.id === priceId);
      if (selectedPlan) {
        const planType = selectedPlan.interval === 'month' ? 'monthly' : 'yearly';
        trackEvent('Subscription Failed', {
          plan_name: selectedPlan.name,
          plan_interval: planType,
          error: err?.message || 'Unknown error',
          error_type: 'initialization_error',
          user_id: user?.id,
          source: 'Subscription Modal',
          variant: pricingVariant
        });
      }

      alert(`Error: ${err.message}`);
    } finally {
      // Note: We don't set loading to false here because Razorpay modal handles it
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Upgrade Your Plan">
        <div className='modalpopup'>
          <SubscriptionSection
            plans={plans}
            isLoading={loading || checkingStatus}
            error={error}
            onSubscribe={handleSubscribe}
            isSubscribing={isSubscribing}
            activePlanId={activePlanId}
            currentUserPlanId={planTier}
          />
        </div>
      </Modal>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onGoogleSignIn={signInWithFirebaseGoogle}
        phoneAuth={phoneAuthHandlers}
        firebasePhoneAuth={firebasePhoneAuthHandlers}
      />
    </>
  );
};

export default SubscriptionModal;
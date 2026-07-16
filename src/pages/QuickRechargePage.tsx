import { IconArrowLeft } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLoadScript } from '../hooks/useLoadScript';
import { supabase } from '../supabaseClient';
import SubscriptionSection from '../components/SubscriptionSection';
import '../styles/aura-home.css';
import './QuickRechargePage.css';

declare global {
  interface Window { Razorpay: any; }
}

export default function QuickRechargePage() {
  const navigate = useNavigate();
  const { user, currency, planTier, pricingVariant, checkingStatus, refreshUserStatus } = useAuth() as any;
  const isRazorpayLoaded = useLoadScript('https://checkout.razorpay.com/v1/checkout.js');

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);

  // --- Fetch location-based plans (same logic as HomePage) ---
  useEffect(() => {
    if (checkingStatus || !currency) return;

    const fetchPlans = async () => {
      setLoading(true);
      setError(null);
      let countryCode = 'US';
      const c = currency.toUpperCase();
      if (c === 'INR') countryCode = 'IN';
      else if (c === 'GBP') countryCode = 'GB';
      else if (c === 'AED') countryCode = 'AE';
      else if (c === 'EUR') countryCode = 'DE';

      try {
        const { data, error: plansError } = await supabase.functions.invoke('get-location-and-plans', {
          body: { country: countryCode, variant: pricingVariant },
        });
        if (plansError) throw new Error(plansError.message);
        setPlans(data?.plans || []);
      } catch (e) {
        console.error('[QuickRecharge] Error fetching plans:', e);
        setError('Could not load subscription plans.');
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [currency, checkingStatus, pricingVariant]);

  // --- Subscription checkout via Razorpay (same flow as HomePage) ---
  const handleSubscribe = async (priceId: number | string) => {
    if (!user) { navigate('/'); return; }
    setIsSubscribing(true);
    setActivePlanId(typeof priceId === 'string' ? parseInt(priceId) : priceId);

    try {
      const selectedPlan = plans.find((p) => p.price.id === priceId);
      if (!selectedPlan) throw new Error('Selected plan not found');
      const planType = selectedPlan.interval === 'month' ? 'monthly' : 'yearly';
      const amount = selectedPlan.price.amount;

      if (!isRazorpayLoaded) throw new Error('Razorpay script is not yet loaded.');

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID,
        amount,
        currency: selectedPlan.price.currency.toUpperCase(),
        name: 'Vidhi Astrology',
        description: `${planType === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`,
        handler: async (response: any) => {
          try {
            const { data: existingUser } = await supabase.from('users').select('coin_balance').eq('id', user.id).single();
            const coinsToAdd = selectedPlan.entitlements?.coins_granted_on_subscription || 0;
            const newCoinBalance = (existingUser?.coin_balance || 0) + coinsToAdd;

            const { error: upsertError } = await supabase.from('users').upsert({
              id: user.id,
              email: user.email,
              plan_tier: planType,
              subscription_status: 'active',
              subscription_start_date: new Date().toISOString(),
              subscription_end_date: new Date(Date.now() + (planType === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString(),
              coin_balance: newCoinBalance,
            }, { onConflict: 'id' });

            if (upsertError) { alert('Payment successful but subscription update failed: ' + upsertError.message); return; }
            await refreshUserStatus();
            navigate('/payment-success');
          } catch (err: any) {
            alert('Payment successful but there was an error: ' + err.message);
          }
        },
        prefill: { email: user.email, name: user.user_metadata?.full_name || user.email?.split('@')[0] },
        theme: { color: '#E5B45B' },
        modal: { ondismiss: () => { setIsSubscribing(false); setActivePlanId(null); } },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        alert('Payment failed. Please try again.');
        console.error('Payment failed:', resp.error);
        setIsSubscribing(false);
        setActivePlanId(null);
      });
      rzp.open();
    } catch (err: any) {
      console.error('[QuickRecharge] Subscription error:', err);
      alert(`Error: ${err.message}`);
      setIsSubscribing(false);
      setActivePlanId(null);
    }
  };

  return (
    <main className="aura-home recharge-page">
      <div className="aura-stars-layer" aria-hidden="true" />
      <div className="recharge-page-inner">
        <button className="recharge-back" onClick={() => navigate(-1)}>
          <IconArrowLeft size={18} />
          <span>Back</span>
        </button>

        <SubscriptionSection
          plans={plans}
          isLoading={loading}
          error={error}
          onSubscribe={handleSubscribe}
          isSubscribing={isSubscribing}
          activePlanId={activePlanId}
          currentUserPlanId={planTier}
        />
      </div>
    </main>
  );
}

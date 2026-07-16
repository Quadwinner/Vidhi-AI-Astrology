import React, { useState, useMemo, useEffect } from 'react';
import styles from './WalletRecharge.module.css';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext'; // <--- NEW
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import SubscriptionSection, { PlanWithPrice } from '../components/SubscriptionSection';

export default function WalletRecharge() {
  const { walletBalance, planTier, subscriptionStatus, currentPeriodEnd, user, currency } = useAuth();
  const { packages, formatPrice, isLoading: isPricingLoading, prices } = usePricing(); // <--- NEW
  const navigate = useNavigate();

  const [selectedPackageAmount, setSelectedPackageAmount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscription State
  const [plans, setPlans] = useState<PlanWithPrice[] | null>(null);
  const [plansLoading, setPlansLoading] = useState<boolean>(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);

  // Default to first package if available
  useEffect(() => {
    if (packages.length > 0 && selectedPackageAmount === null) {
      setSelectedPackageAmount(packages[0].amount);
    }
  }, [packages, selectedPackageAmount]);

  // Fetch subscription plans logic (Keep existing logic, just cleanup)
  useEffect(() => {
    const fetchPlans = async () => {
      setPlansLoading(true);
      setPlansError(null);
      // We can use the AuthContext currency to hint location if needed, 
      // but 'get-location-and-plans' does its own IP check usually.
      try {
        const { data, error: plansErr } = await supabase.functions.invoke('get-location-and-plans', {
          body: { country: currency === 'INR' ? 'IN' : 'US' } // Hint based on wallet currency
        });
        if (plansErr) throw new Error(plansErr.message);
        setPlans(data?.plans || []);
      } catch (e: any) {
        setPlans([]);
        setPlansError(e?.message || 'Failed to load plans');
      } finally {
        setPlansLoading(false);
      }
    };
    fetchPlans();
  }, [currency]);

  // Handle Subscription (Legacy/Existing Flow)
  const handleSubscribe = async (priceId: number | string) => {
    if (!user) { setPlansError('Please sign in to subscribe'); return; }
    setIsSubscribing(true);
    setActivePlanId(typeof priceId === 'string' ? parseInt(priceId) : priceId);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-session', { body: { price_id: priceId, user_id: user.id } });
      if (error) throw error;
      const url = (data as any)?.sessionUrl || (data as any)?.url;
      if (url) window.location.href = url; else navigate('/subscription-management');
    } catch (e: any) {
      setPlansError(e?.message || 'Failed to start checkout');
    } finally {
      setIsSubscribing(false);
    }
  };

  const isPremium = useMemo(() => planTier === 'monthly' || planTier === 'yearly', [planTier]);

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-customer-portal-session');
      if (error) throw new Error(error.message || 'Failed to create portal session');
      if (data && (data as any).error) throw new Error((data as any).error);
      navigate('/subscription-management');
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Failed to open portal');
    }
  };

  // --- NEW CHECKOUT LOGIC ---
  const handleCheckout = async () => {
    if (!selectedPackageAmount) return;
    setIsLoading(true);
    setError(null);

    try {
      // Find the selected package to get exact price details
      // Note: In your DB, 'amount' is what user gets, 'price' is what they pay. 
      // Usually they are the same (1000 paise = ₹10), but allows for discounts.
      const pkg = packages.find(p => p.amount === selectedPackageAmount);

      // Fallback: If custom amount logic is needed later, handle here.
      // For now, strict package selection from DB.
      const amountToPay = pkg ? pkg.price : selectedPackageAmount;

      console.log('Initiating Checkout:', {
        amountToPay,
        currencyFromAuth: currency,
        finalCurrency: currency || 'USD'
      });

      const { data, error } = await supabase.functions.invoke('create-topup-session', {
        body: {
          amount: amountToPay, // Minor units
          currency: currency || 'USD'
        }
      });

      if (error) throw new Error(error.message || 'Failed to create checkout session');

      // Razorpay Handling
      if (data?.gateway === 'razorpay' && data?.order) {
        const options = {
          key: data.key_id,
          amount: data.order.amount,
          currency: data.order.currency,
          name: 'AuraAI Wallet Recharge',
          description: `Add ${formatPrice(selectedPackageAmount)}`,
          order_id: data.order.id,
          handler: function (response: any) {
            // Optimistic UI update or reload
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          },
          theme: { color: '#ed0687' }
        };

        if (!(window as any).Razorpay) {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => {
            const razorpay = new (window as any).Razorpay(options);
            razorpay.open();
          };
          document.body.appendChild(script);
        } else {
          const razorpay = new (window as any).Razorpay(options);
          razorpay.open();
        }
      } else if (data?.url) {
        // Stripe handling
        window.location.href = data.url;
      }
    } catch (e: any) {
      setError(e.message || 'Failed to process payment');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to estimate usage
  const getEstimates = (amount: number) => {
    // Look up costs from context
    const chatCost = prices['chat_message'] || 0;
    const callCost = prices['voice_call_minute'] || 0;

    if (chatCost === 0 || callCost === 0) return '';

    const chats = Math.floor(amount / chatCost);
    const minutes = Math.floor(amount / callCost);

    return `≈ ${minutes} min talk time • ${chats} questions`;
  };

  return (
    <div className={styles.walletContainer}>
      {/* Header Section */}
      <div className={styles.header}>
        <h1 className={styles.title}>Wallet Balance</h1>

        <div className={styles.balanceDisplay}>
          {/* Show Formatted Balance */}
          <p className={styles.balanceLabel}>
            {isPricingLoading ? '...' : formatPrice(walletBalance || 0)}
          </p>
        </div>

        {/* Dynamic Rate Meta */}
        {/* <div className={styles.rateMeta}>
          Calls: <strong>{formatPrice(prices['voice_call_minute'] || 0)}/min</strong> • 
          Chats: <strong>{formatPrice(prices['chat_message'] || 0)}/msg</strong>
        </div> */}

        {/* Subscription Info (Preserved) */}
        <div className={styles.subscriptionInfo}>
          <div className={styles.subscriptionCard}>
            <div className={styles.subscriptionHeader}>
              <span className={styles.subscriptionPlan}>
                {isPremium ? '⭐ Premium' : '🆓 Free'} Plan
              </span>
              {subscriptionStatus && (
                <span className={styles.subscriptionStatus}>
                  {subscriptionStatus === 'active' ? '✓ Active' : subscriptionStatus}
                </span>
              )}
            </div>
            {currentPeriodEnd && isPremium && (
              <div className={styles.subscriptionDetails}>
                <p className={styles.renewalDate}>
                  Renews: {new Date(currentPeriodEnd).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>
              </div>
            )}
            <div className={styles.subscriptionActions}>
              {isPremium ? (
                <button className={styles.manageButton} onClick={handleManageSubscription}>
                  Manage Subscription
                </button>
              ) : (
                <button className={styles.upgradeButton} onClick={() => window.location.href = '/#pricing'}>
                  Upgrade to Premium
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recharge Packages - Fetched from DB */}
      {/* <h3 className={styles.sectionTitle}>Add Money to Wallet</h3>
      <div className={styles.packagesGrid}>
        {packages.map((pkg) => {
           const isSelected = selectedPackageAmount === pkg.amount;
           return (
            <div
                key={pkg.id}
                className={`${styles.packageCard} ${isSelected ? styles.selected : ''}`}
                onClick={() => setSelectedPackageAmount(pkg.amount)}
            >
                {pkg.is_popular && (
                    <div className={styles.discountBadge} style={{ backgroundColor: '#f97316' }}>
                    POPULAR
                    </div>
                )}
                
                <div className={styles.packageContent}>
                <p className={styles.packageAmount}>{formatPrice(pkg.amount)}</p>
                <p className={styles.packageMinutesLine}>
                    {getEstimates(pkg.amount)}
                </p>
                </div>
            </div>
           );
        })}
      </div> */}

      {/* Bottom Section
      <div className={styles.bottomSection}>
        <div className={styles.paymentSummary}>
          <button 
            className={styles.checkoutButton}
            onClick={handleCheckout}
            disabled={isLoading || !selectedPackageAmount}
          >
            {isLoading ? 'Processing...' : `Add ${selectedPackageAmount ? formatPrice(selectedPackageAmount) : ''}`}
          </button>
        </div>
      </div> */}

      {/* Subscription Plans CTA */}
      {plans && plans.length > 0 && (
        <div className={styles.subscriptionPlansBlock}>
          {/* <h3 className={styles.sectionTitle}>Or Choose a Subscription</h3> */}
          <SubscriptionSection
            plans={plans}
            onSubscribe={handleSubscribe}
            isSubscribing={isSubscribing}
            activePlanId={activePlanId}
            isLoading={plansLoading}
            error={plansError}
            currentUserPlanId={planTier as any}
          />
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
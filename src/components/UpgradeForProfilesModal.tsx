// src/components/UpgradeForProfilesModal.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { useLoadScript } from '../hooks/useLoadScript';
import Modal from './Modal';
import { PlanWithPrice } from './SubscriptionModal'; 
import styles from './UpgradeForProfilesModal.module.css';

declare global {
  interface Window { Razorpay: any; }
}

interface UpgradeForProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpgradeForProfilesModal: React.FC<UpgradeForProfilesModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useAuth();
  const isRazorpayLoaded = useLoadScript('https://checkout.razorpay.com/v1/checkout.js');

  const [yearlyPlan, setYearlyPlan] = useState<PlanWithPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (isOpen && !yearlyPlan) {
      // --- MODIFIED: Renamed and updated the function to include location detection ---
      const determineLocationAndFetchPlans = async () => {
        setLoading(true);
        setError(null);
        let countryCode = 'US'; // Default country

        try {
          // Step 1: Determine user's location via Geoapify
          const apiKey = process.env.REACT_APP_GEOAPIFY_API_KEY;
          if (!apiKey) {
            throw new Error("Geoapify API key is not configured.");
          }

          const response = await fetch(`https://api.geoapify.com/v1/ipinfo?apiKey=${apiKey}`);
          if (!response.ok) {
            console.error('Geo-location API call failed. Status:', response.status);
          } else {
            const geoData = await response.json();
            countryCode = geoData.country?.iso_code || 'US';
          }
        } catch (geoError) {
          console.error('Failed to determine location, defaulting to US.', geoError);
        }

        // Step 2: Fetch plans using the determined country code
        try {
          const { data, error: plansError } = await supabase.functions.invoke(
            'get-location-and-plans',
            { body: { country: countryCode } } // Pass the country code
          );

          if (plansError) throw new Error(plansError.message);

          const plans: PlanWithPrice[] = data.plans || [];
          const foundYearlyPlan = plans.find(p => p.interval === 'year');
          
          if (foundYearlyPlan) {
            setYearlyPlan(foundYearlyPlan);
          } else {
            setError('The yearly subscription plan could not be found for your region.');
          }

        } catch (plansError) {
          console.error('Error fetching plans:', plansError);
          setError('Could not load the subscription plan. Please try again later.');
        } finally {
          setLoading(false);
        }
      };

      determineLocationAndFetchPlans();
    }
  }, [isOpen, yearlyPlan]);

  const handleSubscribe = async (priceId: number | string) => {
    if (!user) {
      alert('Please sign in to subscribe.');
      signInWithGoogle();
      return;
    }
    setIsSubscribing(true);
    try {
      const planType = 'yearly';
      // Find the yearly plan from the plans array to get the correct amount
      const yearlyPlan = plans.find(plan => plan.interval === 'year');
      const amount = yearlyPlan ? yearlyPlan.price.amount : 299000; // ₹2,990 in paise as fallback
      
      console.log('Yearly plan:', yearlyPlan);
      console.log('Amount:', amount);
      
      // Direct Razorpay integration
      if (!isRazorpayLoaded) throw new Error('Razorpay script is not yet loaded.');
      
      const options = {
        key: 'rzp_test_RIdOOohLUUFJhr', // Your actual Razorpay key
        amount: amount,
        currency: yearlyPlan.price.currency.toUpperCase(), // Use currency from location-based plan
        name: 'AuraAI Astrology',
        description: 'Yearly Subscription',
        handler: async (response: any) => {
          console.log('💳 Payment successful:', response);
          
          try {
            // Get current user state first
            const { data: existingUser, error: fetchError } = await supabase
              .from('users')
              .select('*')
              .eq('id', user.id)
              .single();
              
            console.log('📊 Current user data:', existingUser);
            console.log('📊 Fetch error:', fetchError);
            
            // Use UPSERT for reliable insert-or-update
            const { data: result, error: upsertError } = await supabase
              .from('users')
              .upsert({
                id: user.id,
                email: user.email,
                plan_tier: planType,
                subscription_status: 'active',
                subscription_start_date: new Date().toISOString(),
                subscription_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                coin_balance: existingUser?.coin_balance || 5
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
          ondismiss: () => {
            setIsSubscribing(false);
          }
        }
      };
      
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        alert('Payment failed. Please try again.');
        console.error('Payment failed:', response.error);
        setIsSubscribing(false);
      });

      // Track Payment Gateway Initiated
      if (typeof window !== 'undefined' && (window as any).clevertap) {
        (window as any).clevertap.event.push('Payment Gateway Initiated', {
          'Plan': 'Yearly',
          'Amount': amount / 100,
          'Currency': yearlyPlan?.price.currency || 'INR',
          'Gateway': 'Razorpay',
          'Source': 'Upgrade Profiles Modal'
        });
      }

      rzp.open();
      
    } catch (err: any) {
      console.error('Subscription Error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      // Note: We don't set loading to false here because Razorpay modal handles it
    }
  };
  
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount / 100);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upgrade to Unlock More Profiles">
      <div className={styles.modalContent}>
        {loading && <p>Loading plan...</p>}
        {error && <p className={styles.errorText}>{error}</p>}
        
        {!loading && !error && yearlyPlan && (
          <>
            <p className={styles.description}>
              To add and manage multiple cosmic profiles, please upgrade to our Yearly Plan.
            </p>
            <div className={styles.planBox}>
              <div className={styles.planDetails}>
                <h3 className={styles.planName}>{yearlyPlan.name}</h3>
                <p>{yearlyPlan.description}</p>
              </div>
              <div className={styles.priceDetails}>
                <span className={styles.priceAmount}>
                  {formatCurrency(yearlyPlan.price.amount, yearlyPlan.price.currency)}
                </span>
                <span className={styles.priceInterval}>/ year</span>
              </div>
            </div>
            <button
              className={styles.upgradeButton}
              onClick={() => handleSubscribe(yearlyPlan.price.id)}
              disabled={isSubscribing}
            >
              {isSubscribing ? 'Processing...' : 'Upgrade to Yearly'}
            </button>
            <button className={styles.secondaryButton} onClick={onClose}>
              Maybe Later
            </button>
          </>
        )}
      </div>
    </Modal>
  );
};

export default UpgradeForProfilesModal;
// src/pages/SubscriptionManagementPage.tsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import styles from './SubscriptionManagementPage.module.css';
import { trackEvent } from '../utils/analytics';

export default function SubscriptionManagementPage() {
  const { user, planTier, subscriptionStatus, currentPeriodEnd } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if no active subscription
    if (!user || !subscriptionStatus || subscriptionStatus !== 'active') {
      navigate('/account');
    }
  }, [user, subscriptionStatus, navigate]);

  useEffect(() => {
    if (user && subscriptionStatus === 'active') {
      trackEvent('Subscription Viewed', {
        plan_tier: planTier,
        subscription_status: subscriptionStatus
      });
    }
  }, [user, planTier, subscriptionStatus]);

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    trackEvent('Subscription Cancellation Initiated', {
      plan_tier: planTier
    });

    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription');
      if (error) throw new Error(error.message || 'Cancellation failed');
      if ((data as any)?.error) throw new Error((data as any).error);

      setSuccess('Cancellation scheduled. You will retain access until the end of your current billing period.');
      trackEvent('Subscription Cancellation Success', {
        plan_tier: planTier
      });

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription');
      trackEvent('Subscription Cancellation Failed', {
        plan_tier: planTier,
        error: err?.message || 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPlanDisplayName = (tier: string | null) => {
    switch (tier) {
      case 'monthly': return 'Monthly Plan';
      case 'yearly': return 'Yearly Plan';
      default: return 'Free Plan';
    }
  };

  if (!user || !subscriptionStatus || subscriptionStatus !== 'active') {
    return (
      <div className={styles.container} style={{ textAlign: 'center' }}>
        <h2 className={styles.heading}>No Active Subscription</h2>
        <p style={{ color: 'rgba(255,255,255,.85)', marginBottom: 12 }}>You don't have an active subscription to manage.</p>
        <button className={styles.primaryBtn} onClick={() => navigate('/account')}>Go to Account</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Subscription Management</h2>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Current Subscription</h3>
        <div className={styles.grid}>
          <div><strong>Plan:</strong> <span>{getPlanDisplayName(planTier)}</span></div>
          <div><strong>Status:</strong> <span style={{ color: subscriptionStatus === 'active' ? '#28a745' : '#dc3545', fontWeight: 700, textTransform: 'capitalize' }}>{subscriptionStatus}</span></div>
          <div><strong>Next Billing Date:</strong> <span>{formatDate(currentPeriodEnd)}</span></div>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Manage Your Subscription</h3>
        <div className={styles.grid}>
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700 }}>Cancel Subscription</h4>
            <p style={{ margin: '0 0 12px 0', color: 'rgba(255,255,255,.85)' }}>Cancelling your subscription will end your access at the end of your current billing period. You will not be charged again.</p>
            <button className={styles.dangerBtn} onClick={handleCancelSubscription} disabled={isLoading} style={{ opacity: isLoading ? .6 : 1 }}>
              {isLoading ? 'Cancelling...' : 'Cancel Subscription'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Need Help?</h3>
        <p style={{ margin: '0 0 14px 0', color: 'rgba(255,255,255,.85)' }}>If you have questions about your subscription or need assistance, please contact our support team.</p>
        <div className={styles.actionsRow}>
          <button className={styles.primaryBtn} onClick={() => navigate('/account')}>Back to Account</button>
          <button className={styles.secondaryBtn} onClick={() => window.location.href = 'mailto:support@astroaura.ai'}>Contact Support</button>
        </div>
      </div>

      {error && (<div className={styles.alert}>{error}</div>)}

      {success && (<div className={styles.success}>{success}</div>)}
    </div>
  );
}
// src/components/SubscriptionWidget.tsx

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import styles from './SubscriptionWidget.module.css';
import deleteIcon from '../assets/DeleteIcon.svg'


const formatDate = (dateString: string | null) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function SubscriptionWidget() {
  const { planTier, subscriptionStatus, currentPeriodEnd } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleManageSubscription = async () => {
    setLoading(true);
    const promise = supabase.functions.invoke('create-customer-portal-session');

    toast.promise(promise, {
      loading: 'Opening portal...',
      success: (data) => {
        window.location.href = data.data.portalUrl;
        return 'Redirecting to subscription portal...';
      },
      error: 'Could not open portal. Please try again.'
    }).finally(() => setLoading(false));
  };



  const handleDeleteClick = () => {
    const toastId = toast.custom((t) => (
      <div
        style={{
          padding: "16px",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          minWidth: "260px",
          border: "2px solid #EC4899",
          background:"#FFF0F3",
          boxShadow: "0 0 20.331px 0 rgba(236, 72, 153, 0.31)",
        }}
      >
        <p style={{ color: "black" }}>Are you sure you want to delete your account permanently?</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={() => {
              handleDeleteAccount();
              toast.dismiss(toastId);
            }}
            style={{
              background: "red",
              color: "white",
              padding: "6px 12px",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Yes, Delete
          </button>
          <button
            onClick={() => toast.dismiss(toastId)}
            style={{
              background: "#ddd",
              padding: "6px 12px",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    ));
  };

  const handleDeleteAccount = () => {
    console.log("Account deleted ");
    toast.success("Your account has been deleted.");
  };


  return (
    <div className={styles.widget}>
      <div className={styles.widgetContainer}>
        <h2 className={styles.title}>Subscription Management</h2>

        {planTier === 'free' && (
          <div className={styles.planBox}>
            <div className={styles.planInfo}>
              <span className={styles.planName}>Free Tier</span>
              <span className={styles.planDescription}>Upgrade for premium features.</span>
            </div>
          </div>
        )}

        {planTier !== 'free' && (
          <div className={styles.planBox} style={{ background: 'linear-gradient(90deg, rgba(229, 180, 91, 0.14) 0%, rgba(97, 7, 43, 0.35) 100%)', outline: '1px solid rgba(229, 180, 91, 0.35)' }}>
            <div className={styles.planInfo}>
              <span className={styles.planName} style={{ color: '#E5B45B' }}>
                {planTier === 'monthly' ? 'Premium Monthly' : 'Premium Yearly'}
              </span>
              <span className={styles.planDescription}>
                {subscriptionStatus === 'active' && `Next billing: ${formatDate(currentPeriodEnd)}`}
                {subscriptionStatus === 'cancelled' && `Access ends: ${formatDate(currentPeriodEnd)}`}
                {subscriptionStatus === 'past_due' && 'Payment failed'}
              </span>
            </div>
            {subscriptionStatus === 'active' && <div className={styles.statusBadge}>Active</div>}
          </div>
        )}

        <div className={styles.actionGrid}>
          <Link to="/#pricing" className={styles.actionBox}>
            <span className={styles.actionTitle}>Upgrade Plan</span>
            <span className={styles.actionSubtitle}>Get VIP access and exclusive features</span>
          </Link>
          <button onClick={handleManageSubscription} disabled={loading} className={styles.actionBox}>
            <span className={styles.actionTitle}>Manage Billing</span>
            <span className={styles.actionSubtitle}>Update payment or cancel your plan</span>
          </button>
        </div>
      </div>

      <div className={styles.accountContainer}>
        <h2 className={styles.accountTitle}>Account Actions</h2>

        <div className={styles.accountBox}>
          <div className={styles.deleteAction}>
            <span className={styles.deleteIcon}>
              <img src={deleteIcon} alt="alt" />
            </span>
            <div className={styles.deleteText} onClick={handleDeleteClick} style={{ cursor: "pointer" }}>
              <span className={styles.deleteTitle}>Delete Account</span>
              <span className={styles.deleteSubtitle}>Permanently remove</span>
            </div>

          </div>
        </div>
      </div>
    </div>



  );
}
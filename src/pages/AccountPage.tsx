import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext';
import WalletRecharge from '../components/WalletRecharge';
import NotificationPreferences from '../components/NotificationPreferences';

type TabType = 'subscription' | 'wallet';

export default function AccountPage() {
  const { user, planTier, subscriptionStatus, currentPeriodEnd, walletBalance } = useAuth();
  const { formatPrice } = usePricing();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('wallet');

  const isPremium = useMemo(() => planTier === 'monthly' || planTier === 'yearly', [planTier]);

  const handleOpenPortal = async () => {
    setIsLoading(true);
    setError(null);
    try {
      navigate('/subscription-management');
    } catch (e: any) {
      setError(e.message || 'Failed to open membership page');
    } finally {
      setIsLoading(false);
    }
  };

  const disabled = isLoading || !user;

  if (activeTab === 'wallet' && user) {
    return <WalletRecharge />;
  }

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '2px solid #333' }}>
        <button
          onClick={() => setActiveTab('subscription')}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'subscription' ? '3px solid #ed0687' : '3px solid transparent',
            color: activeTab === 'subscription' ? '#ed0687' : '#ccc',
            fontWeight: activeTab === 'subscription' ? 'bold' : 'normal',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Subscription
        </button>
        <button
          onClick={() => setActiveTab('wallet')}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'wallet' ? '3px solid #ed0687' : '3px solid transparent',
            color: activeTab === 'wallet' ? '#ed0687' : '#ccc',
            fontWeight: activeTab === 'wallet' ? 'bold' : 'normal',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Wallet
        </button>
      </div>

      <h2>Account</h2>
      {!user && <p>Please sign in to view your account.</p>}

      {user && (
        <div style={{ display: 'grid', gap: 16 }}>
          <section style={{ border: '1px solid #333', borderRadius: 8, padding: 16 }}>
            <h3>Subscription</h3>
            <p>
              Plan: <strong>{planTier || 'free'}</strong>
              {subscriptionStatus && <> · Status: <strong>{subscriptionStatus}</strong></>}
              {currentPeriodEnd && <> · Renews: <strong>{new Date(currentPeriodEnd).toLocaleString()}</strong></>}
            </p>
            {isPremium ? (
              <button onClick={handleOpenPortal} disabled={disabled} style={{ padding: '8px 12px' }}>
                Manage membership
              </button>
            ) : (
              <button onClick={() => navigate('/quick-recharge')} disabled={disabled} style={{ padding: '8px 12px' }}>
                Upgrade membership
              </button>
            )}
          </section>

          <section style={{ border: '1px solid #333', borderRadius: 8, padding: 16 }}>
            <h3>Wallet</h3>
            <p style={{ marginBottom: 12 }}>
              Balance: <strong>{walletBalance != null ? formatPrice(walletBalance) : '...'}</strong>
            </p>
            <p style={{ fontSize: 14, color: '#ccc', marginBottom: 12 }}>
              All chat, calls, and reports are charged from your wallet balance.
            </p>
            <button onClick={() => setActiveTab('wallet')} disabled={disabled} style={{ padding: '8px 12px' }}>
              Recharge wallet
            </button>
          </section>

          <section style={{ border: '1px solid #333', borderRadius: 8, padding: 16 }}>
            <h3>Notifications</h3>
            <p style={{ fontSize: 14, color: '#ccc', marginBottom: 12 }}>
              Control which web push notifications you receive from Vidhi.
            </p>
            <NotificationPreferences />
          </section>

          {error && <p style={{ color: '#FF6B6B' }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

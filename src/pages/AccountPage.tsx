import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import WalletRecharge from '../components/WalletRecharge';
import NotificationPreferences from '../components/NotificationPreferences';

type TabType = 'subscription' | 'wallet';

export default function AccountPage() {
  const { user, planTier, subscriptionStatus, currentPeriodEnd, coinBalance } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [coinsToBuy, setCoinsToBuy] = useState<number>(10);
  const [activeTab, setActiveTab] = useState<TabType>('wallet');

  const isPremium = useMemo(() => planTier === 'monthly' || planTier === 'yearly', [planTier]);

  const handleOpenPortal = async () => {
    setIsLoading(true); setError(null); setSuccess(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-customer-portal-session');
      if (error) throw new Error(error.message || 'Failed to create portal session');
      if (data && (data as any).error) throw new Error((data as any).error);

      // Navigate to subscription management page directly
      navigate('/subscription-management');
    } catch (e: any) {
      setError(e.message || 'Failed to open portal');
    } finally { setIsLoading(false); }
  };

  const handleBuyCoins = async () => {
    setIsLoading(true); setError(null); setSuccess(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-topup-session', { body: { coins: coinsToBuy } });
      if (error) throw new Error(error.message || 'Failed to create top-up session');
      
      if (data?.gateway === 'stripe' && data?.url) {
        window.location.href = data.url;
        return;
      }
      
      if (data?.gateway === 'razorpay' && data?.order) {
        // Initialize Razorpay Checkout
        const options = {
          key: data.key_id || 'rzp_test_RIdOOohLUUFJhr',
          amount: data.order.amount,
          currency: data.order.currency,
          name: 'AuraAI Coin Top-up',
          description: `${coinsToBuy} coins`,
          order_id: data.order.id,
          handler: function(response: any) {
            setSuccess(`Payment successful! ${coinsToBuy} coins will be added to your account shortly.`);
            // Refresh coin balance after successful payment
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          },
          prefill: {
            email: user?.email,
          },
          theme: {
            color: '#007acc'
          }
        };
        
        // Load Razorpay script if not already loaded
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
        return;
      }
      
      throw new Error('Invalid payment gateway response');
    } catch (e: any) {
      setError(e.message || 'Failed to initiate top-up');
    } finally { setIsLoading(false); }
  };

  const disabled = isLoading || !user;

  // If user is viewing wallet tab, show the WalletRecharge component
  if (activeTab === 'wallet' && user) {
    return <WalletRecharge />;
  }

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px' }}>
      {/* Tab Navigation */}
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
            transition: 'all 0.3s ease'
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
            transition: 'all 0.3s ease'
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
                Manage Subscription
              </button>
            ) : (
              <button onClick={() => { window.location.href = '/#pricing'; }} disabled={disabled} style={{ padding: '8px 12px' }}>
                Start Subscription
              </button>
            )}
          </section>

          {/* ------ COIN RECHARGE SECTION, UPDATED FOR FIGMA-STYLE ------ */}
          <section className="account-coin-section">
            <h3 className="recharge-title">Wallet</h3>
            <div className="coin-balance-display">
              <span className="coin-card-icon" style={{ width: 28, height: 28 }}></span>
              <span className="coin-balance-text">Current Balance: {coinBalance ?? 0} coins</span>
            </div>
            <div className="coin-card-list">
              {[10, 15, 50, 100].map(amount => (
                <button
                  key={amount}
                  onClick={() => setCoinsToBuy(amount)}
                  className={`coin-card${coinsToBuy === amount ? ' selected' : ''}`}
                  disabled={disabled}
                >
                  <div className="coin-card-amount">{amount}</div>
                  <span className="coin-card-icon" />
                  <span className="coin-card-label">coins</span>
                </button>
              ))}
            </div>
            <button className="buy-coins-btn" onClick={handleBuyCoins} disabled={disabled}>Checkout – {coinsToBuy} coins</button>
          </section>

          <section style={{ border: '1px solid #333', borderRadius: 8, padding: 16 }}>
            <h3>Notifications</h3>
            <p style={{ fontSize: 14, color: '#ccc', marginBottom: 12 }}>
              Control which web push notifications you receive from AuraAI.
            </p>
            <NotificationPreferences />
          </section>

          {error && <p style={{ color: '#FF6B6B' }}>{error}</p>}
          {success && <p style={{ color: '#66FF99' }}>{success}</p>}
        </div>
      )}
    </div>
  );
}



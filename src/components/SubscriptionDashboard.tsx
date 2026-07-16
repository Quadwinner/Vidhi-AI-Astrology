import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import styles from './SubscriptionDashboard.module.css';
import { useCallCoinCost } from '../hooks/useCallCoinCost';

interface SubscriptionDetails {
  status: string;
  current_period_end: string;
  gateway_subscription_id: string;
  management_url?: string;
  plan_name?: string;
}

interface PaymentHistory {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  description: string;
}

export default function SubscriptionDashboard() {
  const { user, planTier, subscriptionStatus, currentPeriodEnd, coinBalance } = useAuth();
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'billing' | 'coins'>('overview');
  const [chatCoinCost, setChatCoinCost] = useState<number>(1);
  const callCoinCost = useCallCoinCost();

  const isPremium = planTier === 'monthly' || planTier === 'yearly';

  useEffect(() => {
    if (user) {
      fetchSubscriptionDetails();
      fetchChatCoinCost();
    }
  }, [user]);

  const fetchChatCoinCost = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'chat_coin_cost')
        .maybeSingle();
      if (data?.value) {
        const cost = parseInt(data.value, 10);
        if (!isNaN(cost) && cost >= 0) {
          setChatCoinCost(cost);
        }
      }
    } catch (err) {
      console.error('Error fetching chat coin cost:', err);
    }
  };

  const fetchSubscriptionDetails = async () => {
    try {
      setIsLoading(true);
      
      // Fetch subscription details
      const { data: subData, error: subError } = await supabase
        .from('users_subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError && subError.code !== 'PGRST116') {
        throw subError;
      }

      setSubscriptionDetails(subData);

      // Simulate payment history (replace with actual API call)
      // In a real implementation, you'd fetch this from your payment gateway or database
      const mockHistory: PaymentHistory[] = [
        {
          id: '1',
          amount: planTier === 'monthly' ? 999 : planTier === 'yearly' ? 9999 : 0,
          currency: 'INR',
          status: 'succeeded',
          created_at: new Date().toISOString(),
          description: `${planTier} subscription`
        }
      ];
      setPaymentHistory(mockHistory);

    } catch (err: any) {
      setError(err.message || 'Failed to fetch subscription details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setError(null);
      const { data, error } = await supabase.functions.invoke('create-customer-portal-session');
      if (error) throw new Error(error.message || 'Failed to open management portal');
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No management URL received');
      }
    } catch (err: any) {
      console.error('Management portal error:', err);
      setError(err.message || 'Failed to open subscription management. Please try again or contact support.');
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.')) {
      return;
    }
    await handleManageSubscription();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(amount / 100);
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <p>Please sign in to view your subscription dashboard.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading subscription details...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Subscription Dashboard</h1>
        <p>Manage your subscription and billing preferences</p>
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'billing' ? styles.active : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          Billing & Plans
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'coins' ? styles.active : ''}`}
          onClick={() => setActiveTab('coins')}
        >
          Coin Management
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className={styles.section}>
          <div className={styles.grid}>
            <div className={styles.card}>
              <h3>Current Plan</h3>
              <div className={styles.planBadge}>
                {planTier ? planTier.charAt(0).toUpperCase() + planTier.slice(1) : 'Free'}
              </div>
              <p>
                Status: <span className={`${styles.status} ${styles[subscriptionStatus || 'free']}`}>
                  {subscriptionStatus ? subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1) : 'Free'}
                </span>
              </p>
              {currentPeriodEnd && (
                <p>Renews on: {formatDate(currentPeriodEnd)}</p>
              )}
            </div>

            <div className={styles.card}>
              <h3>Coin Balance</h3>
              <div className={styles.coinBalance}>{coinBalance || 0}</div>
              <p>Available coins for premium features</p>
            </div>

            <div className={styles.card}>
              <h3>Account Status</h3>
              <div className={styles.accountStatus}>
                {isPremium ? (
                  <span className={styles.premium}>Premium Active</span>
                ) : (
                  <span className={styles.free}>Free Account</span>
                )}
              </div>
              <p>{isPremium ? 'All features unlocked' : 'Limited features available'}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className={styles.section}>
          <div className={styles.card}>
            <h3>Subscription Details</h3>
            {isPremium ? (
              <div>
                <p><strong>Plan:</strong> {planTier} subscription</p>
                <p><strong>Status:</strong> {subscriptionStatus}</p>
                <p><strong>Next billing:</strong> {currentPeriodEnd ? formatDate(currentPeriodEnd) : 'N/A'}</p>
                {subscriptionDetails?.gateway_subscription_id && (
                  <p><strong>Subscription ID:</strong> {subscriptionDetails.gateway_subscription_id}</p>
                )}
                <div className={styles.actions}>
                  <button className={styles.primaryBtn} onClick={handleManageSubscription}>
                    Manage Subscription
                  </button>
                  <button className={styles.dangerBtn} onClick={handleCancelSubscription}>
                    Cancel Subscription
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p>You're currently on the free plan.</p>
                <button className={styles.primaryBtn} onClick={() => window.location.href = '/'}>
                  Upgrade to Premium
                </button>
              </div>
            )}
          </div>

          <div className={styles.card}>
            <h3>Payment History</h3>
            {paymentHistory.length > 0 ? (
              <div className={styles.paymentHistory}>
                {paymentHistory.map((payment) => (
                  <div key={payment.id} className={styles.paymentItem}>
                    <div>
                      <p><strong>{payment.description}</strong></p>
                      <p className={styles.small}>
                        {formatDate(payment.created_at)} • {formatCurrency(payment.amount, payment.currency)}
                      </p>
                    </div>
                    <span className={`${styles.status} ${styles[payment.status]}`}>
                      {payment.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p>No payment history available.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'coins' && (
        <div className={styles.section}>
          <div className={styles.card}>
            <h3>Coin Management</h3>
            <p>Current balance: <strong>{coinBalance || 0} coins</strong></p>
            <p>Coins are used for premium AI interactions and advanced features.</p>
            
            <div className={styles.coinTopup}>
              <h4>Top up Coins</h4>
              <div className={styles.coinOptions}>
                {[10, 25, 50, 100].map(amount => (
                  <div key={amount} className={styles.coinOption}>
                    <div className={styles.coinAmount}>{amount} coins</div>
                    <div className={styles.coinPrice}>₹{amount === 10 ? 99 : amount === 25 ? 249 : amount === 50 ? 499 : 999}</div>
                    <button
                      className={styles.coinBtn}
                      onClick={async () => {
                        try {
                          setError(null);
                          const { data, error } = await supabase.functions.invoke('create-topup-session', { body: { coins: amount } });
                          if (error) throw error;

                          // Handle different gateways
                          if (data.gateway === 'stripe' && data.url) {
                            window.location.href = data.url;
                          } else if (data.gateway === 'razorpay' && data.order) {
                            // Initialize Razorpay checkout
                            const options = {
                              key: data.key_id,
                              amount: data.order.amount,
                              currency: data.order.currency,
                              name: "Aura AI",
                              description: `Top-up ${amount} coins`,
                              order_id: data.order.id,
                              handler: function(response: any) {
                                console.log
                                interface SubscriptionDetails {
                                  status: string;
                                  current_period_end: string;
                                  gateway_subscription_id: string;
                                  management_url?: string;
                                  plan_name?: string;
                                }
                                
                                interface PaymentHistory {
                                  id: string;
                                  amount: number;
                                  currency: string;
                                  status: string;
                                  created_at: string;
                                  description: string;
                                }
                                
                                export default function SubscriptionDashboard() {
                                  const { user, planTier, subscriptionStatus, currentPeriodEnd, coinBalance } = useAuth();
                                  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
                                  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
                                  const [isLoading, setIsLoading] = useState(true);
                                  const [error, setError] = useState<string | null>(null);
                                  const [activeTab, setActiveTab] = useState<'overview' | 'billing' | 'coins'>('overview');
                                  const [chatCoinCost, setChatCoinCost] = useState<number>(1);
                                  const callCoinCost = useCallCoinCost();
                                
                                  const isPremium = planTier === 'monthly' || planTier === 'yearly';
                                
                                  useEffect(() => {
                                    if (user) {
                                      fetchSubscriptionDetails();
                                      fetchChatCoinCost();
                                    }
                                  }, [user]);
                                
                                  const fetchChatCoinCost = async () => {
                                    try {
                                      const { data } = await supabase
                                        .from('settings')
                                        .select('value')
                                        .eq('key', 'chat_coin_cost')
                                        .maybeSingle();
                                      if (data?.value) {
                                        const cost = parseInt(data.value, 10);
                                        if (!isNaN(cost) && cost >= 0) {
                                          setChatCoinCost(cost);
                                        }
                                      }
                                    } catch (err) {
                                      console.error('Error fetching chat coin cost:', err);
                                    }
                                  };
                                
                                  const fetchSubscriptionDetails = async () => {
                                    try {
                                      setIsLoading(true);
                                      
                                      // Fetch subscription details
                                      const { data: subData, error: subError } = await supabase
                                        .from('users_subscriptions')
                                        .select('*')
                                        .eq('user_id', user?.id)
                                        .order('created_at', { ascending: false })
                                        .limit(1)
                                        .maybeSingle();
                                
                                      if (subError && subError.code !== 'PGRST116') {
                                        throw subError;
                                      }
                                
                                      setSubscriptionDetails(subData);
                                
                                      // Simulate payment history (replace with actual API call)
                                      // In a real implementation, you'd fetch this from your payment gateway or database
                                      const mockHistory: PaymentHistory[] = [
                                        {
                                          id: '1',
                                          amount: planTier === 'monthly' ? 999 : planTier === 'yearly' ? 9999 : 0,
                                          currency: 'INR',
                                          status: 'succeeded',
                                          created_at: new Date().toISOString(),
                                          description: `${planTier} subscription`
                                        }
                                      ];
                                      setPaymentHistory(mockHistory);
                                
                                    } catch (err: any) {
                                      setError(err.message || 'Failed to fetch subscription details');
                                    } finally {
                                      setIsLoading(false);
                                    }
                                  };
                                
                                  const handleManageSubscription = async () => {
                                    try {
                                      setError(null);
                                      const { data, error } = await supabase.functions.invoke('create-customer-portal-session');
                                      if (error) throw new Error(error.message || 'Failed to open management portal');
                                      if (data?.url) {
                                        window.location.href = data.url;
                                      } else {
                                        throw new Error('No management URL received');
                                      }
                                    } catch (err: any) {
                                      console.error('Management portal error:', err);
                                      setError(err.message || 'Failed to open subscription management. Please try again or contact support.');
                                    }
                                  };
                                
                                  const handleCancelSubscription = async () => {
                                    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.')) {
                                      return;
                                    }
                                    await handleManageSubscription();
                                  };
                                
                                  const formatDate = (dateString: string) => {
                                    return new Date(dateString).toLocaleDateString('en-IN', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    });
                                  };
                                
                                  const formatCurrency = (amount: number, currency: string = 'INR') => {
                                    return new Intl.NumberFormat('en-IN', {
                                      style: 'currency',
                                      currency: currency,
                                      minimumFractionDigits: 0
                                    }).format(amount / 100);
                                  };
                                
                                  if (!user) {
                                    return (
                                      <div className={styles.container}>
                                        <p>Please sign in to view your subscription dashboard.</p>
                                      </div>
                                    );
                                  }
                                
                                  if (isLoading) {
                                    return (
                                      <div className={styles.container}>
                                        <div className={styles.loading}>Loading subscription details...</div>
                                      </div>
                                    );
                                  }
                                
                                  return (
                                    <div className={styles.container}>
                                      <div className={styles.header}>
                                        <h1>Subscription Dashboard</h1>
                                        <p>Manage your subscription and billing preferences</p>
                                      </div>
                                
                                      <div className={styles.tabs}>
                                        <button 
                                          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
                                          onClick={() => setActiveTab('overview')}
                                        >
                                          Overview
                                        </button>
                                        <button 
                                          className={`${styles.tab} ${activeTab === 'billing' ? styles.active : ''}`}
                                          onClick={() => setActiveTab('billing')}
                                        >
                                          Billing & Plans
                                        </button>
                                        <button 
                                          className={`${styles.tab} ${activeTab === 'coins' ? styles.active : ''}`}
                                          onClick={() => setActiveTab('coins')}
                                        >
                                          Coin Management
                                        </button>
                                      </div>
                                
                                      {error && (
                                        <div className={styles.error}>
                                          <strong>Error:</strong> {error}
                                        </div>
                                      )}
                                
                                      {activeTab === 'overview' && (
                                        <div className={styles.section}>
                                          <div className={styles.grid}>
                                            <div className={styles.card}>
                                              <h3>Current Plan</h3>
                                              <div className={styles.planBadge}>
                                                {planTier ? planTier.charAt(0).toUpperCase() + planTier.slice(1) : 'Free'}
                                              </div>
                                              <p>
                                                Status: <span className={`${styles.status} ${styles[subscriptionStatus || 'free']}`}>
                                                  {subscriptionStatus ? subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1) : 'Free'}
                                                </span>
                                              </p>
                                              {currentPeriodEnd && (
                                                <p>Renews on: {formatDate(currentPeriodEnd)}</p>
                                              )}
                                            </div>
                                
                                            <div className={styles.card}>
                                              <h3>Coin Balance</h3>
                                              <div className={styles.coinBalance}>{coinBalance || 0}</div>
                                              <p>Available coins for premium features</p>
                                            </div>
                                
                                            <div className={styles.card}>
                                              <h3>Account Status</h3>
                                              <div className={styles.accountStatus}>
                                                {isPremium ? (
                                                  <span className={styles.premium}>Premium Active</span>
                                                ) : (
                                                  <span className={styles.free}>Free Account</span>
                                                )}
                                              </div>
                                              <p>{isPremium ? 'All features unlocked' : 'Limited features available'}</p>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                
                                      {activeTab === 'billing' && (
                                        <div className={styles.section}>
                                          <div className={styles.card}>
                                            <h3>Subscription Details</h3>
                                            {isPremium ? (
                                              <div>
                                                <p><strong>Plan:</strong> {planTier} subscription</p>
                                                <p><strong>Status:</strong> {subscriptionStatus}</p>
                                                <p><strong>Next billing:</strong> {currentPeriodEnd ? formatDate(currentPeriodEnd) : 'N/A'}</p>
                                                {subscriptionDetails?.gateway_subscription_id && (
                                                  <p><strong>Subscription ID:</strong> {subscriptionDetails.gateway_subscription_id}</p>
                                                )}
                                                <div className={styles.actions}>
                                                  <button className={styles.primaryBtn} onClick={handleManageSubscription}>
                                                    Manage Subscription
                                                  </button>
                                                  <button className={styles.dangerBtn} onClick={handleCancelSubscription}>
                                                    Cancel Subscription
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <div>
                                                <p>You're currently on the free plan.</p>
                                                <button className={styles.primaryBtn} onClick={() => window.location.href = '/'}>
                                                  Upgrade to Premium
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                
                                          <div className={styles.card}>
                                            <h3>Payment History</h3>
                                            {paymentHistory.length > 0 ? (
                                              <div className={styles.paymentHistory}>
                                                {paymentHistory.map((payment) => (
                                                  <div key={payment.id} className={styles.paymentItem}>
                                                    <div>
                                                      <p><strong>{payment.description}</strong></p>
                                                      <p className={styles.small}>
                                                        {formatDate(payment.created_at)} • {formatCurrency(payment.amount, payment.currency)}
                                                      </p>
                                                    </div>
                                                    <span className={`${styles.status} ${styles[payment.status]}`}>
                                                      {payment.status}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <p>No payment history available.</p>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                
                                      {activeTab === 'coins' && (
                                        <div className={styles.section}>
                                          <div className={styles.card}>
                                            <h3>Coin Management</h3>
                                            <p>Current balance: <strong>{coinBalance || 0} coins</strong></p>
                                            <p>Coins are used for premium AI interactions and advanced features.</p>
                                            
                                            <div className={styles.coinTopup}>
                                              <h4>Top up Coins</h4>
                                              <div className={styles.coinOptions}>
                                                {[10, 25, 50, 100].map(amount => (
                                                  <div key={amount} className={styles.coinOption}>
                                                    <div className={styles.coinAmount}>{amount} coins</div>
                                                    <div className={styles.coinPrice}>₹{amount === 10 ? 99 : amount === 25 ? 249 : amount === 50 ? 499 : 999}</div>
                                                    <button
                                                      className={styles.coinBtn}
                                                      onClick={async () => {
                                                        try {
                                                          setError(null);
                                                          const { data, error } = await supabase.functions.invoke('create-topup-session', { body: { coins: amount } });
                                                          if (error) throw error;
                                
                                                          // Handle different gateways
                                                          if (data.gateway === 'stripe' && data.url) {
                                                            window.location.href = data.url;
                                                          } else if (data.gateway === 'razorpay' && data.order) {
                                                            // Initialize Razorpay checkout
                                                            const options = {
                                                              key: data.key_id,
                                                              amount: data.order.amount,
                                                              currency: data.order.currency,
                                                              name: "Aura AI",
                                                              description: `Top-up ${amount} coins`,
                                                              order_id: data.order.id,
                                                              handler: function(response: any) {
                                                                console.log('Payment successful:', response);
                                                                // Refresh the page or update coin balance
                                                                window.location.reload();
                                                              },
                                                              prefill: {
                                                                email: user?.email,
                                                              },
                                                              theme: {
                                                                color: "#3399cc"
                                                              }
                                                            };
                                                            const rzp = new (window as any).Razorpay(options);
                                                            rzp.open();
                                                          }
                                                        } catch (err: any) {
                                                          setError(err.message || 'Failed to initiate coin top-up');
                                                        }
                                                      }}
                                           
interface SubscriptionDetails {
  status: string;
  current_period_end: string;
  gateway_subscription_id: string;
  management_url?: string;
  plan_name?: string;
}

interface PaymentHistory {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  description: string;
}

export default function SubscriptionDashboard() {
  const { user, planTier, subscriptionStatus, currentPeriodEnd, coinBalance } = useAuth();
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'billing' | 'coins'>('overview');
  const [chatCoinCost, setChatCoinCost] = useState<number>(1);
  const callCoinCost = useCallCoinCost();

  const isPremium = planTier === 'monthly' || planTier === 'yearly';

  useEffect(() => {
    if (user) {
      fetchSubscriptionDetails();
      fetchChatCoinCost();
    }
  }, [user]);

  const fetchChatCoinCost = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'chat_coin_cost')
        .maybeSingle();
      if (data?.value) {
        const cost = parseInt(data.value, 10);
        if (!isNaN(cost) && cost >= 0) {
          setChatCoinCost(cost);
        }
      }
    } catch (err) {
      console.error('Error fetching chat coin cost:', err);
    }
  };

  const fetchSubscriptionDetails = async () => {
    try {
      setIsLoading(true);
      
      // Fetch subscription details
      const { data: subData, error: subError } = await supabase
        .from('users_subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError && subError.code !== 'PGRST116') {
        throw subError;
      }

      setSubscriptionDetails(subData);

      // Simulate payment history (replace with actual API call)
      // In a real implementation, you'd fetch this from your payment gateway or database
      const mockHistory: PaymentHistory[] = [
        {
          id: '1',
          amount: planTier === 'monthly' ? 999 : planTier === 'yearly' ? 9999 : 0,
          currency: 'INR',
          status: 'succeeded',
          created_at: new Date().toISOString(),
          description: `${planTier} subscription`
        }
      ];
      setPaymentHistory(mockHistory);

    } catch (err: any) {
      setError(err.message || 'Failed to fetch subscription details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setError(null);
      const { data, error } = await supabase.functions.invoke('create-customer-portal-session');
      if (error) throw new Error(error.message || 'Failed to open management portal');
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No management URL received');
      }
    } catch (err: any) {
      console.error('Management portal error:', err);
      setError(err.message || 'Failed to open subscription management. Please try again or contact support.');
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.')) {
      return;
    }
    await handleManageSubscription();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(amount / 100);
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <p>Please sign in to view your subscription dashboard.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading subscription details...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Subscription Dashboard</h1>
        <p>Manage your subscription and billing preferences</p>
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'billing' ? styles.active : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          Billing & Plans
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'coins' ? styles.active : ''}`}
          onClick={() => setActiveTab('coins')}
        >
          Coin Management
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className={styles.section}>
          <div className={styles.grid}>
            <div className={styles.card}>
              <h3>Current Plan</h3>
              <div className={styles.planBadge}>
                {planTier ? planTier.charAt(0).toUpperCase() + planTier.slice(1) : 'Free'}
              </div>
              <p>
                Status: <span className={`${styles.status} ${styles[subscriptionStatus || 'free']}`}>
                  {subscriptionStatus ? subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1) : 'Free'}
                </span>
              </p>
              {currentPeriodEnd && (
                <p>Renews on: {formatDate(currentPeriodEnd)}</p>
              )}
            </div>

            <div className={styles.card}>
              <h3>Coin Balance</h3>
              <div className={styles.coinBalance}>{coinBalance || 0}</div>
              <p>Available coins for premium features</p>
            </div>

            <div className={styles.card}>
              <h3>Account Status</h3>
              <div className={styles.accountStatus}>
                {isPremium ? (
                  <span className={styles.premium}>Premium Active</span>
                ) : (
                  <span className={styles.free}>Free Account</span>
                )}
              </div>
              <p>{isPremium ? 'All features unlocked' : 'Limited features available'}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className={styles.section}>
          <div className={styles.card}>
            <h3>Subscription Details</h3>
            {isPremium ? (
              <div>
                <p><strong>Plan:</strong> {planTier} subscription</p>
                <p><strong>Status:</strong> {subscriptionStatus}</p>
                <p><strong>Next billing:</strong> {currentPeriodEnd ? formatDate(currentPeriodEnd) : 'N/A'}</p>
                {subscriptionDetails?.gateway_subscription_id && (
                  <p><strong>Subscription ID:</strong> {subscriptionDetails.gateway_subscription_id}</p>
                )}
                <div className={styles.actions}>
                  <button className={styles.primaryBtn} onClick={handleManageSubscription}>
                    Manage Subscription
                  </button>
                  <button className={styles.dangerBtn} onClick={handleCancelSubscription}>
                    Cancel Subscription
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p>You're currently on the free plan.</p>
                <button className={styles.primaryBtn} onClick={() => window.location.href = '/'}>
                  Upgrade to Premium
                </button>
              </div>
            )}
          </div>

          <div className={styles.card}>
            <h3>Payment History</h3>
            {paymentHistory.length > 0 ? (
              <div className={styles.paymentHistory}>
                {paymentHistory.map((payment) => (
                  <div key={payment.id} className={styles.paymentItem}>
                    <div>
                      <p><strong>{payment.description}</strong></p>
                      <p className={styles.small}>
                        {formatDate(payment.created_at)} • {formatCurrency(payment.amount, payment.currency)}
                      </p>
                    </div>
                    <span className={`${styles.status} ${styles[payment.status]}`}>
                      {payment.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p>No payment history available.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'coins' && (
        <div className={styles.section}>
          <div className={styles.card}>
            <h3>Coin Management</h3>
            <p>Current balance: <strong>{coinBalance || 0} coins</strong></p>
            <p>Coins are used for premium AI interactions and advanced features.</p>
            
            <div className={styles.coinTopup}>
              <h4>Top up Coins</h4>
              <div className={styles.coinOptions}>
                {[10, 25, 50, 100].map(amount => (
                  <div key={amount} className={styles.coinOption}>
                    <div className={styles.coinAmount}>{amount} coins</div>
                    <div className={styles.coinPrice}>₹{amount === 10 ? 99 : amount === 25 ? 249 : amount === 50 ? 499 : 999}</div>
                    <button
                      className={styles.coinBtn}
                      onClick={async () => {
                        try {
                          setError(null);
                          const { data, error } = await supabase.functions.invoke('create-topup-session', { body: { coins: amount } });
                          if (error) throw error;

                          // Handle different gateways
                          if (data.gateway === 'stripe' && data.url) {
                            window.location.href = data.url;
                          } else if (data.gateway === 'razorpay' && data.order) {
                            // Initialize Razorpay checkout
                            const options = {
                              key: data.key_id,
                              amount: data.order.amount,
                              currency: data.order.currency,
                              name: "Aura AI",
                              description: `Top-up ${amount} coins`,
                              order_id: data.order.id,
                              handler: function(response: any) {
                                console.log('Payment successful:', response);
                                // Refresh the page or update coin balance
                                window.location.reload();
                              },
                              prefill: {
                                email: user?.email,
                              },
                              theme: {
                                color: "#3399cc"
                              }
                            };
                            const rzp = new (window as any).Razorpay(options);
                            rzp.open();
                            interface SubscriptionDetails {
                              status: string;
                              current_period_end: string;
                              gateway_subscription_id: string;
                              management_url?: string;
                              plan_name?: string;
                            }
                            
                            interface PaymentHistory {
                              id: string;
                              amount: number;
                              currency: string;
                              status: string;
                              created_at: string;
                              description: string;
                            }
                            
                            export default function SubscriptionDashboard() {
                              const { user, planTier, subscriptionStatus, currentPeriodEnd, coinBalance } = useAuth();
                              const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
                              const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
                              const [isLoading, setIsLoading] = useState(true);
                              const [error, setError] = useState<string | null>(null);
                              const [activeTab, setActiveTab] = useState<'overview' | 'billing' | 'coins'>('overview');
                              const [chatCoinCost, setChatCoinCost] = useState<number>(1);
                              const callCoinCost = useCallCoinCost();
                            
                              const isPremium = planTier === 'monthly' || planTier === 'yearly';
                            
                              useEffect(() => {
                                if (user) {
                                  fetchSubscriptionDetails();
                                  fetchChatCoinCost();
                                }
                              }, [user]);
                            
                              const fetchChatCoinCost = async () => {
                                try {
                                  const { data } = await supabase
                                    .from('settings')
                                    .select('value')
                                    .eq('key', 'chat_coin_cost')
                                    .maybeSingle();
                                  if (data?.value) {
                                    const cost = parseInt(data.value, 10);
                                    if (!isNaN(cost) && cost >= 0) {
                                      setChatCoinCost(cost);
                                    }
                                  }
                                } catch (err) {
                                  console.error('Error fetching chat coin cost:', err);
                                }
                              };
                            
                              const fetchSubscriptionDetails = async () => {
                                try {
                                  setIsLoading(true);
                                  
                                  // Fetch subscription details
                                  const { data: subData, error: subError } = await supabase
                                    .from('users_subscriptions')
                                    .select('*')
                                    .eq('user_id', user?.id)
                                    .order('created_at', { ascending: false })
                                    .limit(1)
                                    .maybeSingle();
                            
                                  if (subError && subError.code !== 'PGRST116') {
                                    throw subError;
                                  }
                            
                                  setSubscriptionDetails(subData);
                            
                                  // Simulate payment history (replace with actual API call)
                                  // In a real implementation, you'd fetch this from your payment gateway or database
                                  const mockHistory: PaymentHistory[] = [
                                    {
                                      id: '1',
                                      amount: planTier === 'monthly' ? 999 : planTier === 'yearly' ? 9999 : 0,
                                      currency: 'INR',
                                      status: 'succeeded',
                                      created_at: new Date().toISOString(),
                                      description: `${planTier} subscription`
                                    }
                                  ];
                                  setPaymentHistory(mockHistory);
                            
                                } catch (err: any) {
                                  setError(err.message || 'Failed to fetch subscription details');
                                } finally {
                                  setIsLoading(false);
                                }
                              };
                            
                              const handleManageSubscription = async () => {
                                try {
                                  setError(null);
                                  const { data, error } = await supabase.functions.invoke('create-customer-portal-session');
                                  if (error) throw new Error(error.message || 'Failed to open management portal');
                                  if (data?.url) {
                                    window.location.href = data.url;
                                  } else {
                                    throw new Error('No management URL received');
                                  }
                                } catch (err: any) {
                                  console.error('Management portal error:', err);
                                  setError(err.message || 'Failed to open subscription management. Please try again or contact support.');
                                }
                              };
                            
                              const handleCancelSubscription = async () => {
                                if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.')) {
                                  return;
                                }
                                await handleManageSubscription();
                              };
                            
                              const formatDate = (dateString: string) => {
                                return new Date(dateString).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                });
                              };
                            
                              const formatCurrency = (amount: number, currency: string = 'INR') => {
                                return new Intl.NumberFormat('en-IN', {
                                  style: 'currency',
                                  currency: currency,
                                  minimumFractionDigits: 0
                                }).format(amount / 100);
                              };
                            
                              if (!user) {
                                return (
                                  <div className={styles.container}>
                                    <p>Please sign in to view your subscription dashboard.</p>
                                  </div>
                                );
                              }
                            
                              if (isLoading) {
                                return (
                                  <div className={styles.container}>
                                    <div className={styles.loading}>Loading subscription details...</div>
                                  </div>
                                );
                              }
                            
                              return (
                                <div className={styles.container}>
                                  <div className={styles.header}>
                                    <h1>Subscription Dashboard</h1>
                                    <p>Manage your subscription and billing preferences</p>
                                  </div>
                            
                                  <div className={styles.tabs}>
                                    <button 
                                      className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
                                      onClick={() => setActiveTab('overview')}
                                    >
                                      Overview
                                    </button>
                                    <button 
                                      className={`${styles.tab} ${activeTab === 'billing' ? styles.active : ''}`}
                                      onClick={() => setActiveTab('billing')}
                                    >
                                      Billing & Plans
                                    </button>
                                    <button 
                                      className={`${styles.tab} ${activeTab === 'coins' ? styles.active : ''}`}
                                      onClick={() => setActiveTab('coins')}
                                    >
                                      Coin Management
                                    </button>
                                  </div>
                            
                                  {error && (
                                    <div className={styles.error}>
                                      <strong>Error:</strong> {error}
                                    </div>
                                  )}
                            
                                  {activeTab === 'overview' && (
                                    <div className={styles.section}>
                                      <div className={styles.grid}>
                                        <div className={styles.card}>
                                          <h3>Current Plan</h3>
                                          <div className={styles.planBadge}>
                                            {planTier ? planTier.charAt(0).toUpperCase() + planTier.slice(1) : 'Free'}
                                          </div>
                                          <p>
                                            Status: <span className={`${styles.status} ${styles[subscriptionStatus || 'free']}`}>
                                              {subscriptionStatus ? subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1) : 'Free'}
                                            </span>
                                          </p>
                                          {currentPeriodEnd && (
                                            <p>Renews on: {formatDate(currentPeriodEnd)}</p>
                                          )}
                                        </div>
                            
                                        <div className={styles.card}>
                                          <h3>Coin Balance</h3>
                                          <div className={styles.coinBalance}>{coinBalance || 0}</div>
                                          <p>Available coins for premium features</p>
                                        </div>
                            
                                        <div className={styles.card}>
                                          <h3>Account Status</h3>
                                          <div className={styles.accountStatus}>
                                            {isPremium ? (
                                              <span className={styles.premium}>Premium Active</span>
                                            ) : (
                                              <span className={styles.free}>Free Account</span>
                                            )}
                                          </div>
                                          <p>{isPremium ? 'All features unlocked' : 'Limited features available'}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                            
                                  {activeTab === 'billing' && (
                                    <div className={styles.section}>
                                      <div className={styles.card}>
                                        <h3>Subscription Details</h3>
                                        {isPremium ? (
                                          <div>
                                            <p><strong>Plan:</strong> {planTier} subscription</p>
                                            <p><strong>Status:</strong> {subscriptionStatus}</p>
                                            <p><strong>Next billing:</strong> {currentPeriodEnd ? formatDate(currentPeriodEnd) : 'N/A'}</p>
                                            {subscriptionDetails?.gateway_subscription_id && (
                                              <p><strong>Subscription ID:</strong> {subscriptionDetails.gateway_subscription_id}</p>
                                            )}
                                            <div className={styles.actions}>
                                              <button className={styles.primaryBtn} onClick={handleManageSubscription}>
                                                Manage Subscription
                                              </button>
                                              <button className={styles.dangerBtn} onClick={handleCancelSubscription}>
                                                Cancel Subscription
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div>
                                            <p>You're currently on the free plan.</p>
                                            <button className={styles.primaryBtn} onClick={() => window.location.href = '/'}>
                                              Upgrade to Premium
                                            </button>
                                          </div>
                                        )}
                                      </div>
                            
                                      <div className={styles.card}>
                                        <h3>Payment History</h3>
                                        {paymentHistory.length > 0 ? (
                                          <div className={styles.paymentHistory}>
                                            {paymentHistory.map((payment) => (
                                              <div key={payment.id} className={styles.paymentItem}>
                                                <div>
                                                  <p><strong>{payment.description}</strong></p>
                                                  <p className={styles.small}>
                                                    {formatDate(payment.created_at)} • {formatCurrency(payment.amount, payment.currency)}
                                                  </p>
                                                </div>
                                                <span className={`${styles.status} ${styles[payment.status]}`}>
                                                  {payment.status}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p>No payment history available.</p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                            
                                  {activeTab === 'coins' && (
                                    <div className={styles.section}>
                                      <div className={styles.card}>
                                        <h3>Coin Management</h3>
                                        <p>Current balance: <strong>{coinBalance || 0} coins</strong></p>
                                        <p>Coins are used for premium AI interactions and advanced features.</p>
                                        
                                        <div className={styles.coinTopup}>
                                          <h4>Top up Coins</h4>
                                          <div className={styles.coinOptions}>
                                            {[10, 25, 50, 100].map(amount => (
                                              <div key={amount} className={styles.coinOption}>
                                                <div className={styles.coinAmount}>{amount} coins</div>
                                                <div className={styles.coinPrice}>₹{amount === 10 ? 99 : amount === 25 ? 249 : amount === 50 ? 499 : 999}</div>
                                                <button
                                                  className={styles.coinBtn}
                                                  onClick={async () => {
                                                    try {
                                                      setError(null);
                                                      const { data, error } = await supabase.functions.invoke('create-topup-session', { body: { coins: amount } });
                                                      if (error) throw error;
                            
                                                      // Handle different gateways
                                                      if (data.gateway === 'stripe' && data.url) {
                                                        window.location.href = data.url;
                                                      } else if (data.gateway === 'razorpay' && data.order) {
                                                        // Initialize Razorpay checkout
                                                        const options = {
                                                          key: data.key_id,
                                                          amount: data.order.amount,
                                                          currency: data.order.currency,
                                                          name: "Aura AI",
                                                          description: `Top-up ${amount} coins`,
                                                          order_id: data.order.id,
                                                          handler: function(response: any) {
                                                            console.log('Payment successful:', response);
                                                            // Refresh the page or update coin balance
                                                            window.location.reload();
                                                          },
                                                          prefill: {
                                                            email: user?.email,
                                                          },
                                                          theme: {
                                                            color: "#3399cc"
                                                          }
                                                        };
                                                        const rzp = new (window as any).Razorpay(options);
                                                        rzp.open();
                                                      }
                                                    } catch (err: any) {
                                                      setError(err.message || 'Failed to initiate coin top-up');
                                                    }
                                                  }}
                                                >
                                                  Buy Now
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                            
                                        <div className={styles.coinUsage}>
                                          <h4>Coin Usage</h4>
                                          <p>• AI Chat: {chatCoinCost} coin{chatCoinCost !== 1 ? 's' : ''} per message</p>
                                          <p>• Voice Calls: {callCoinCost} coin{callCoinCost !== 1 ? 's' : ''} per minute</p>
                                          <p>• Astrology Reports: 10 coins per report</p>
                                          <p>• Premium Features: Variable coin cost</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          }
                        } catch (err: any) {
                          setError(err.message || 'Failed to initiate coin top-up');
                        }
                      }}
                    >
                      Buy Now
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.coinUsage}>
              <h4>Coin Usage</h4>
              <p>• AI Chat: {chatCoinCost} coin{chatCoinCost !== 1 ? 's' : ''} per message</p>
              <p>• Voice Calls: {callCoinCost} coin{callCoinCost !== 1 ? 's' : ''} per minute</p>
              <p>• Astrology Reports: 10 coins per report</p>
              <p>• Premium Features: Variable coin cost</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}         >
                                                      Buy Now
                                                    </button>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                
                                            <div className={styles.coinUsage}>
                                              <h4>Coin Usage</h4>
                                              <p>• AI Chat: {chatCoinCost} coin{chatCoinCost !== 1 ? 's' : ''} per message</p>
                                              <p>• Voice Calls: {callCoinCost} coin{callCoinCost !== 1 ? 's' : ''} per minute</p>
                                              <p>• Astrology Reports: 10 coins per report</p>
                                              <p>• Premium Features: Variable coin cost</p>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }('Payment successful:', response);
                                // Refresh the page or update coin balance
                                window.location.reload();
                              },
                              prefill: {
                                email: user?.email,
                              },
                              theme: {
                                color: "#3399cc"
                              }
                            };
                            const rzp = new (window as any).Razorpay(options);
                            rzp.open();
                          }
                        } catch (err: any) {
                          setError(err.message || 'Failed to initiate coin top-up');
                        }
                      }}
                    >
                      Buy Now
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.coinUsage}>
              <h4>Coin Usage</h4>
              <p>• AI Chat: {chatCoinCost} coin{chatCoinCost !== 1 ? 's' : ''} per message</p>
              <p>• Voice Calls: {callCoinCost} coin{callCoinCost !== 1 ? 's' : ''} per minute</p>
              <p>• Astrology Reports: 10 coins per report</p>
              <p>• Premium Features: Variable coin cost</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
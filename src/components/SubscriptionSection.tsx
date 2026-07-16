import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import './SubscriptionSection.css';

export interface PlanWithPrice {
  id: string;
  name: string;
  description: string;
  interval: 'month' | 'year';
  price: {
    id: number | string;
    amount: number;
    currency: string;
    originalAmount?: number;
    wallet_credit_amount?: number;
  };
}

interface SubscriptionSectionProps {
  plans: PlanWithPrice[];
  onSubscribe: (priceId: number | string) => void;
  isSubscribing: boolean;
  activePlanId: number | null;
  isLoading: boolean;
  error: string | null;
  currentUserPlanId: string | null;
}

const Sym = ({ name, fill = false }: { name: string; fill?: boolean }) => (
  <span className="material-symbols-outlined" style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}>{name}</span>
);

const SubscriptionSection = React.forwardRef<HTMLElement, SubscriptionSectionProps>(
  ({ plans, onSubscribe, isSubscribing, activePlanId, isLoading, error, currentUserPlanId }, ref) => {

    const { currency, refreshUserStatus, user, walletBalance } = useAuth() as any;
    const { packages, formatPrice, isLoading: isPricingLoading, prices, showSubscriptions, variant } = usePricing() as any;
    const [isPurchasing, setIsPurchasing] = useState<string | null>(null);
    const [confirmingPackage, setConfirmingPackage] = useState<{ id: string, amount: number, price: number } | null>(null);

    // Track GST Summary View
    useEffect(() => {
      if (confirmingPackage && currency === 'INR') {
        const basePrice = confirmingPackage.price;
        const gstAmount = Number((basePrice * 0.18).toFixed(2));
        const totalPayable = Number((basePrice + gstAmount).toFixed(2));
        trackEvent('gst_summary_viewed', {
          package_id: confirmingPackage.id, base_amount: basePrice,
          gst_amount: gstAmount, total_payable: totalPayable, currency: 'INR'
        });
      }
    }, [confirmingPackage, currency]);

    // ---- RECHARGE LOGIC (unchanged) ----
    const executeRecharge = async (pkg: { id: string, amount: number, price: number }, finalAmountToPay: number, finalCreditAmount: number) => {
      try {
        const currencyToLog = currency || 'USD';
        trackEvent('Quick Recharge Started', { amount_credit: finalCreditAmount, amount_pay: finalAmountToPay, currency: currencyToLog, variant });
        setIsPurchasing(String(pkg.id));

        const { data, error } = await supabase.functions.invoke('create-topup-session', {
          body: { amount: finalAmountToPay, credit_amount: finalCreditAmount, currency: currencyToLog, package_id: pkg.id }
        });
        if (error) throw new Error(error.message || 'Failed to create checkout session');

        if (data?.gateway === 'razorpay' && data?.order) {
          const options = {
            key: data.key_id, amount: data.order.amount, currency: data.order.currency,
            name: 'Vidhi Wallet Recharge', description: `Add ${formatPrice(finalCreditAmount)}`, order_id: data.order.id,
            handler: async function (response: any) {
              trackEvent('Quick Recharge Succeeded', {
                package_id: pkg.id, amount_credit: finalCreditAmount, amount_pay: finalAmountToPay,
                currency: currencyToLog, razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id, user_id: user?.id, source: 'Subscription Section', variant
              });
              setConfirmingPackage(null);
              setTimeout(async () => { await refreshUserStatus(); setIsPurchasing(null); }, 1500);
            },
            modal: { ondismiss: function () { trackEvent('payment_modal_dismissed', { package_id: pkg.id }); setIsPurchasing(null); } },
            theme: { color: '#E5B45B' }
          };
          const razorpay = new (window as any).Razorpay(options);
          razorpay.open();
        } else if (data?.url) {
          window.location.href = data.url;
        }
      } catch (err: any) {
        trackEvent('Recharge Failed', { error_message: err.message });
        console.error('[SubscriptionSection] Recharge Error:', err);
        alert('Failed to initiate recharge. Please try again.');
        setIsPurchasing(null);
      }
    };

    const handleQuickRecharge = async (pkg: { id: string, amount: number, price: number }) => {
      if (currency === 'INR') { setConfirmingPackage(pkg); return; }
      executeRecharge(pkg, pkg.price, pkg.amount);
    };

    const renderPaymentSummary = () => {
      if (!confirmingPackage) return null;
      const basePrice = confirmingPackage.price;
      const creditAmount = confirmingPackage.amount;
      const gstAmount = Number((basePrice * 0.18).toFixed(2));
      const totalPayable = Number((basePrice + gstAmount).toFixed(2));
      const hasBonus = creditAmount > basePrice;
      const bonusAmount = creditAmount - basePrice;
      const bonusPercent = basePrice > 0 ? Math.round((bonusAmount / basePrice) * 100) : 0;
      const formatDecimalPrice = (val: number) => new Intl.NumberFormat('en-US', {
        style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(val / 100);

      return (
        <div className="payment-summary-overlay" onClick={() => !isPurchasing && setConfirmingPackage(null)}>
          <div className="summary-modal" onClick={e => e.stopPropagation()}>
            <div className="summary-header"><h3 className="summary-title">Payment Summary</h3></div>
            <div className="invoice-table">
              <div className="invoice-row"><span className="invoice-label">Recharge Amount</span><span className="invoice-value">{formatDecimalPrice(basePrice)}</span></div>
              <div className="invoice-row"><span className="invoice-label">GST @ 18%</span><span className="invoice-value">{formatDecimalPrice(gstAmount)}</span></div>
              <div className="invoice-row total-row"><span className="invoice-total-label">Total Amount</span><span className="invoice-total-value">{formatDecimalPrice(totalPayable)}</span></div>
            </div>
            <div className="benefit-section">
              <div className="benefit-card">
                <div className="benefit-text">
                  <span className="benefit-label">Total Credits{hasBonus && <span className="extra-badge">+{bonusPercent}% Extra</span>}</span>
                  <span className="benefit-sub">Added to your wallet</span>
                </div>
                <div className="benefit-value">{formatPrice(creditAmount)}</div>
              </div>
            </div>
            <div className="summary-actions">
              <button className="btn-cancel" onClick={() => setConfirmingPackage(null)} disabled={!!isPurchasing}>Cancel</button>
              <button className="btn-confirm" onClick={() => executeRecharge(confirmingPackage, totalPayable, creditAmount)} disabled={!!isPurchasing}>
                {isPurchasing ? 'Processing...' : `Pay ${formatDecimalPrice(totalPayable)}`}
              </button>
            </div>
          </div>
        </div>
      );
    };

    // Effective per-unit cost given plan discount ratio
    const effectiveRates = (planCost: number, creditAmount: number) => {
      const stdChat = prices['chat_message'] || 0;
      const stdCall = prices['voice_call_minute'] || 0;
      if (creditAmount <= 0 || planCost <= 0) return { chat: stdChat, call: stdCall };
      const ratio = planCost / creditAmount;
      return { chat: stdChat * ratio, call: stdCall * ratio };
    };

    if (isLoading) return <div className="pricing-section aura-section"><div className="pv2">Loading plans…</div></div>;
    if (error && showSubscriptions) return <div className="pricing-section aura-section"><div className="pv2">Error: {error}</div></div>;

    const monthlyPlan = plans.find(p => p.interval === 'month');
    const yearlyPlan = plans.find(p => p.interval === 'year');
    const welcomeBonus = prices['welcome_bonus'] || 0;

    const subscribeDisabled = currentUserPlanId === 'monthly' || currentUserPlanId === 'yearly';

    const renderFreePlan = () => {
      const msgCost = prices['chat_message'] || 1;
      const freeChats = Math.floor(welcomeBonus / msgCost);

      return (
        <div className="cel-plan-option cel-plan-option--free">
          <div className="cel-plan-copy">
            <span className="cel-plan-label">Begin</span>
            <h3>Free</h3>
            <p>{formatPrice(welcomeBonus)} welcome credit{freeChats > 0 ? ` · ${freeChats} chats` : ''} · 1 profile</p>
          </div>
          <div className="cel-plan-action">
            <strong>{formatPrice(0)}</strong>
            <span className="cel-current-plan">{currentUserPlanId ? 'Included' : 'Current plan'}</span>
          </div>
        </div>
      );
    };

    const renderPaidPlan = (plan: PlanWithPrice, interval: 'monthly' | 'yearly') => {
      const credit = plan.price.wallet_credit_amount || 0;
      const cost = plan.price.amount || 0;
      const eff = effectiveRates(cost, credit);
      const isYearly = interval === 'yearly';
      const isCurrent = currentUserPlanId === interval;
      const processing = isSubscribing && activePlanId === Number(plan.price.id);

      return (
        <div className={`cel-plan-option cel-plan-option--${interval}`}>
          <div className="cel-plan-copy">
            <div className="cel-plan-label-row">
              <span className="cel-plan-label">{isYearly ? 'Celestial' : 'Ascendant'}</span>
              <span className="cel-plan-note">{isYearly ? 'Best annual value' : 'Most chosen'}</span>
            </div>
            <h3>{plan.name}</h3>
            <p>
              {formatPrice(credit)} wallet credit · {isYearly ? '10' : '4'} profiles · Premium reports
            </p>
            <small>Effective chat {formatPrice(eff.chat)} · call {formatPrice(eff.call)}/min</small>
          </div>
          <div className="cel-plan-action">
            {isYearly && plan.price.originalAmount && <del>{formatPrice(plan.price.originalAmount)}</del>}
            <div className="cel-plan-price"><strong>{formatPrice(cost)}</strong><span>/{isYearly ? 'yr' : 'mo'}</span></div>
            <button
              type="button"
              disabled={processing || subscribeDisabled}
              onClick={() => {
                trackEvent('Subscription Clicked', { plan: plan.name, priceId: plan.price.id, interval, cost: plan.price.amount, variant });
                onSubscribe(plan.price.id);
              }}
            >
              {processing ? 'Processing…' : isCurrent ? 'Current plan' : 'Choose plan'}
              {!processing && !isCurrent && <Sym name="arrow_forward" />}
            </button>
          </div>
        </div>
      );
    };

    return (
      <section className="pricing-section aura-section cel-pricing" id="pricing" ref={ref}>
        <div className="cel-shell">
          <header className="cel-header">
            <div className="cel-kicker"><span>✦</span> Vidhi Pricing <span>✦</span></div>
            <h2>Guidance for every <em>spiritual journey</em></h2>
            <p>Recharge for answers when you need them, or choose a membership for continuous celestial guidance.</p>
          </header>

          {!isPricingLoading && (prices['voice_call_minute'] || prices['chat_message'] || prices['report_premium']) && (
            <div className="cel-rates" aria-label="Base usage rates">
              <span><Sym name="chat_bubble" /><small>Chat</small><b>{formatPrice(prices['chat_message'])}/question</b></span>
              <span><Sym name="call" /><small>Voice</small><b>{formatPrice(prices['voice_call_minute'])}/minute</b></span>
              <span><Sym name="description" /><small>Report</small><b>{formatPrice(prices['report_premium'])}</b></span>
            </div>
          )}

          <div className={`cel-board${!showSubscriptions ? ' cel-board--recharge-only' : ''}`}>
            <div className="cel-recharge-panel">
              <div className="cel-panel-head">
                <div>
                  <span className="cel-step">01</span>
                  <h3>Quick wallet recharge</h3>
                  <p>Choose an amount and receive bonus credits instantly.</p>
                </div>
                {walletBalance != null && (
                  <div className="cel-balance">
                    <Sym name="account_balance_wallet" />
                    <span>Balance</span>
                    <strong>{formatPrice(walletBalance)}</strong>
                  </div>
                )}
              </div>

              {!isPricingLoading && packages.length > 0 && (
                <div className="cel-recharge-grid">
                  {packages.map((pkg: any) => {
                    const hasBonus = pkg.amount > pkg.price;
                    const bonusPercent = pkg.price > 0 ? Math.round(((pkg.amount - pkg.price) / pkg.price) * 100) : 0;
                    const purchasing = isPurchasing === String(pkg.id);

                    return (
                      <button
                        type="button"
                        key={pkg.id}
                        className={`cel-recharge-option${purchasing ? ' cel-recharge-option--loading' : ''}`}
                        disabled={!!isPurchasing}
                        onClick={() => handleQuickRecharge(pkg)}
                        aria-label={`Pay ${formatPrice(pkg.price)} and receive ${formatPrice(pkg.amount)} in wallet credits`}
                      >
                        <span className="cel-recharge-main">
                          <small>Pay</small>
                          <strong>{formatPrice(pkg.price)}</strong>
                        </span>
                        <span className="cel-recharge-return">
                          {purchasing ? 'Opening payment…' : `${hasBonus ? 'Receive' : 'Add'} ${formatPrice(pkg.amount)}`}
                        </span>
                        {hasBonus && <span className="cel-bonus">+{bonusPercent}%</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {showSubscriptions && (
              <div className="cel-membership-panel">
                <div className="cel-panel-head">
                  <div>
                    <span className="cel-step">02</span>
                    <h3>Membership paths</h3>
                    <p>Save more with ongoing access.</p>
                  </div>
                </div>
                <div className="cel-plan-list">
                  {renderFreePlan()}
                  {monthlyPlan && renderPaidPlan(monthlyPlan, 'monthly')}
                  {yearlyPlan && renderPaidPlan(yearlyPlan, 'yearly')}
                </div>
              </div>
            )}
          </div>

          <footer className="cel-trust" aria-label="Payment assurances">
            <span><Sym name="verified_user" /> Secure payments</span>
            <i aria-hidden="true" />
            <span><Sym name="lock" /> Privacy encrypted</span>
            <i aria-hidden="true" />
            <span><Sym name="support_agent" /> Human assistance</span>
          </footer>

          {renderPaymentSummary()}
        </div>
      </section>
    );
  }
);

export default SubscriptionSection;

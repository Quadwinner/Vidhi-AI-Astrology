import {
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconCrown,
  IconMessage,
  IconPhone,
  IconSparkles,
  IconUser,
  IconWallet,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import '../styles/aura-home.css';
import styles from './SubscriptionManagementPage.module.css';

type PlanCounters = {
  questions_used: number;
  talk_minutes_used: number;
  cycle_start: string;
  cycle_end: string;
  questions_per_month: number;
  ai_call_talk_minutes: number;
};

const PLAN_META = {
  free: {
    label: 'Seeker',
    codename: 'Free tier',
    questionsLimit: 0,
    minutesLimit: 0,
    benefits: ['Pay-as-you-go via wallet', '1 birth profile', 'Chat, calls & reports'],
  },
  monthly: {
    label: 'Ascendant',
    codename: 'Monthly membership',
    questionsLimit: 100,
    minutesLimit: 60,
    benefits: ['100 questions / month', '60 AI call minutes', 'Up to 4 profiles', 'Member wallet rates'],
  },
  yearly: {
    label: 'Celestial',
    codename: 'Yearly membership',
    questionsLimit: 100,
    minutesLimit: 60,
    benefits: ['100 questions / month', '60 AI call minutes', 'Up to 10 profiles', 'Best annual value'],
  },
} as const;

function formatDate(dateString: string | null) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function usagePercent(used: number, limit: number) {
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export default function SubscriptionManagementPage() {
  const navigate = useNavigate();
  const {
    user,
    planTier,
    subscriptionStatus,
    currentPeriodEnd,
    walletBalance,
    refreshUserStatus,
    checkingStatus,
  } = useAuth() as any;
  const { formatPrice } = usePricing() as any;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [counters, setCounters] = useState<PlanCounters | null>(null);

  const tier = (planTier || 'free') as keyof typeof PLAN_META;
  const meta = PLAN_META[tier] || PLAN_META.free;
  const isPremium = tier === 'monthly' || tier === 'yearly';
  const isActive = subscriptionStatus === 'active';
  const isCancelled = subscriptionStatus === 'cancelled' || subscriptionStatus === 'canceled';

  const fetchCounters = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase.rpc('get_current_cycle_counters', { p_user_id: user.id });
    if (error || !data?.[0]) return;
    const row = data[0];
    setCounters({
      questions_used: row.questions_used ?? 0,
      talk_minutes_used: row.talk_minutes_used ?? 0,
      cycle_start: row.cycle_start,
      cycle_end: row.cycle_end,
      questions_per_month: row.questions_per_month ?? 0,
      ai_call_talk_minutes: row.ai_call_talk_minutes ?? 0,
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    trackEvent('Membership Page Viewed', {
      plan_tier: tier,
      subscription_status: subscriptionStatus,
    });

    fetchCounters();

    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchCounters();
    };

    window.addEventListener('focus', fetchCounters);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', fetchCounters);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.id, tier, subscriptionStatus, fetchCounters]);

  const questionsLimit = counters?.questions_per_month || meta.questionsLimit;
  const minutesLimit = counters?.ai_call_talk_minutes || meta.minutesLimit;

  const statusLabel = useMemo(() => {
    if (isCancelled && isPremium) return 'Cancels soon';
    if (isActive) return 'Active';
    if (isPremium) return subscriptionStatus || 'Inactive';
    return 'Free';
  }, [isActive, isCancelled, isPremium, subscriptionStatus]);

  const statusClass = isActive
    ? styles.statusActive
    : isCancelled
      ? styles.statusCancelled
      : styles.statusInactive;

  const handleCancelSubscription = async () => {
    if (!window.confirm('Cancel your membership? You will keep access until the end of your current billing period.')) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    trackEvent('Subscription Cancellation Initiated', { plan_tier: tier });

    try {
      const { data, error: fnError } = await supabase.functions.invoke('cancel-subscription');
      if (fnError) throw new Error(fnError.message || 'Cancellation failed');
      if ((data as any)?.error) throw new Error((data as any).error);

      setSuccess('Membership cancellation scheduled. Access continues until your billing period ends.');
      trackEvent('Subscription Cancellation Success', { plan_tier: tier });
      await refreshUserStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel membership');
      trackEvent('Subscription Cancellation Failed', {
        plan_tier: tier,
        error: err?.message || 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!checkingStatus && !user) {
    return (
      <main className={`aura-home ${styles.page}`}>
        <div className="aura-stars-layer" aria-hidden="true" />
        <div className={styles.shell}>
          <div className={styles.emptyState}>
            <h2>Sign in required</h2>
            <p>Please sign in to manage your Vidhi membership.</p>
            <button type="button" className={`${styles.actionBtn} ${styles.actionPrimary}`} onClick={() => navigate('/')}>
              Go to home
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`aura-home ${styles.page}`}>
      <div className="aura-stars-layer" aria-hidden="true" />
      <div className={styles.shell}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <IconArrowLeft size={18} />
          <span>Back</span>
        </button>

        <header className="aura-section-head" style={{ textAlign: 'left', margin: '0 0 28px', maxWidth: 'none' }}>
          <div className="aura-eyebrow">
            <IconSparkles size={14} />
            Membership
          </div>
          <h1 className="aura-h2" style={{ textAlign: 'left' }}>
            Manage your <span className="aura-gold-text aura-italic">cosmic access</span>
          </h1>
          <p className="aura-lead" style={{ textAlign: 'left', maxWidth: 560 }}>
            Your wallet powers every reading. Track usage, renew your path, or adjust your membership.
          </p>
        </header>

        <section className={styles.board}>
          <div className={styles.planPanel}>
            <span className={styles.step}>01 — Plan</span>
            <h2 className={styles.panelTitle}>Your membership</h2>
            <p className={styles.panelSub}>Everything included in your current Vidhi tier.</p>

            <div className={styles.planRow}>
              <div>
                <h3 className={styles.planName}>{meta.label}</h3>
                <p className={styles.planType}>{meta.codename}</p>
              </div>
              <span className={`${styles.statusPill} ${statusClass}`}>
                <span className={styles.statusDot} aria-hidden="true" />
                {statusLabel}
              </span>
            </div>

            <div className={styles.walletHero}>
              <div>
                <span className={styles.walletLabel}>Wallet balance</span>
                <p className={styles.walletAmount}>
                  {walletBalance != null ? formatPrice(walletBalance) : '—'}
                </p>
              </div>
              <button type="button" className={styles.walletBtn} onClick={() => navigate('/wallet')}>
                Add funds
              </button>
            </div>

            <div className={styles.metaRow}>
              <div className={styles.metaItem}>
                <span>Renews / ends</span>
                <strong>{formatDate(currentPeriodEnd)}</strong>
              </div>
              <div className={styles.metaItem}>
                <span>Account</span>
                <strong>{user?.email || '—'}</strong>
              </div>
            </div>

            <ul className={styles.benefits}>
              {meta.benefits.map((benefit) => (
                <li key={benefit}>
                  <IconCheck size={16} className={styles.benefitIcon} />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.usagePanel}>
            <span className={styles.step}>02 — Usage</span>
            <h2 className={styles.panelTitle}>This cycle</h2>
            <p className={styles.panelSub}>
              {tier === 'yearly'
                ? 'Allowances for your current annual billing cycle.'
                : 'Monthly allowances reset at the end of each billing cycle.'}
            </p>

            {isPremium ? (
              <>
                <div className={styles.usageBar}>
                  <div className={styles.usageLabel}>
                    <span><IconMessage size={15} style={{ verticalAlign: -3, marginRight: 6 }} />Questions</span>
                    <span>{counters?.questions_used ?? 0} / {questionsLimit}</span>
                  </div>
                  <div className={styles.usageTrack}>
                    <div
                      className={styles.usageFill}
                      style={{ width: `${usagePercent(counters?.questions_used ?? 0, questionsLimit)}%` }}
                    />
                  </div>
                </div>

                <div className={styles.usageBar}>
                  <div className={styles.usageLabel}>
                    <span><IconPhone size={15} style={{ verticalAlign: -3, marginRight: 6 }} />Call minutes</span>
                    <span>{counters?.talk_minutes_used ?? 0} / {minutesLimit}</span>
                  </div>
                  <div className={styles.usageTrack}>
                    <div
                      className={styles.usageFill}
                      style={{ width: `${usagePercent(counters?.talk_minutes_used ?? 0, minutesLimit)}%` }}
                    />
                  </div>
                </div>

                {counters?.cycle_end && (
                  <p className={styles.cycleNote}>
                    <IconCalendar size={14} />
                    Cycle ends {formatDate(counters.cycle_end)}
                  </p>
                )}
              </>
            ) : (
              <p style={{ margin: 0, color: '#b7a9ab', fontSize: 14, lineHeight: 1.6 }}>
                Upgrade to Ascendant or Celestial to unlock monthly question and call allowances. Until then, pay per use from your wallet.
              </p>
            )}
          </div>
        </section>

        <section className={styles.actionsCard}>
          <span className={styles.step}>03 — Controls</span>
          <h2 className={styles.panelTitle}>Membership actions</h2>
          <p className={styles.panelSub}>Upgrade, recharge, or manage your account settings.</p>

          <div className={styles.actionsGrid}>
            {!isPremium && (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionPrimary}`}
                onClick={() => navigate('/quick-recharge')}
              >
                <IconCrown size={18} />
                Upgrade membership
              </button>
            )}

            {isPremium && (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionSecondary}`}
                onClick={() => navigate('/quick-recharge')}
              >
                <IconSparkles size={18} />
                Change plan
              </button>
            )}

            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionSecondary}`}
              onClick={() => navigate('/wallet')}
            >
              <IconWallet size={18} />
              Manage wallet
            </button>

            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionSecondary}`}
              onClick={() => navigate('/profiles')}
            >
              <IconUser size={18} />
              View profiles
            </button>

            {isPremium && isActive && !isCancelled && (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionDanger}`}
                onClick={handleCancelSubscription}
                disabled={isLoading}
              >
                {isLoading ? 'Cancelling…' : 'Cancel membership'}
              </button>
            )}
          </div>

          {error && <div className={styles.alert}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}
        </section>
      </div>
    </main>
  );
}

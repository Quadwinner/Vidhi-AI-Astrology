import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconHash } from '@tabler/icons-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext';
import { useBirthDetails } from '../utils/useBirthDetails';
import { trackEvent } from '../utils/analytics';
import styles from './ToolPage.module.css';

export default function NumerologyPage() {
  const { subscriptionStatus, updateWalletBalance } = useAuth() as any;
  const { prices, formatPrice } = usePricing() as any;
  const { details } = useBirthDetails();
  const price = prices['numerology'];
  const isPremium = subscriptionStatus === 'active';

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (details) { setName((n) => n || details.name); setDate((d) => d || details.dob); }
  }, [details]);

  const submit = async () => {
    setLoading(true); setError(null); setInsufficient(false); setResult(null);
    try {
      trackEvent('Numerology Report', {});
      const { data, error } = await supabase.functions.invoke('get-numerology', { body: { name, date } });
      const status = (error as any)?.context?.status;
      if (status === 402 || data?.error === 'insufficient_funds') { setInsufficient(true); return; }
      if (error) throw new Error(error.message);
      if (data?.error === 'validation') { setError(data.message || 'Please enter your name and date of birth.'); return; }
      if (data?.error) { setError('Numerology is unavailable right now. Please try again shortly.'); return; }
      setResult(data.response);
      if (typeof data.meta?.wallet_balance === 'number') updateWalletBalance(data.meta.wallet_balance);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const entries = result ? Object.values(result).filter((v: any) => v && typeof v === 'object' && (v.title || v.number !== undefined)) as any[] : [];

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.kicker}><IconHash size={14} /> Numerology</div>
          <h1 className={styles.title}>Your Numerology Report</h1>
          <p className={styles.subtitle}>Discover your core numbers, ruling planet, and life themes from your name and date of birth.</p>
          <div className={styles.priceBanner}>
            {isPremium ? <span><b>Premium</b> · included in your free allowance</span> : <span>Each report costs <b>{price != null ? formatPrice(price) : '…'}</b></span>}
          </div>
        </header>

        <div className={styles.card}>
          <div className={styles.formGrid}>
            <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label} htmlFor="num-name">Full Name</label>
              <input id="num-name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label} htmlFor="num-date">Date of Birth (DD/MM/YYYY)</label>
              <input id="num-date" className={styles.input} value={date} onChange={(e) => setDate(e.target.value)} placeholder="15/08/1990" />
            </div>
          </div>
        </div>

        <button className={styles.submitBtn} onClick={submit} disabled={loading}>
          {loading ? 'Calculating…' : 'Get Numerology Report'}
        </button>

        {insufficient && (
          <div className={styles.errorCard}>
            You don&rsquo;t have enough balance. <Link to="/wallet" className={styles.rechargeLink}>Recharge your wallet</Link> to continue.
          </div>
        )}
        {error && !insufficient && <div className={styles.errorCard}>{error}</div>}

        {result && !error && (
          <div className={styles.result} style={{ marginTop: 20 }}>
            <div className={styles.grid2}>
              {entries.map((e, i) => (
                <div key={i} className={styles.kv}>
                  <div className={styles.kvLabel}>{e.title || 'Number'} {e.number !== undefined ? `· ${e.number}` : ''}</div>
                  {e.meaning && <div className={styles.kvValue}>{e.meaning}</div>}
                  {e.description && <div className={styles.kvSub}>{e.description}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

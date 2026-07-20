import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconShieldHalf } from '@tabler/icons-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext';
import { useBirthDetails } from '../utils/useBirthDetails';
import BirthDetailsFields, { BirthInput } from '../components/BirthDetailsFields';
import { trackEvent } from '../utils/analytics';
import styles from './ToolPage.module.css';

const EMPTY: BirthInput = { dob: '', tob: '', lat: '', lon: '', tz: '5.5' };
const LABELS: Record<string, string> = { mangal: 'Manglik (Mangal) Dosha', kaalsarp: 'Kaal Sarp Dosha', pitra: 'Pitra Dosha', sade_sati: 'Sade Sati' };

function present(key: string, d: any): boolean {
  if (!d || d.error) return false;
  if (key === 'sade_sati') return !!d.shani_period_type;
  return !!d.is_dosha_present || !!d.manglik_by_mars;
}

export default function DoshaPage() {
  const { subscriptionStatus, updateWalletBalance } = useAuth() as any;
  const { prices, formatPrice } = usePricing() as any;
  const { details } = useBirthDetails();
  const price = prices['dosha_report'];
  const isPremium = subscriptionStatus === 'active';

  const [birth, setBirth] = useState<BirthInput>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (details) setBirth((b) => (b.dob ? b : { dob: details.dob, tob: details.tob, lat: details.lat, lon: details.lon, tz: details.tz }));
  }, [details]);

  const submit = async () => {
    setLoading(true); setError(null); setInsufficient(false); setResult(null);
    try {
      trackEvent('Dosha Report', {});
      const { data, error } = await supabase.functions.invoke('get-dosha-report', { body: { birth } });
      const status = (error as any)?.context?.status;
      if (status === 402 || data?.error === 'insufficient_funds') { setInsufficient(true); return; }
      if (error) throw new Error(error.message);
      if (data?.error === 'validation') { setError(data.message || 'Please fill all birth details.'); return; }
      if (data?.error) { setError('Dosha analysis is unavailable right now. Please try again shortly.'); return; }
      setResult(data.response);
      if (typeof data.meta?.wallet_balance === 'number') updateWalletBalance(data.meta.wallet_balance);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.kicker}><IconShieldHalf size={14} /> Dosha Analysis</div>
          <h1 className={styles.title}>Dosha & Remedies</h1>
          <p className={styles.subtitle}>Check for Manglik, Kaal Sarp, Pitra Dosha and Sade Sati in your chart, with effects and remedies.</p>
          <div className={styles.priceBanner}>
            {isPremium ? <span><b>Premium</b> · included in your free allowance</span> : <span>Each report costs <b>{price != null ? formatPrice(price) : '…'}</b></span>}
          </div>
        </header>

        <div className={styles.card}>
          <div className={styles.sectionLabel}>Your Birth Details</div>
          <BirthDetailsFields value={birth} onChange={setBirth} />
        </div>

        <button className={styles.submitBtn} onClick={submit} disabled={loading}>
          {loading ? 'Analysing chart…' : 'Check Doshas'}
        </button>

        {insufficient && (
          <div className={styles.errorCard}>
            You don&rsquo;t have enough balance. <Link to="/wallet" className={styles.rechargeLink}>Recharge your wallet</Link> to continue.
          </div>
        )}
        {error && !insufficient && <div className={styles.errorCard}>{error}</div>}

        {result && !error && (
          <div className={styles.result} style={{ marginTop: 20 }}>
            {Object.keys(LABELS).map((key) => {
              const d = result[key];
              if (!d) return null;
              const isPresent = present(key, d);
              const remedies: string[] = Array.isArray(d.remedies) ? d.remedies : [];
              const reasons: string[] = d.cancellation?.cancellationReason || [];
              return (
                <div key={key} className={styles.doshaCard}>
                  <div className={styles.doshaHead}>
                    <span className={styles.doshaName}>{LABELS[key]}</span>
                    {d.error ? <span className={`${styles.badge} ${styles.badgeNo}`}>Unavailable</span>
                      : <span className={`${styles.badge} ${isPresent ? styles.badgeYes : styles.badgeNo}`}>{isPresent ? 'Present' : 'Not Present'}</span>}
                  </div>
                  {d.bot_response && <p className={styles.doshaText}>{d.bot_response}</p>}
                  {d.description && !d.bot_response && <p className={styles.doshaText}>{d.description}</p>}
                  {typeof d.score === 'number' && <p className={styles.doshaText}><b style={{ color: '#e5b45b' }}>Score:</b> {d.score}%</p>}
                  {reasons.length > 0 && (
                    <>
                      <p className={styles.doshaText} style={{ marginBottom: 2 }}><b style={{ color: '#e5b45b' }}>Cancellation:</b></p>
                      <ul className={styles.remedyList}>{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                    </>
                  )}
                  {remedies.length > 0 && (
                    <>
                      <p className={styles.doshaText} style={{ marginBottom: 2 }}><b style={{ color: '#e5b45b' }}>Remedies:</b></p>
                      <ul className={styles.remedyList}>{remedies.map((r, i) => <li key={i}>{r}</li>)}</ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

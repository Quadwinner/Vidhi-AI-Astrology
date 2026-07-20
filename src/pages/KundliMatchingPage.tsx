import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconHeart } from '@tabler/icons-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext';
import { useBirthDetails } from '../utils/useBirthDetails';
import BirthDetailsFields, { BirthInput } from '../components/BirthDetailsFields';
import { trackEvent } from '../utils/analytics';
import styles from './ToolPage.module.css';

const EMPTY: BirthInput = { dob: '', tob: '', lat: '', lon: '', tz: '5.5', name: '' };

export default function KundliMatchingPage() {
  const { subscriptionStatus, updateWalletBalance } = useAuth() as any;
  const { prices, formatPrice } = usePricing() as any;
  const { details } = useBirthDetails();
  const price = prices['kundli_matching'];
  const isPremium = subscriptionStatus === 'active';

  const [boy, setBoy] = useState<BirthInput>(EMPTY);
  const [girl, setGirl] = useState<BirthInput>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (details) setBoy((b) => (b.dob ? b : { dob: details.dob, tob: details.tob, lat: details.lat, lon: details.lon, tz: details.tz, name: details.name }));
  }, [details]);

  const submit = async () => {
    setLoading(true); setError(null); setInsufficient(false); setResult(null);
    try {
      trackEvent('Kundli Matching', {});
      const { data, error } = await supabase.functions.invoke('get-kundli-matching', { body: { boy, girl } });
      const status = (error as any)?.context?.status;
      if (status === 402 || data?.error === 'insufficient_funds') { setInsufficient(true); return; }
      if (error) throw new Error(error.message);
      if (data?.error === 'validation') { setError(data.message || 'Please fill all fields for both people.'); return; }
      if (data?.error) { setError('Matching is unavailable right now. Please try again shortly.'); return; }
      setResult(data.response);
      if (typeof data.meta?.wallet_balance === 'number') updateWalletBalance(data.meta.wallet_balance);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const kootas = result ? Object.values(result).filter((v: any) => v && typeof v === 'object' && v.name && v.full_score !== undefined) as any[] : [];
  const total = result?.total?.received_points ?? result?.total?.total_score ?? result?.total ?? kootas.reduce((s, k) => s + (Number(k.received || k[k.name?.toLowerCase()] || 0) || 0), 0);
  const conclusion = result?.conclusion?.report || result?.bot_response || (typeof result?.conclusion === 'string' ? result.conclusion : '');

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.kicker}><IconHeart size={14} /> Kundli Matching</div>
          <h1 className={styles.title}>Guna Milan Compatibility</h1>
          <p className={styles.subtitle}>Match two birth charts on the traditional Ashtakoot 36-point system for marriage compatibility.</p>
          <div className={styles.priceBanner}>
            {isPremium ? <span><b>Premium</b> · included in your free allowance</span> : <span>Each match costs <b>{price != null ? formatPrice(price) : '…'}</b></span>}
          </div>
        </header>

        <div className={styles.card}>
          <div className={styles.sectionLabel}>Person 1 (You)</div>
          <BirthDetailsFields value={boy} onChange={setBoy} showName idPrefix="boy-" />
        </div>
        <div className={styles.card}>
          <div className={styles.sectionLabel}>Person 2 (Partner)</div>
          <BirthDetailsFields value={girl} onChange={setGirl} showName idPrefix="girl-" />
        </div>

        <button className={styles.submitBtn} onClick={submit} disabled={loading}>
          {loading ? 'Matching charts…' : 'Match Kundli'}
        </button>

        {insufficient && (
          <div className={styles.errorCard}>
            You don&rsquo;t have enough balance. <Link to="/wallet" className={styles.rechargeLink}>Recharge your wallet</Link> to continue.
          </div>
        )}
        {error && !insufficient && <div className={styles.errorCard}>{error}</div>}

        {result && !error && (
          <div className={styles.result} style={{ marginTop: 20 }}>
            <div className={styles.scoreHero}>
              <div><span className={styles.scoreBig}>{Number(total).toFixed(total % 1 ? 1 : 0)}</span><span className={styles.scoreOf}> / 36</span></div>
              <div className={styles.scoreLabel}>Total Guna Milan Score</div>
            </div>
            {conclusion && <div className={styles.card}><p className={styles.doshaText} style={{ margin: 0 }}>{conclusion}</p></div>}
            <div className={styles.grid2}>
              {kootas.map((k, i) => {
                const obtained = k[k.name?.toLowerCase()] ?? k.received ?? k.obtained;
                return (
                  <div key={i} className={styles.kv}>
                    <div className={styles.kvLabel}>{k.name}</div>
                    <div className={styles.kvValue}>{obtained != null ? `${obtained} / ${k.full_score}` : `— / ${k.full_score}`}</div>
                    {k.description && <div className={styles.kvSub}>{k.description}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

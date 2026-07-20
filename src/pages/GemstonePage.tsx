import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconDiamond } from '@tabler/icons-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext';
import { useBirthDetails } from '../utils/useBirthDetails';
import BirthDetailsFields, { BirthInput } from '../components/BirthDetailsFields';
import { trackEvent } from '../utils/analytics';
import styles from './ToolPage.module.css';

const EMPTY: BirthInput = { dob: '', tob: '', lat: '', lon: '', tz: '5.5' };

export default function GemstonePage() {
  const { subscriptionStatus, updateWalletBalance } = useAuth() as any;
  const { prices, formatPrice } = usePricing() as any;
  const { details } = useBirthDetails();
  const price = prices['gemstone'];
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
      trackEvent('Gemstone Report', {});
      const { data, error } = await supabase.functions.invoke('get-gemstone', { body: { birth } });
      const status = (error as any)?.context?.status;
      if (status === 402 || data?.error === 'insufficient_funds') { setInsufficient(true); return; }
      if (error) throw new Error(error.message);
      if (data?.error === 'validation') { setError(data.message || 'Please fill all birth details.'); return; }
      if (data?.error) { setError('Recommendations are unavailable right now. Please try again shortly.'); return; }
      setResult(data.response);
      if (typeof data.meta?.wallet_balance === 'number') updateWalletBalance(data.meta.wallet_balance);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const gem = result?.gem;
  const rud = result?.rudraksha;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.kicker}><IconDiamond size={14} /> Gemstone & Rudraksha</div>
          <h1 className={styles.title}>Your Remedial Stones</h1>
          <p className={styles.subtitle}>Personalized gemstone and Rudraksha recommendations based on your birth chart.</p>
          <div className={styles.priceBanner}>
            {isPremium ? <span><b>Premium</b> · included in your free allowance</span> : <span>Each report costs <b>{price != null ? formatPrice(price) : '…'}</b></span>}
          </div>
        </header>

        <div className={styles.card}>
          <div className={styles.sectionLabel}>Your Birth Details</div>
          <BirthDetailsFields value={birth} onChange={setBirth} />
        </div>

        <button className={styles.submitBtn} onClick={submit} disabled={loading}>
          {loading ? 'Finding your stones…' : 'Get Recommendations'}
        </button>

        {insufficient && (
          <div className={styles.errorCard}>
            You don&rsquo;t have enough balance. <Link to="/wallet" className={styles.rechargeLink}>Recharge your wallet</Link> to continue.
          </div>
        )}
        {error && !insufficient && <div className={styles.errorCard}>{error}</div>}

        {result && !error && (
          <div className={styles.result} style={{ marginTop: 20 }}>
            {gem && (
              <div className={styles.card}>
                <div className={styles.sectionLabel}>Recommended Gemstone</div>
                <div className={styles.grid2}>
                  <div className={styles.kv}><div className={styles.kvLabel}>Gemstone</div><div className={styles.kvValue}>{gem.name}{gem.other_name ? ` (${gem.other_name})` : ''}</div></div>
                  {gem.planet && <div className={styles.kv}><div className={styles.kvLabel}>Ruling Planet</div><div className={styles.kvValue}>{gem.planet}</div></div>}
                </div>
                {gem.description && <p className={styles.doshaText} style={{ marginTop: 12 }}>{gem.description}</p>}
              </div>
            )}
            {rud && (
              <div className={styles.card}>
                <div className={styles.sectionLabel}>Recommended Rudraksha</div>
                <div className={styles.grid2}>
                  {rud.name && <div className={styles.kv}><div className={styles.kvLabel}>Rudraksha</div><div className={styles.kvValue}>{rud.name}</div></div>}
                  {Array.isArray(rud.mukhi_for_money) && <div className={styles.kv}><div className={styles.kvLabel}>For Wealth</div><div className={styles.kvValue}>{rud.mukhi_for_money.join(', ')} Mukhi</div></div>}
                  {Array.isArray(rud.mukhi_for_disease_cure) && <div className={styles.kv}><div className={styles.kvLabel}>For Health</div><div className={styles.kvValue}>{rud.mukhi_for_disease_cure.join(', ')} Mukhi</div></div>}
                </div>
                {rud.bot_response && <p className={styles.doshaText} style={{ marginTop: 12 }}>{rud.bot_response}</p>}
                {rud.mukhi_description && <p className={styles.kvSub} style={{ marginTop: 8 }}>{rud.mukhi_description}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

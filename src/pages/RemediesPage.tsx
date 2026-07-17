import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconSparkles, IconBriefcase, IconHeart, IconActivity, IconCoin,
  IconSchool, IconGavel, IconStars, IconSend, IconWallet, IconChevronDown,
} from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import styles from './RemediesPage.module.css';

interface ProfileLite { id: string; name: string; }

const PROBLEM_AREAS = [
  { key: 'Career & Job', icon: <IconBriefcase size={18} /> },
  { key: 'Marriage & Love', icon: <IconHeart size={18} /> },
  { key: 'Health', icon: <IconActivity size={18} /> },
  { key: 'Money & Wealth', icon: <IconCoin size={18} /> },
  { key: 'Education', icon: <IconSchool size={18} /> },
  { key: 'Legal & Disputes', icon: <IconGavel size={18} /> },
  { key: 'Overall Life', icon: <IconStars size={18} /> },
];

export default function RemediesPage() {
  const navigate = useNavigate();
  const { userProfiles, walletBalance } = useAuth() as any;
  const { formatPrice } = usePricing() as any;

  const profiles: ProfileLite[] = useMemo(() => (Array.isArray(userProfiles) ? userProfiles : []), [userProfiles]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [area, setArea] = useState<string>('Overall Life');
  const [customText, setCustomText] = useState('');
  const [result, setResult] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedProfileId && profiles.length) setSelectedProfileId(profiles[0].id);
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    if (resultRef.current) resultRef.current.scrollTop = resultRef.current.scrollHeight;
  }, [result]);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  const handleGetRemedies = async () => {
    if (!selectedProfileId || isStreaming) return;
    setError(null);
    setResult('');
    setIsStreaming(true);
    trackEvent('Remedy Requested', { profile_id: selectedProfileId, area, has_custom: !!customText.trim() });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again.');

      const response = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/get-remedies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          profile_id: selectedProfileId,
          problem_area: area,
          problem_text: customText.trim(),
          client_date: new Date().toLocaleDateString('en-CA'),
        }),
      });

      if (!response.ok || !response.body) {
        const txt = await response.text();
        throw new Error(txt || `Server error: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setResult(full);
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.kicker}><IconSparkles size={14} /> Vedic Remedies</div>
          <h1 className={styles.title}>Upaay — remedies for your concerns</h1>
          <p className={styles.subtitle}>
            Pick who it's for and what's troubling you. Vidhi reads the actual birth chart and suggests
            personalized, practical remedies — gemstone, mantra, rituals and simple daily practices.
          </p>
        </header>

        {profiles.length === 0 ? (
          <div className={styles.emptyCard}>
            <p>You need a profile with a generated birth chart first.</p>
            <button className={styles.primaryBtn} onClick={() => navigate('/profiles/new')}>Create a profile</button>
          </div>
        ) : (
          <>
            <div className={styles.controls}>
              {/* Profile selector */}
              <div className={styles.profileSelect}>
                <button className={styles.profileToggle} onClick={() => setProfileOpen(o => !o)}>
                  <span className={styles.profileLabel}>Profile</span>
                  <span className={styles.profileName}>{selectedProfile?.name || 'Select'}</span>
                  <IconChevronDown size={16} className={`${styles.chev} ${profileOpen ? styles.chevOpen : ''}`} />
                </button>
                {profileOpen && (
                  <div className={styles.profileMenu}>
                    {profiles.map(p => (
                      <button
                        key={p.id}
                        className={`${styles.profileItem} ${p.id === selectedProfileId ? styles.profileItemActive : ''}`}
                        onClick={() => { setSelectedProfileId(p.id); setProfileOpen(false); }}
                      >{p.name}</button>
                    ))}
                  </div>
                )}
              </div>

              <button type="button" className={styles.walletPill} onClick={() => navigate('/wallet')}>
                <IconWallet size={15} />
                <span>{walletBalance != null ? formatPrice(walletBalance) : '—'}</span>
              </button>
            </div>

            {/* Problem areas */}
            <div className={styles.areaGrid}>
              {PROBLEM_AREAS.map(a => (
                <button
                  key={a.key}
                  className={`${styles.areaChip} ${area === a.key ? styles.areaActive : ''}`}
                  onClick={() => setArea(a.key)}
                >
                  {a.icon}<span>{a.key}</span>
                </button>
              ))}
            </div>

            {/* Custom problem */}
            <div className={styles.inputRow}>
              <input
                className={styles.textInput}
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleGetRemedies(); }}
                placeholder={`Describe your concern (optional) — e.g. "delay in marriage", "job not stable"`}
              />
              <button className={styles.primaryBtn} onClick={handleGetRemedies} disabled={isStreaming || !selectedProfileId}>
                <IconSend size={16} />
                {isStreaming ? 'Reading chart…' : 'Get Remedies'}
              </button>
            </div>

            {/* Result */}
            {(result || isStreaming || error) && (
              <div className={styles.resultCard} ref={resultRef}>
                {error ? (
                  <p className={styles.errorText}>{error}</p>
                ) : (
                  <>
                    {!result && isStreaming && <p className={styles.thinking}>Vidhi is analyzing {selectedProfile?.name}'s chart…</p>}
                    <p className={styles.resultText}>{result}</p>
                  </>
                )}
              </div>
            )}

            <p className={styles.disclaimer}>
              Remedies are traditional, optional suggestions for guidance and peace of mind — not a substitute
              for medical, legal, or financial advice.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

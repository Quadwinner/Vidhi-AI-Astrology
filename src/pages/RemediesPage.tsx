import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  IconSparkles, IconBriefcase, IconHeart, IconActivity, IconCoin,
  IconSchool, IconGavel, IconStars, IconSend, IconWallet, IconChevronDown,
  IconDiamond, IconMusic, IconGift, IconFlame, IconBulb,
} from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import styles from './RemediesPage.module.css';

interface ProfileLite { id: string; name: string; }

interface Remedies {
  intro?: string;
  focus_planets?: string[];
  gemstones?: { stone?: string; planet?: string; finger?: string; metal?: string; day?: string; note?: string }[];
  mantras?: { mantra?: string; for?: string; count?: string; day?: string }[];
  rudraksha?: { mukhi?: string; note?: string } | null;
  charity?: { item?: string; day?: string }[];
  practices?: string[];
  lifestyle?: string[];
  closing?: string;
}

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
  const [remedies, setRemedies] = useState<Remedies | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!selectedProfileId && profiles.length) setSelectedProfileId(profiles[0].id);
  }, [profiles, selectedProfileId]);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  const handleGetRemedies = async () => {
    if (!selectedProfileId || loading) return;
    setError(null); setRemedies(null); setRawText(''); setLoading(true);
    trackEvent('Remedy Requested', { profile_id: selectedProfileId, area, has_custom: !!customText.trim() });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again.');

      const response = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/get-remedies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          profile_id: selectedProfileId, problem_area: area, problem_text: customText.trim(),
          client_date: new Date().toLocaleDateString('en-CA'),
        }),
      });
      const data = await response.json();

      if (response.status === 402 || data?.error === 'insufficient_funds') {
        setError('You don\u2019t have enough balance. Please recharge your wallet.');
      } else if (data?.error === 'no_chart') {
        setError('This profile\u2019s birth chart isn\u2019t generated yet. Open the profile to generate it first.');
      } else if (data?.error) {
        setError(data.message || 'Could not prepare remedies. Please try again.');
      } else if (data?.remedies) {
        setRemedies(data.remedies);
      } else if (data?.raw) {
        setRawText(data.raw);
      } else {
        setError('Could not prepare remedies. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasResult = !!remedies || !!rawText;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.kicker}><IconSparkles size={14} /> Vedic Remedies</div>
          <h1 className={styles.title}>Upaay — remedies for your concerns</h1>
          <p className={styles.subtitle}>
            Choose who it's for and what's troubling you. Vidhi reads the real birth chart and suggests
            personalized remedies — gemstone, mantra, rituals and simple daily practices.
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
              <div className={styles.profileSelect}>
                <button className={styles.profileToggle} onClick={() => setProfileOpen(o => !o)}>
                  <span className={styles.profileLabel}>Profile</span>
                  <span className={styles.profileName}>{selectedProfile?.name || 'Select'}</span>
                  <IconChevronDown size={16} className={`${styles.chev} ${profileOpen ? styles.chevOpen : ''}`} />
                </button>
                {profileOpen && (
                  <div className={styles.profileMenu}>
                    {profiles.map(p => (
                      <button key={p.id}
                        className={`${styles.profileItem} ${p.id === selectedProfileId ? styles.profileItemActive : ''}`}
                        onClick={() => { setSelectedProfileId(p.id); setProfileOpen(false); }}>{p.name}</button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" className={styles.walletPill} onClick={() => navigate('/wallet')}>
                <IconWallet size={15} /><span>{walletBalance != null ? formatPrice(walletBalance) : '\u2014'}</span>
              </button>
            </div>

            <div className={styles.areaGrid}>
              {PROBLEM_AREAS.map(a => (
                <button key={a.key}
                  className={`${styles.areaChip} ${area === a.key ? styles.areaActive : ''}`}
                  onClick={() => setArea(a.key)}>
                  {a.icon}<span>{a.key}</span>
                </button>
              ))}
            </div>

            <div className={styles.inputRow}>
              <input className={styles.textInput} value={customText}
                onChange={e => setCustomText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleGetRemedies(); }}
                placeholder={'Describe your concern (optional) \u2014 e.g. "delay in marriage"'} />
              <button className={styles.primaryBtn} onClick={handleGetRemedies} disabled={loading || !selectedProfileId}>
                <IconSend size={16} />{loading ? 'Reading chart\u2026' : 'Get Remedies'}
              </button>
            </div>

            {loading && (
              <div className={styles.loaderCard}>
                <div className={styles.spinner} />
                <p>Vidhi is analyzing {selectedProfile?.name}'s chart and preparing remedies…</p>
              </div>
            )}

            {error && !loading && <div className={styles.errorCard}>{error}</div>}

            {!loading && hasResult && (
              <div className={styles.result}>
                {rawText ? (
                  <div className={styles.card}><div className={styles.markdown}><ReactMarkdown>{rawText}</ReactMarkdown></div></div>
                ) : remedies && (
                  <>
                    {remedies.intro && (
                      <div className={styles.introCard}>
                        <div className={styles.introIcon}><IconSparkles size={22} /></div>
                        <p>{remedies.intro}</p>
                      </div>
                    )}

                    {Array.isArray(remedies.focus_planets) && remedies.focus_planets.length > 0 && (
                      <div className={styles.focusRow}>
                        <span className={styles.focusLabel}>Key influences</span>
                        {remedies.focus_planets.map((p, i) => <span key={i} className={styles.planetTag}>{p}</span>)}
                      </div>
                    )}

                    {Array.isArray(remedies.gemstones) && remedies.gemstones.length > 0 && (
                      <Section icon={<IconDiamond size={18} />} title="Gemstones">
                        <div className={styles.cardGrid}>
                          {remedies.gemstones.map((g, i) => (
                            <div key={i} className={styles.itemCard}>
                              <div className={styles.itemHead}>
                                <span className={styles.itemName}>{g.stone}</span>
                                {g.planet && <span className={styles.pill}>{g.planet}</span>}
                              </div>
                              <div className={styles.metaRow}>
                                {g.finger && <span>Finger: {g.finger}</span>}
                                {g.metal && <span>Metal: {g.metal}</span>}
                                {g.day && <span>Day: {g.day}</span>}
                              </div>
                              {g.note && <p className={styles.note}>{g.note}</p>}
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {Array.isArray(remedies.mantras) && remedies.mantras.length > 0 && (
                      <Section icon={<IconMusic size={18} />} title="Mantras">
                        <div className={styles.cardGrid}>
                          {remedies.mantras.map((m, i) => (
                            <div key={i} className={styles.itemCard}>
                              <p className={styles.mantraText}>{m.mantra}</p>
                              <div className={styles.metaRow}>
                                {m.for && <span>{m.for}</span>}
                                {m.count && <span>{m.count}</span>}
                                {m.day && <span>{m.day}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {remedies.rudraksha && (remedies.rudraksha.mukhi || remedies.rudraksha.note) && (
                      <Section icon={<IconStars size={18} />} title="Rudraksha">
                        <div className={styles.itemCard}>
                          {remedies.rudraksha.mukhi && <span className={styles.itemName}>{remedies.rudraksha.mukhi}</span>}
                          {remedies.rudraksha.note && <p className={styles.note}>{remedies.rudraksha.note}</p>}
                        </div>
                      </Section>
                    )}

                    {Array.isArray(remedies.charity) && remedies.charity.length > 0 && (
                      <Section icon={<IconGift size={18} />} title="Charity & Donation">
                        <ul className={styles.list}>
                          {remedies.charity.map((c, i) => (
                            <li key={i}>{c.item}{c.day ? ` \u2014 ${c.day}` : ''}</li>
                          ))}
                        </ul>
                      </Section>
                    )}

                    {Array.isArray(remedies.practices) && remedies.practices.length > 0 && (
                      <Section icon={<IconFlame size={18} />} title="Daily Practices">
                        <ul className={styles.list}>{remedies.practices.map((p, i) => <li key={i}>{p}</li>)}</ul>
                      </Section>
                    )}

                    {Array.isArray(remedies.lifestyle) && remedies.lifestyle.length > 0 && (
                      <Section icon={<IconBulb size={18} />} title="Practical Tips">
                        <ul className={styles.list}>{remedies.lifestyle.map((p, i) => <li key={i}>{p}</li>)}</ul>
                      </Section>
                    )}

                    {remedies.closing && <p className={styles.closing}>{remedies.closing}</p>}
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

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}><span className={styles.sectionIcon}>{icon}</span><h3>{title}</h3></div>
      {children}
    </div>
  );
}

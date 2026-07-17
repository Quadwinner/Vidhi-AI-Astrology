import React, { useEffect, useState } from 'react';
import {
  IconSparkles, IconHeart, IconBriefcase, IconActivity, IconCoin, IconStarFilled, IconStar,
} from '@tabler/icons-react';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import styles from './RashifalPage.module.css';

interface SignPrediction {
  sign: string; en?: string; hi?: string; key?: string;
  overall?: string; love?: string; career?: string; health?: string; finance?: string;
  lucky_color?: string; lucky_number?: string | number; rating?: number;
}

const SIGN_DATES: Record<string, string> = {
  aries: 'Mar 21 – Apr 19', taurus: 'Apr 20 – May 20', gemini: 'May 21 – Jun 20',
  cancer: 'Jun 21 – Jul 22', leo: 'Jul 23 – Aug 22', virgo: 'Aug 23 – Sep 22',
  libra: 'Sep 23 – Oct 22', scorpio: 'Oct 23 – Nov 21', sagittarius: 'Nov 22 – Dec 21',
  capricorn: 'Dec 22 – Jan 19', aquarius: 'Jan 20 – Feb 18', pisces: 'Feb 19 – Mar 20',
};

function Stars({ n }: { n: number }) {
  const r = Math.max(0, Math.min(5, Math.round(n || 0)));
  return (
    <span className={styles.stars}>
      {[1, 2, 3, 4, 5].map(i => i <= r
        ? <IconStarFilled key={i} size={13} />
        : <IconStar key={i} size={13} />)}
    </span>
  );
}

export default function RashifalPage() {
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [signs, setSigns] = useState<SignPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const { data, error } = await supabase.functions.invoke('get-rashifal', { body: { lang } });
        if (cancelled) return;
        if (error) throw new Error(error.message);
        if (data?.error) { setError('Could not load rashifal right now. Please try again shortly.'); }
        else { setSigns(Array.isArray(data?.signs) ? data.signs : []); setDate(data?.date || ''); }
      } catch (e: any) {
        if (!cancelled) setError('Could not load rashifal right now. Please try again shortly.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    trackEvent('Rashifal Viewed', { lang });
    return () => { cancelled = true; };
  }, [lang]);

  const prettyDate = date ? new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.kicker}><IconSparkles size={14} /> Daily Rashifal</div>
          <h1 className={styles.title}>{lang === 'hi' ? 'आज का राशिफल' : "Today's Horoscope"}</h1>
          {prettyDate && <p className={styles.subtitle}>{prettyDate}</p>}

          <div className={styles.langToggle}>
            <button className={lang === 'en' ? styles.langActive : ''} onClick={() => setLang('en')}>English</button>
            <button className={lang === 'hi' ? styles.langActive : ''} onClick={() => setLang('hi')}>हिंदी</button>
          </div>
        </header>

        {loading ? (
          <div className={styles.loaderCard}><div className={styles.spinner} /><p>{lang === 'hi' ? 'राशिफल तैयार हो रहा है…' : 'Preparing today\u2019s rashifal…'}</p></div>
        ) : error ? (
          <div className={styles.errorCard}>{error}</div>
        ) : (
          <div className={styles.grid}>
            {signs.map((s) => {
              const key = s.key || (s.en || s.sign || '').toLowerCase();
              const isOpen = expanded === key;
              return (
                <div key={key} className={`${styles.card} ${isOpen ? styles.cardOpen : ''}`} onClick={() => setExpanded(isOpen ? null : key)}>
                  <div className={styles.cardHead}>
                    <div>
                      <div className={styles.signName}>{lang === 'hi' && s.hi ? s.hi : (s.en || s.sign)}</div>
                      <div className={styles.signDates}>{SIGN_DATES[key] || ''}</div>
                    </div>
                    <Stars n={s.rating || 0} />
                  </div>

                  <p className={styles.overall}>{s.overall}</p>

                  {isOpen && (
                    <div className={styles.details}>
                      {s.love && <Detail icon={<IconHeart size={15} />} label={lang === 'hi' ? 'प्रेम' : 'Love'} text={s.love} />}
                      {s.career && <Detail icon={<IconBriefcase size={15} />} label={lang === 'hi' ? 'करियर' : 'Career'} text={s.career} />}
                      {s.health && <Detail icon={<IconActivity size={15} />} label={lang === 'hi' ? 'स्वास्थ्य' : 'Health'} text={s.health} />}
                      {s.finance && <Detail icon={<IconCoin size={15} />} label={lang === 'hi' ? 'धन' : 'Finance'} text={s.finance} />}
                    </div>
                  )}

                  <div className={styles.luckyRow}>
                    {s.lucky_color && <span className={styles.lucky}><i className={styles.dot} style={{ background: (s as any).lucky_color_code || colorHex(s.lucky_color) }} />{s.lucky_color}</span>}
                    {s.lucky_number != null && <span className={styles.lucky}>{lang === 'hi' ? 'शुभ अंक' : 'Lucky'} {s.lucky_number}</span>}
                    <span className={styles.expandHint}>{isOpen ? (lang === 'hi' ? 'कम' : 'Less') : (lang === 'hi' ? 'और' : 'More')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className={styles.detail}>
      <span className={styles.detailIcon}>{icon}</span>
      <span><b>{label}:</b> {text}</span>
    </div>
  );
}

function colorHex(name: string): string {
  const c = (name || '').toLowerCase();
  const map: Record<string, string> = {
    red: '#e5484d', green: '#46a758', blue: '#3b82f6', yellow: '#f5d90a', gold: '#E5B45B',
    white: '#f5f5f5', black: '#333', orange: '#f76b15', purple: '#8e4ec6', pink: '#e93d82',
    silver: '#c0c0c0', maroon: '#61072B', brown: '#8a5a2b', grey: '#8f8f8f', gray: '#8f8f8f',
    saffron: '#f4a300', cream: '#efe6d5',
  };
  for (const k of Object.keys(map)) if (c.includes(k)) return map[k];
  return '#E5B45B';
}

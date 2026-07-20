import React, { useEffect, useState, useCallback } from 'react';
import { IconCalendarStar } from '@tabler/icons-react';
import { supabase } from '../supabaseClient';
import { useBirthDetails } from '../utils/useBirthDetails';
import { trackEvent } from '../utils/analytics';
import styles from './ToolPage.module.css';

function todayDmy(): string {
  const iso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtSlot(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function PanchangPage() {
  const { details } = useBirthDetails();
  const [date, setDate] = useState(todayDmy());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true); setError(null);
    try {
      trackEvent('Panchang Viewed', {});
      const body: any = { date: d };
      if (details?.lat && details?.lon) { body.lat = details.lat; body.lon = details.lon; body.tz = details.tz; }
      const { data: res, error } = await supabase.functions.invoke('get-panchang', { body });
      if (error) throw new Error(error.message);
      if (res?.error) { setError('Panchang is unavailable right now. Please try again shortly.'); return; }
      setData(res);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [details]);

  useEffect(() => { load(todayDmy()); }, [load]);

  const p = data?.panchang;
  const horas: any[] = Array.isArray(data?.hora?.horas) ? data.hora.horas : [];

  const facts: [string, string, string?][] = [];
  if (p) {
    if (p.day?.name) facts.push(['Weekday', p.day.name]);
    if (p.tithi?.name) facts.push(['Tithi', `${p.tithi.name}${p.tithi.type ? ' · ' + p.tithi.type : ''}`, p.tithi.special || p.tithi.meaning]);
    if (p.nakshatra?.name) facts.push(['Nakshatra', `${p.nakshatra.name}${p.nakshatra.lord ? ' · ' + p.nakshatra.lord : ''}`, p.nakshatra.special || p.nakshatra.meaning]);
    if (p.yoga?.name) facts.push(['Yoga', p.yoga.name, p.yoga.special || p.yoga.meaning]);
    if (p.karana?.name) facts.push(['Karana', p.karana.name, p.karana.special || p.karana.meaning]);
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.kicker}><IconCalendarStar size={14} /> Panchang</div>
          <h1 className={styles.title}>Today&rsquo;s Panchang</h1>
          <p className={styles.subtitle}>Tithi, nakshatra, yoga, karana and auspicious Hora Muhurat for your day.</p>
        </header>

        <div className={styles.card}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="pan-date">Date (DD/MM/YYYY)</label>
              <input id="pan-date" className={styles.input} value={date} onChange={(e) => setDate(e.target.value)} placeholder="21/07/2026" />
            </div>
            <div className={styles.field} style={{ justifyContent: 'flex-end' }}>
              <button className={styles.submitBtn} style={{ marginTop: 0 }} onClick={() => load(date)} disabled={loading}>
                {loading ? 'Loading…' : 'View Panchang'}
              </button>
            </div>
          </div>
        </div>

        {error && <div className={styles.errorCard}>{error}</div>}

        {p && !error && (
          <div className={styles.result}>
            <div className={styles.grid2}>
              {facts.map(([label, value, sub], i) => (
                <div key={i} className={styles.kv}>
                  <div className={styles.kvLabel}>{label}</div>
                  <div className={styles.kvValue}>{value}</div>
                  {sub && <div className={styles.kvSub}>{sub}</div>}
                </div>
              ))}
            </div>

            {horas.length > 0 && (
              <div className={styles.card} style={{ marginTop: 18 }}>
                <div className={styles.sectionLabel}>Hora Muhurat</div>
                <div className={styles.muhuratList}>
                  {horas.map((h, i) => (
                    <div key={i} className={styles.muhuratItem}>
                      <span className={styles.muhuratTime}>{fmtSlot(h.start)} – {fmtSlot(h.end)}</span>
                      <div className={styles.muhuratBody}>
                        <h4>{h.hora} Hora{h.lucky_gem ? ` · ${h.lucky_gem}` : ''}</h4>
                        {h.benefits && <p>{h.benefits}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

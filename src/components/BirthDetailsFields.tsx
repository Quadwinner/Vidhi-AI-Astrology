import React from 'react';
import styles from '../pages/ToolPage.module.css';

export interface BirthInput { dob: string; tob: string; lat: string; lon: string; tz: string; name?: string }

interface Props {
  value: BirthInput;
  onChange: (next: BirthInput) => void;
  showName?: boolean;
  idPrefix?: string;
}

export default function BirthDetailsFields({ value, onChange, showName, idPrefix = '' }: Props) {
  const set = (k: keyof BirthInput, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className={styles.formGrid}>
      {showName && (
        <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
          <label className={styles.label} htmlFor={`${idPrefix}name`}>Full Name</label>
          <input id={`${idPrefix}name`} className={styles.input} value={value.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Full name" />
        </div>
      )}
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${idPrefix}dob`}>Date of Birth (DD/MM/YYYY)</label>
        <input id={`${idPrefix}dob`} className={styles.input} value={value.dob} onChange={(e) => set('dob', e.target.value)} placeholder="15/08/1990" />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${idPrefix}tob`}>Time of Birth (HH:MM)</label>
        <input id={`${idPrefix}tob`} className={styles.input} value={value.tob} onChange={(e) => set('tob', e.target.value)} placeholder="10:30" />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${idPrefix}lat`}>Latitude</label>
        <input id={`${idPrefix}lat`} className={styles.input} value={value.lat} onChange={(e) => set('lat', e.target.value)} placeholder="28.6139" />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${idPrefix}lon`}>Longitude</label>
        <input id={`${idPrefix}lon`} className={styles.input} value={value.lon} onChange={(e) => set('lon', e.target.value)} placeholder="77.2090" />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${idPrefix}tz`}>Timezone (e.g. 5.5)</label>
        <input id={`${idPrefix}tz`} className={styles.input} value={value.tz} onChange={(e) => set('tz', e.target.value)} placeholder="5.5" />
      </div>
    </div>
  );
}

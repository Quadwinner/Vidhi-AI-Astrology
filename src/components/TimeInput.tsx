// src/components/TimeInput.tsx
import React, { useState, useEffect } from 'react';
import styles from './TimeInput.module.css';
import SmallSelect, { SelectOption } from './SmallSelect';

interface TimeInputProps {
  value: string; // "HH:mm" 24-hour format or ""
  onChange: (value: string) => void;
  disabled: boolean;
}

export default function TimeInput({ value, onChange, disabled }: TimeInputProps) {
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  // Sync local state with value prop
  useEffect(() => {
    if (!value) {
      setHour('');
      setMinute('');
      setPeriod('AM');
      return;
    }
    const [h24, m] = value.split(':').map(Number);
    if (!isNaN(h24) && !isNaN(m)) {
      const newPeriod = h24 >= 12 ? 'PM' : 'AM';
      let newHour = h24 % 12;
      if (newHour === 0) newHour = 12;

      setHour(newHour.toString().padStart(2, '0'));
      setMinute(m.toString().padStart(2, '0'));
      setPeriod(newPeriod);
    }
  }, [value]);

  const notifyChange = (h: string, m: string, p: 'AM' | 'PM') => {
    const hNum = parseInt(h, 10);
    const mNum = parseInt(m, 10);
    if (isNaN(hNum) || isNaN(mNum)) return;

    let h24 = hNum;
    if (p === 'PM' && h24 !== 12) h24 += 12;
    if (p === 'AM' && h24 === 12) h24 = 0;

    onChange(`${h24.toString().padStart(2, '0')}:${mNum.toString().padStart(2, '0')}`);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    setHour(val); // keep raw user input
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    setMinute(val); // keep raw user input
  };

  const handleHourBlur = () => {
    if (!hour) return;
    let num = parseInt(hour, 10);
    if (isNaN(num)) {
      setHour('');
      return;
    }
    if (num < 1) num = 1;
    if (num > 12) num = 12;
    const fixed = num.toString().padStart(2, '0');
    setHour(fixed);
    if (minute.length === 2) notifyChange(fixed, minute, period);
  };

  const handleMinuteBlur = () => {
    if (!minute) return;
    let num = parseInt(minute, 10);
    if (isNaN(num)) {
      setMinute('');
      return;
    }
    if (num < 0) num = 0;
    if (num > 59) num = 59;
    const fixed = num.toString().padStart(2, '0');
    setMinute(fixed);
    if (hour.length > 0) notifyChange(hour.padStart(2, '0'), fixed, period);
  };

  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    setPeriod(newPeriod);
    if (hour.length === 2 && minute.length === 2) {
      notifyChange(hour, minute, newPeriod);
    }
  };

  const hourOptions: SelectOption[] = Array.from({ length: 12 }, (_, i) => {
    const h = (i + 1).toString().padStart(2, '0');
    return { value: h, label: h };
  });
  const minuteOptions: SelectOption[] = Array.from({ length: 60 }, (_, i) => {
    const m = i.toString().padStart(2, '0');
    return { value: m, label: m };
  });
  const periodOptions: SelectOption[] = [
    { value: 'AM', label: 'AM' },
    { value: 'PM', label: 'PM' },
  ];

  return (
    <div className={styles.timeInputContainer}>
      <div className={styles.selectWrapper}>
        <SmallSelect
          value={hour}
          onChange={(v) => { setHour(v); if (minute.length === 2) notifyChange(v, minute, period); }}
          options={hourOptions}
          disabled={disabled}
        />
        {!hour && <label className={styles.inputLabel}>Hour</label>}
      </div>

      <span className={styles.separator}>:</span>

      <div className={styles.selectWrapper}>
        <SmallSelect
          value={minute}
          onChange={(v) => { setMinute(v); if (hour.length === 2) notifyChange(hour, v, period); }}
          options={minuteOptions}
          disabled={disabled}
        />
        {!minute && <label className={styles.inputLabel}>Minute</label>}
      </div>

      <div className={styles.selectWrapperSmall}>
        <SmallSelect
          value={period}
          onChange={(v) => handlePeriodChange(v as 'AM' | 'PM')}
          options={periodOptions}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

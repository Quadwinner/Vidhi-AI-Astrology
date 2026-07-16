import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './SmallSelect.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SmallSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}

export default function SmallSelect({ value, onChange, options, disabled }: SmallSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | undefined>(undefined);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      // If click is inside trigger/container OR inside dropdown, do nothing
      if (ref.current && ref.current.contains(target)) return;
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      // Otherwise close
        setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        left: Math.round(r.left),
        top: Math.round(r.bottom + 8),
        width: Math.round(r.width),
      });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className={styles.container}
      data-disabled={disabled ? 'true' : 'false'}
      data-open={open ? 'true' : 'false'}
    >
      <button
        type="button"
        className={styles.trigger}
        ref={triggerRef}
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
      >
        <span>{current?.label ?? 'Select'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" className={open ? styles.chevUp : styles.chevDown}><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
      </button>
      {open && !disabled && createPortal(
        <div ref={dropdownRef} className={styles.dropdown} role="listbox" style={dropdownStyle}>
          {options.map(opt => (
            <div
              role="option"
              aria-selected={opt.value === value}
              key={opt.value}
              className={opt.value === value ? styles.optionActive : styles.option}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}



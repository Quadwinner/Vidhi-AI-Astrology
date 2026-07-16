// src/components/GenderSelector.tsx
import React from 'react';
import { IconGenderMale, IconGenderFemale, IconGenderTransgender } from '@tabler/icons-react';
import styles from './GenderSelector.module.css';

interface GenderSelectorProps {
  selectedValue: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

const options = [
  { value: 'Male', label: 'Male', icon: <IconGenderMale size={24} /> },
  { value: 'Female', label: 'Female', icon: <IconGenderFemale size={24} /> },
  { value: 'Other', label: 'Other', icon: <IconGenderTransgender size={24} /> },
];

export default function GenderSelector({ selectedValue, onChange, disabled }: GenderSelectorProps) {
  return (
    <div className={styles.genderContainer}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          // --- THIS IS THE CHANGE: Added a dynamic class for each gender ---
          className={`${styles.genderOption} ${styles[option.value.toLowerCase()]} ${selectedValue === option.value ? styles.selected : ''}`}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          <div className={styles.iconWrapper}>{option.icon}</div>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
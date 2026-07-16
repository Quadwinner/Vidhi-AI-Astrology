// src/components/FaqItem.tsx

import React, { useState } from 'react';
import styles from './FaqItem.module.css';
import { IconPlus, IconMinus } from '@tabler/icons-react';

interface FaqItemProps {
  question: string;
  answer: string;
  icon: React.ReactNode; // --- 1. ACCEPT THE NEW 'icon' PROP ---
}

export default function FaqItem({ question, answer, icon }: FaqItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.faqItem}>
      <button className={styles.questionHeader} onClick={() => setIsOpen(!isOpen)}>
        <div className={styles.questionText}>
          {/* --- 2. RENDER THE PASSED-IN ICON --- */}
          <span className={styles.iconWrapper}>{icon}</span>
          <span>{question}</span>
        </div>
        <span className={styles.toggleIcon}>
          {isOpen ? <IconMinus size={18} /> : <IconPlus size={18} />}
        </span>
      </button>
      <div className={`${styles.answer} ${isOpen ? styles.open : ''}`}>
        <p>{answer}</p>
      </div>
    </div>
  );
}
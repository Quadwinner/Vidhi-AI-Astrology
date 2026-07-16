// src/components/ProviderSelectionModal.tsx
import React from 'react';
import styles from './ProviderSelectionModal.module.css';

interface ProviderSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProvider: (provider: 'ultravox' | 'agora') => void;
}

const ProviderSelectionModal: React.FC<ProviderSelectionModalProps> = ({ isOpen, onClose, onSelectProvider }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Choose Your Call Experience</h2>
        <p className={styles.description}>
          Select the type of AI call you'd like to start.
        </p>
        <div className={styles.buttonContainer}>
          <button
            className={`${styles.button} ${styles.ultravox}`}
            onClick={() => onSelectProvider('ultravox')}
          >
            <h3>Ultravox Call</h3>
            <p>Ultravox Call Experience.</p>
          </button>
          <button
            className={`${styles.button} ${styles.agora}`}
            onClick={() => onSelectProvider('agora')}
          >
            <h3>Agora AI Call</h3>
            <p>Agora AI Call Experience.</p>
          </button>
        </div>
        <button className={styles.closeButton} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ProviderSelectionModal;
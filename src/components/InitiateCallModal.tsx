import React from 'react';
import { IconPhone } from '@tabler/icons-react';
import styles from './InitiateCallModal.module.css';
import { usePricing } from '../context/PricingContext'; // <--- 1. Import Context

interface InitiateCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  walletBalance: number | null; // <--- 2. Changed from coinBalance
  onBuyCoinsClick: () => void; 
}

const InitiateCallModal: React.FC<InitiateCallModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  walletBalance, // <--- Used here
  onBuyCoinsClick
}) => {
  
  // <--- 3. Get Dynamic Pricing
  const { prices, formatPrice } = usePricing();
  // Ensure this key matches your DB 'service_types' table
  const costPerMinute = prices['voice_call_minute'] || 0; 

  if (!isOpen) return null;

  const currentBalance = walletBalance ?? 0;
  const hasEnoughFunds = currentBalance >= costPerMinute;

  const handleBuyCoins = () => {
    onBuyCoinsClick(); 
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalIcon}>
          <div className={styles.iconCircle}>
            <IconPhone size={24} />
          </div>
        </div>

        <div className={styles.modalTitle}>
          <h3>Initiate a Call?</h3>
          <p>Would you like to start a personalized consultation call with Vidhi AI to discuss your charts and reports?</p>
        </div>

        <div className={styles.pricingInfo}>
          <div className={styles.pricingRow}>
            <div className={styles.pricingDot}></div>
            {/* <--- 4. Formatted Display */}
            <span>Rate: {formatPrice(costPerMinute)} / min</span>
          </div>
          <p className={styles.pricingNote}>
            Your current balance: <strong>{formatPrice(currentBalance)}</strong>
          </p>
          {!hasEnoughFunds && (
            <p className={styles.errorNote}>
              You need at least {formatPrice(costPerMinute)} to start a call.
            </p>
          )}
        </div>

        <div className={styles.modalActions}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          {hasEnoughFunds ? (
            <button className={styles.confirmButton} onClick={onConfirm}>
              <IconPhone size={14} />
              <span>Call Now</span>
            </button>
          ) : (
            <button className={styles.confirmButton} onClick={handleBuyCoins}>
              Add Money
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InitiateCallModal;
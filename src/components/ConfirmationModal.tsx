import React from 'react';
import { Link } from 'react-router-dom';
import styles from './ConfirmationModal.module.css';
import { usePricing } from '../context/PricingContext'; // <--- 1. Import Context

export interface ConfirmationData {
  title: string;
  cost: number; // Minor units (e.g. 1000)
  reportKey: string;
  displayCost?: string; 
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reportKey: string, cost: number) => void;
  data: ConfirmationData | null;
  walletBalance: number | null; // <--- 2. Changed from coinBalance
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  data,
  walletBalance, // <--- Used here
}: ConfirmationModalProps) {
  
  const { formatPrice } = usePricing(); // <--- 3. Get formatter

  if (!isOpen || !data) {
    return null;
  }

  const currentBalance = walletBalance ?? 0;
  const hasSufficientFunds = currentBalance >= data.cost;
  const balanceAfter = currentBalance - data.cost;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>

        <button className={styles.modalClose} onClick={onClose}>×</button>

        {hasSufficientFunds ? (
          <>
            {data.cost > 0 ? (
              <>
                <h2 className={styles.title}>Confirm Purchase</h2>
                <p className={styles.description}>
                  You are about to generate the <strong>{data.title}</strong>.
                </p>
                <div className={styles.balanceInfo}>
                  <div className={styles.balanceRow}>
                    <span>Your Current Balance:</span>
                    {/* <--- 4. Use formatPrice instead of "Coins" */}
                    <span className={styles.coinValue}>{formatPrice(currentBalance)}</span>
                  </div>
                  <div className={styles.balanceRow}>
                    <span>Report Cost:</span>
                    <span className={styles.coinValueNegative}>- {formatPrice(data.cost)}</span>
                  </div>
                  <hr className={styles.divider} />
                  <div className={`${styles.balanceRow} ${styles.total}`}>
                    <span>Balance After Purchase:</span>
                    <span className={styles.coinValue}>{formatPrice(balanceAfter)}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className={styles.title}>Free with Premium</h2>
                <p className={styles.description}>
                  As a premium subscriber, the <strong>{data.title}</strong> is included with your plan at no extra cost.
                </p>
                <div className={styles.balanceInfo}>
                  <div className={styles.balanceRow}>
                    <span>Your Wallet Balance:</span>
                    <span className={styles.coinValue}>{formatPrice(currentBalance)}</span>
                  </div>
                  <div className={`${styles.balanceRow} ${styles.total}`}>
                    <span>This will not affect your balance.</span>
                  </div>
                </div>
              </>
            )}

            <div className={styles.buttonGroup}>
              <button className={`${styles.button} ${styles.cancelButton}`} onClick={onClose}>
                Cancel
              </button>
              <button className={`${styles.button} ${styles.confirmButton}`} onClick={() => onConfirm(data.reportKey, data.cost)}>
                Confirm & Generate
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className={styles.title}>Insufficient Funds</h2>
            <p className={styles.description}>
              Sorry, you do not have enough funds to generate the <strong>{data.title}</strong>.
            </p>

            <div className={styles.balanceInfo}>
              <div className={styles.balanceRow}>
                <span>Your Current Balance:</span>
                <span className={styles.coinValue}>{formatPrice(currentBalance)}</span>
              </div>
              <div className={styles.balanceRow}>
                <span>Report Cost:</span>
                <span className={styles.coinValueNegative}>- {formatPrice(data.cost)}</span>
              </div>
              <hr className={styles.divider} />
              <p className={styles.shortfall}>
                You need {formatPrice(data.cost - currentBalance)} more.
              </p>
            </div>

            <div className={styles.buttonGroup}>
              <button className={`${styles.button} ${styles.cancelButton}`} onClick={onClose}>
                Cancel
              </button>
              {/* <--- 5. Point to /wallet for recharging */}
              <Link to="/wallet" className={`${styles.button} ${styles.rechargeButton}`}>
                Recharge Wallet
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
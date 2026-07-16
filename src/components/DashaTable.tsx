import React, { useState } from 'react';
import styles from './DashaTable.module.css';

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6l4 4 4-4" />
  </svg>
);

// Interfaces remain the same
interface DashaPeriod {
  "Mahadasha Lord": string;
  "Antardasha Lord": string;
  "Start Date": string;
  "End Date": string;
}
interface GroupedDasha {
  mahadashaLord: string;
  startDate: string;
  endDate: string;
  antardashas: DashaPeriod[];
}
interface DashaTableProps {
  data: DashaPeriod[];
}

export default function DashaTable({ data }: DashaTableProps) {
  const [openMahadasha, setOpenMahadasha] = useState<string | null>(null);

  // Data restructuring logic remains the same
  const groupedData = data.reduce<GroupedDasha[]>((acc, period) => {
    let mahadasha = acc.find(md => md.mahadashaLord === period["Mahadasha Lord"]);
    if (!mahadasha) {
      const startDate = data.find(p => p["Mahadasha Lord"] === period["Mahadasha Lord"])!["Start Date"];
      const endDate = [...data].reverse().find(p => p["Mahadasha Lord"] === period["Mahadasha Lord"])!["End Date"];
      mahadasha = { mahadashaLord: period["Mahadasha Lord"], startDate: startDate, endDate: endDate, antardashas: [] };
      acc.push(mahadasha);
    }
    mahadasha.antardashas.push(period);
    return acc;
  }, []);

  const handleToggle = (mahadashaLord: string) => {
    setOpenMahadasha(prev => (prev === mahadashaLord ? null : mahadashaLord));
  };

  if (!groupedData || groupedData.length === 0) {
    return <p className={styles.centeredMessage}>No Dasha data available.</p>;
  }

  return (
    <div className={styles.dashaContainer}>
      <div className={styles.tableHeader}>
        <span>Mahadasha Lord</span>
        <span>Start Date</span>
        <span>End Date</span>
        <span className={styles.expandCell}></span>
      </div>

      {groupedData.map((md, index) => {
        const isOpen = openMahadasha === md.mahadashaLord;

        return (
          <div key={index} className={styles.mahadashaSection}>
            {/* --- MODIFIED: Added conditional 'active' class --- */}
            <div
              className={`${styles.mahadashaRow} ${isOpen ? styles.active : ''}`}
              onClick={() => handleToggle(md.mahadashaLord)}
            >
              {/* --- MODIFIED: Added data-label attributes --- */}
              <span data-label="Mahadasha Lord">{md.mahadashaLord}</span>
              <span data-label="Start Date">{md.startDate}</span>
              <span data-label="End Date">{md.endDate}</span>
              <div className={`${styles.chevron} ${isOpen ? styles.open : ''}`}>
                <ArrowIcon />
              </div>
            </div>

            {isOpen && (
              <div className={styles.antardashaWrapper}>
                <div className={`${styles.tableHeader} ${styles.antardashaHeader}`}>
                  <span>Antardasha Lord</span>
                  <span>Start Date</span>
                  <span>End Date</span>
                </div>
                {md.antardashas.map((ad, adIndex) => (
                  <div key={adIndex} className={styles.antardashaRow}>
                    {/* --- MODIFIED: Added data-label attributes --- */}
                    <span data-label="Antardasha Lord">{ad["Antardasha Lord"]}</span>
                    <span data-label="Start Date">{ad["Start Date"]}</span>
                    <span data-label="End Date">{ad["End Date"]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
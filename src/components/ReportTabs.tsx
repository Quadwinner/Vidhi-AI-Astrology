import React from 'react';
import styles from './ReportTabs.module.css';
import { BsStars, BsGrid3X3 } from 'react-icons/bs';

interface ReportTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// --- THE FIX IS HERE ---
// We use the OLD keys that ReportsPage expects, but the NEW labels for the UI.
const TABS = [
  { key: 'tables',  label: 'Charts',  icon: <BsGrid3X3 size={18} /> },
  { key: 'ai',      label: 'Reports', icon: <BsStars size={18} /> },
];

export default function ReportTabs({ activeTab, setActiveTab }: ReportTabsProps) {
  return (
    <div className={styles.tabsContainer}>
      {TABS.map(tab => (
        <button
          key={tab.key}
          // This logic now correctly compares `activeTab` ('tables' or 'ai') with our `tab.key`
          className={`${styles.tabButton} ${activeTab === tab.key ? styles.active : ''}`}
          // This now correctly sends the key ('tables' or 'ai') to the parent component
          onClick={() => setActiveTab(tab.key)}
        >
          {tab.icon}
          {/* This correctly displays the new label ('Charts' or 'Reports') */}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
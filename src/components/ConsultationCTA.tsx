import React from 'react';
import { Link } from 'react-router-dom'; // 1. Import the Link component
import styles from './ConsultationCTA.module.css';

// Self-contained Chat Icon Component
const ChatIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

// Self-contained Call Icon Component
const CallIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
  </svg>
);


export default function ConsultationCTA() {
  return (
    <div className={styles.ctaContainer}>
      <p className={styles.ctaText}>
        Connect with an Astrologer on Call or Chat for more personalised detailed predictions.
      </p>
      <div className={styles.buttonContainer}>
        <Link to="/chat" className={styles.ctaButton}>
          <ChatIcon />
          <span>Chat with Astrologer</span>
        </Link>
        <Link to="/chat?startCall=1" className={styles.ctaButton}>
          <CallIcon />
          <span>Call with Astrologer</span>
        </Link>
      </div>
    </div>
  );
}
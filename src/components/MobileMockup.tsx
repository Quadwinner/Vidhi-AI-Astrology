import React from 'react';
import styles from './MobileMockup.module.css';

// Import the downloaded images
import personalizedReportsImg from '../assets/mockup-personalized-reports.png';
import auraIntroImg from '../assets/mockup-aura-intro.png';
import voiceChatImg from '../assets/mockup-voice-chat.png';

export default function MobileMockup() {
  return (
    <div className={styles.mockupContainer}>
      <div className={`${styles.phoneMockup} ${styles.phoneMockup1}`}>
        <div className={styles.screen}>
          <img 
            src={personalizedReportsImg} 
            alt="Personalized Reports" 
            className={styles.screenImage}
          />
        </div>
      </div>
      <div className={`${styles.phoneMockup} ${styles.phoneMockup2}`}>
        <div className={styles.screen}>
          <img 
            src={auraIntroImg} 
            alt="AURA AI Intro" 
            className={styles.screenImage}
          />
        </div>
      </div>
      <div className={`${styles.phoneMockup} ${styles.phoneMockup3}`}>
        <div className={styles.screen}>
          <img 
            src={voiceChatImg} 
            alt="Voice Chat" 
            className={styles.screenImage}
          />
        </div>
      </div>
    </div>
  );
}

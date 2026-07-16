// src/components/VoiceCallPrompt.tsx
import React from "react";
import styles from "./VoiceCallPrompt.module.css";
import { IconPhone } from "@tabler/icons-react";

interface VoiceCallPromptProps {
  onStartCall: () => void;
  onClose: () => void;
}

export default function VoiceCallPrompt({ onStartCall, onClose }: VoiceCallPromptProps) {
  const handleStart = () => {
    try {
      onStartCall();
    } finally {
      // ensure the prompt closes locally (and in case onStartCall doesn't navigate)
      onClose();
    }
  };

  return (
    <div className={styles.card}>
      <button className={styles.closeButton} onClick={onClose}>✕</button>
      <IconPhone size={28} className={styles.icon} />
      <h4 className={styles.switch}>Switch to Voice Call?</h4>
      <p className={styles.promptpara}>Get a more personal consultation experience</p>
      <button className={styles.startButton} onClick={handleStart}>
        Start Voice Call
      </button>
    </div>
  );
}

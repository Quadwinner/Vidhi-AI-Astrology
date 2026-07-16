import React, { useState, useEffect, useRef } from 'react';
import styles from './ChatInput.module.css';
import { IconSend, IconMicrophone, IconMicrophoneOff, IconPhone, IconCheck, IconX } from '@tabler/icons-react';
import { supabase } from '../supabaseClient';
import { WhisperManager } from '../utils/WhisperManager';
import { trackEvent } from '../utils/analytics';

interface ChatInputProps {
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  isOutOfCoins: boolean; // This prop is still useful for other potential UI cues
  onUpgrade: () => void;
  isPremiumUser: boolean;
  onStartCall?: () => void;
  isCallFeatureEnabled?: boolean;
  isMobile?: boolean;
}

export default function ChatInput({
  isLoading,
  onSendMessage,
  isOutOfCoins, // We keep the prop but change how it's used
  onUpgrade,
  isPremiumUser,
  onStartCall,
  isCallFeatureEnabled,
  isMobile = false
}: ChatInputProps) {

  const [currentInput, setCurrentInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sttMode, setSttMode] = useState<'realtime' | 'batch' | 'unsupported'>('unsupported');
  const whisperManagerRef = useRef<WhisperManager | null>(null);
  const [micState, setMicState] = useState<'idle' | 'listening' | 'confirm'>('idle')

  useEffect(() => {
    if (WhisperManager.isSpeechRecognitionSupported()) {
      setSttMode('realtime');
    } else if (navigator.mediaDevices && window.MediaRecorder) {
      setSttMode('batch');
    }

    const initializeWhisperManager = async () => {
      if (!whisperManagerRef.current) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const whisperEndpoint = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/transcribe-audio`;
        const manager = new WhisperManager(whisperEndpoint);
        manager.setAuthToken(session.access_token);
        manager.onRecordingStart = () => { setIsRecording(true); setMicState('listening') }
        manager.onRecordingStop = () => {
          setIsRecording(false);
          setMicState('idle')
          if (sttMode === 'batch') setIsTranscribing(true);
        };
        manager.onTranscriptionReceived = (text: string) => {
          setCurrentInput(text);
          if (sttMode === 'batch') setIsTranscribing(false);
        };
        manager.onError = (err: string) => {
          console.error(`Transcription Error: ${err}`);
          setIsRecording(false);
          setIsTranscribing(false);
          setMicState('idle');
        };
        whisperManagerRef.current = manager;
      }
    };

    initializeWhisperManager();

    return () => {
      whisperManagerRef.current?.cleanup();
    };
  }, [sttMode]);

  const handleToggleRecording = () => {
    trackEvent('Mic Button Clicked', {
      source: 'Chat Input',
      stt_mode: sttMode
    });
    if (!whisperManagerRef.current) return;
    if (micState === 'idle') {
      setCurrentInput('');
      setMicState('listening');
      if (sttMode === 'realtime') {
        whisperManagerRef.current.startRealtimeRecognition({
          onResult: (text) => setCurrentInput(text),
        });
      } else if (sttMode === 'batch') {
        whisperManagerRef.current.startBatchRecording();
      }
    } else if (micState === 'listening') {
      whisperManagerRef.current.stopRecording();
      setMicState('confirm');
    } else if (micState === 'confirm') {
      setMicState('idle');
    }
  };

  const handleLocalSendMessage = () => {
    if (currentInput.trim()) {
      onSendMessage(currentInput);
      setCurrentInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading && !isRecording) {
      handleLocalSendMessage();
    }
  };

  // --- FIX APPLIED HERE ---
  // The entire `if (isOutOfCoins)` block that returned the banner has been REMOVED.
  // The component now proceeds directly to rendering the form.

  const getPlaceholderText = () => {
    if (isRecording) return sttMode === 'realtime' ? "Listening..." : "Recording audio...";
    return "Ask a question or click the mic to speak...";
  }

  const isUIBlocked = isLoading || isTranscribing;

  const renderMicIcon = () => {
    if (micState === 'idle') return <IconMicrophone size={20} strokeWidth={2} />;
    if (micState === 'listening') {
      return (
        <div className={styles.orbitingDots}>
          <div className={styles.orbitDot} style={{ '--delay': '0s' } as React.CSSProperties}></div>
          <div className={styles.orbitDot} style={{ '--delay': '-0.5s' } as React.CSSProperties}></div>
          <div className={styles.orbitDot} style={{ '--delay': '-1s' } as React.CSSProperties}></div>
          <div className={styles.orbitDot} style={{ '--delay': '-1.5s' } as React.CSSProperties}></div>
        </div>
      );
    }
    if (micState === 'confirm') return <IconX size={20} strokeWidth={2} />;
    return <IconMicrophone size={20} strokeWidth={2} />;
  };

  return (
    <form className={styles.inputForm} onSubmit={handleSubmit}>
      <div className={styles.inputAreaWrapper}>
        {isRecording && sttMode === 'batch' ? (
          <div className={styles.visualizerPlaceholder}>
            <IconMicrophone size={20} />
            <span>Listening... Click mic again to stop.</span>
          </div>
        ) : (
          <input
            type="text"
            className={styles.inputField}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            placeholder={getPlaceholderText()}
            disabled={isUIBlocked || isRecording}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
        )}
      </div>
      <div className={styles.buttons}>
        {!isMobile && onStartCall && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={onStartCall}
            disabled={isUIBlocked || isRecording || !isCallFeatureEnabled}
            title={!isCallFeatureEnabled ? 'AI Call unavailable' : 'Start AI Voice Call'}
          >
            <IconPhone size={20} strokeWidth={2} />
          </button>
        )}

        {/* <button
          type="button"
          className={`${styles.iconButton} 
         ${micState === 'listening' ? styles.sendButtonGreen : ''} 
         ${micState === 'confirm' ? styles.sendButtonRed : ''}`}
          onClick={handleToggleRecording}
          disabled={isUIBlocked || sttMode === 'unsupported'}
          title={sttMode === 'unsupported' ? 'Voice input not supported' : 'Start/Stop voice input'}
        >
          {renderMicIcon()}
        </button> */}

        <button
          type="submit"
          className={styles.iconButton}
          disabled={isUIBlocked || isRecording || !currentInput.trim()}
          title="Send message"
        >
          <IconSend size={20} strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}
// File: src/components/AICallScreen.tsx
// REVERTED TO SIMPLER "LISTENING" STATE LOGIC

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './AICallScreen.module.css';
import { IconPhoneOff, IconMicrophone, IconMicrophoneOff } from '@tabler/icons-react';
import { supabase } from '../supabaseClient';
import { EnrichedProfile } from './ProfileCard';
import { AgoraManager } from '../utils/AgoraManager';
import LoadingSpinner from './LoadingSpinner';
import CallFeedback from './CallFeedback';
import { trackEvent } from '../utils/analytics';
import { useCallCoinCost } from '../hooks/useCallCoinCost';
import { useAuth } from '../context/AuthContext';

interface AICallScreenProps {
  profile: EnrichedProfile;
  onCallEnded: () => void;
}

const AICallScreen: React.FC<AICallScreenProps> = ({ profile, onCallEnded }) => {
  // --- Simplified State Management ---
  const [callState, setCallState] = useState<'connecting' | 'active' | 'error'>('connecting');
  const [view, setView] = useState<'call' | 'feedback'>('call');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState('');
  const [callDuration, setCallDuration] = useState<number>(0); // in seconds

  const callCoinCostSetting = useCallCoinCost();
  const [callCoinCost, setCallCoinCost] = useState<number>(callCoinCostSetting);
  const { updateCoinBalance } = useAuth();

  useEffect(() => {
    setCallCoinCost(callCoinCostSetting);
  }, [callCoinCostSetting]);

  // We keep this state because it reliably fixes the End Call button.
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // --- Refs for our manager instances ---
  const callManagerRef = useRef<AgoraManager | null>(null);
  const callLogIdRef = useRef<string | null>(null);
  const coinDeductionIntervalRef = useRef<any>(null);
  const durationIntervalRef = useRef<any>(null);
  const callStartTimeRef = useRef<number>(Date.now());

  // Format duration helper
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    trackEvent('AI Call Screen Visited', {
      profile_id: profile.id,
      profile_name: profile.name
    });
  }, []);

  // --- Core Lifecycle Effect ---
  useEffect(() => {
    let isCancelled = false;

    const initializeAndStartCall = async () => {
      if (isCancelled) return;

      try {
        // Entitlement-first start-call
        const { data: startData, error: startError } = await supabase.functions.invoke('start-call', {
          body: { profile_id: profile.id }
        });
        if (startError || startData?.error) {
          const msg = startError?.context?.json?.error || startError?.message || startData?.error || 'Failed to start call';
          throw new Error(msg);
        }
        callLogIdRef.current = startData.call_log_id;
        callStartTimeRef.current = Date.now();
        if (startData?.coins_per_minute !== undefined) {
          setCallCoinCost(startData.coins_per_minute);
        }

        const { data, error: invokeError } = await supabase.functions.invoke('initiate-ai-call', {
          body:
          {
            profile_id: profile.id,
            // This flag tells our router which logic to use.
            provider: 'agora'
          }
        });

        if (invokeError) throw new Error(invokeError.context?.json?.error || invokeError.message);

        // Handle the new error format where errors return 200 status with { error: "message" }
        if (data && data.error) throw new Error(data.error);

        const { systemPrompt, gender } = data;
        if (!systemPrompt) throw new Error("Could not retrieve call configuration from server.");

        if (isCancelled) return;

        const manager = new AgoraManager();
        callManagerRef.current = manager;

        // --- Register Simplified Event Handlers ---
        manager.onCallStarted = () => {
          if (isCancelled) return;
          setCallState('active');
          // Start timers
          if (!coinDeductionIntervalRef.current) {
            // AFTER
            // --- THIS IS THE NEW, MORE DETAILED DEBUGGING BLOCK ---

            coinDeductionIntervalRef.current = setInterval(async () => {
              // Log #1: To confirm the timer is running every minute.
              console.log('[AICallScreen] Deduction interval fired. Preparing to call function...');

              const callLogId = callLogIdRef.current;
              if (!callLogId) {
                console.error('[AICallScreen] Aborting deduction: call_log_id is missing.');
                return;
              }

              try {
                const { data: deductData, error: deductError } = await supabase.functions.invoke('deduct-call-coins', {
                  body: {
                    call_log_id: callLogId,
                    // We can send 0 for these as the backend doesn't use them anymore, but it's good to match the interface.
                    duration_seconds: 0,
                    coins_deducted: 0
                  }
                });

                // Log #2: This will only run if the function call SUCCEEDS.
                console.log('[AICallScreen] Received from server:', { deductData, deductError });

                if (deductError) {
                  // This handles errors returned by the function itself (e.g., a 4xx error)
                  console.error('[AICallScreen] Error returned from Supabase function:', deductError.message);
                  setError('An error occurred with billing. Call ended.');
                  setCallState('error');
                  handleEndCall();
                  return;
                }

                if (deductData.success && deductData.coin_balance !== undefined) {
                  console.log(`[AICallScreen] Calling updateCoinBalance with: ${deductData.coin_balance}`);
                  updateCoinBalance(deductData.coin_balance);
                }

                if (deductData?.should_end_call) {
                  setError('Insufficient coins. Call ended.');
                  setCallState('error');
                  handleEndCall();
                }

              } catch (error) {
                // Log #3: THIS IS THE MOST IMPORTANT PART.
                // This will catch any NETWORK errors or other critical failures with the invoke call itself.
                console.error('[AICallScreen] CRITICAL ERROR during function invocation:', error);
                setError('A network error occurred with billing. Call ended.');
                setCallState('error');
                handleEndCall();
              }
            }, 60000); // Runs every 60 seconds
          }
          if (!durationIntervalRef.current) {
            durationIntervalRef.current = setInterval(() => {
              const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
              setCallDuration(elapsed);
            }, 1000);
          }
        };
        manager.onError = (err) => {
          if (!isCancelled) {
            setError(err);
            setCallState('error');
            setTimeout(onCallEnded, 4000);
          }
        };
        manager.onCallEnded = () => {
          if (isCancelled) return;
          setView('feedback');
          const callLogId = callLogIdRef.current;
          if (coinDeductionIntervalRef.current) { clearInterval(coinDeductionIntervalRef.current); coinDeductionIntervalRef.current = null; }
          if (durationIntervalRef.current) { clearInterval(durationIntervalRef.current); durationIntervalRef.current = null; }
          if (callLogId) {
            const elapsedSeconds = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
            supabase.functions.invoke('end-call', { body: { call_log_id: callLogId, final_duration: elapsedSeconds, status: 'completed' } });
            callLogIdRef.current = null;
          }
        };

        // This is the only interactive state we will track.
        manager.onUserTranscript = (transcript) => !isCancelled && setUserTranscript(transcript);

        // We no longer track the AI's speaking state.
        // manager.onAiSpeaking = () => {};

        await manager.connectCall(systemPrompt, gender);

      } catch (err: any) {
        if (!isCancelled) {
          console.error('[AICallScreen] Call failed:', err);

          // Extract error message from different possible locations
          let errorMessage = err.message || "Failed to start the call.";

          // Check if the error has context with JSON data (for Supabase function errors)
          if (err.context?.json?.error) {
            errorMessage = err.context.json.error;
          }

          console.error('[AICallScreen] Extracted error message:', errorMessage);

          // Handle different types of errors with specific messages
          let displayMessage = '';
          if (errorMessage.includes('Insufficient coins') || errorMessage.includes('at least') || errorMessage.includes('coin')) {
            displayMessage = `Insufficient Coins! You need at least ${callCoinCost} coins to start a call.`;
          } else if (errorMessage.includes('Authentication failed') || errorMessage.includes('Missing Authorization')) {
            displayMessage = 'Authentication Error! Please log in again and try starting the call.';
          } else if (errorMessage.includes('Profile not found')) {
            displayMessage = 'Profile Error! The selected profile could not be found. Please refresh and try again.';
          } else if (errorMessage.includes('Unauthorized access')) {
            displayMessage = 'Access Denied! You do not have permission to access this profile.';
          } else {
            displayMessage = `Call Failed: ${errorMessage}`;
          }

          setError(displayMessage);
          setCallState('error');
          setTimeout(onCallEnded, 5000); // Give more time to read the error
        }
      }
    };

    initializeAndStartCall();

    // --- Cleanup Function ---
    return () => {
      console.log("AICallScreen unmounting. Disconnecting Agora call.");
      isCancelled = true;
      callManagerRef.current?.disconnectCall();
      if (coinDeductionIntervalRef.current) { clearInterval(coinDeductionIntervalRef.current); coinDeductionIntervalRef.current = null; }
      if (durationIntervalRef.current) { clearInterval(durationIntervalRef.current); durationIntervalRef.current = null; }
    };
  }, [profile.id, onCallEnded, updateCoinBalance]);

  // --- Event Handlers (Unchanged) ---
  const handleEndCall = useCallback(async () => {
    if (isDisconnecting) return;
    setIsDisconnecting(true);

    try {
      console.log("User initiated call end");

      // Set a timeout to force end the call if disconnection takes too long
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Disconnect timeout')), 5000)
      );

      const disconnectPromise = callManagerRef.current?.disconnectCall();

      await Promise.race([disconnectPromise, timeoutPromise]);
      console.log("Call disconnection completed");

    } catch (error) {
      console.error("Error ending call:", error);
      // Force end call if there's an error or timeout
      console.log("Forcing call to end due to error/timeout");
      setView('feedback');
    }
  }, [isDisconnecting]);

  const handleToggleMute = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    callManagerRef.current?.setMuted(newMutedState);
  }, [isMuted]);

  const handleSubmitFeedback = async (rating: number, comments: string) => {
    try {
      await supabase.functions.invoke('submit-call-feedback', {
        body: { profile_id: profile.id, rating, comments },
      });
    } catch (err) {
      console.error("An unexpected error occurred while submitting feedback:", err);
    } finally {
      onCallEnded();
    }
  };

  const handleCloseFeedback = () => {
    onCallEnded();
  };

  // --- REVERTED: Simplified Status Text Logic ---
  const getStatusText = () => {
    if (callState === 'error') return error || 'An unknown error occurred';
    if (isDisconnecting) return 'Ending call...';
    if (callState === 'connecting') return '';

    // If we have a transcript from the user, show it. Otherwise, show "Listening...".
    return userTranscript || 'Listening...';
  };

  // --- Render Logic ---
  return (
    <div className={styles.callContainer}>
      {callState === 'error' ? (
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>⚠️</div>
          <h2>Call Failed</h2>
          <p>{error}</p>
          <button onClick={onCallEnded} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      ) : view === 'call' && (
        <>
          {/* Call Header with Timer */}
          <div className={styles.callHeader}>
            <div className={styles.headerTitle}>
              <h2>Vidhi AI</h2>
              <div className={styles.voiceActiveStatus}>
                <span className={styles.statusDot}></span>
                <span>Voice Active</span>
              </div>
            </div>
            <div className={styles.callTimerBadge}>
              <span className={styles.timerIcon}>⏱️</span>
              <div className={styles.timerText}>
                <span className={styles.timerMain}>{formatDuration(callDuration)}</span>
                <span className={styles.timerSub}>elapsed</span>
              </div>
            </div>
          </div>

          <div className={styles.profileInfo}>
            <div className={styles.profileAvatar}>
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <h2 className={styles.profileName}>{profile.name}</h2>
            <div className={styles.spinnerWrapper}>
              {callState === 'connecting' && <LoadingSpinner />}
            </div>
            <p className={styles.callStatus}>
              {getStatusText()}
            </p>
          </div>

          <div className={styles.callActions}>
            <button
              className={`${styles.actionButton} ${isMuted ? styles.muted : ''}`}
              onClick={handleToggleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
              disabled={callState !== 'active' || isDisconnecting}
            >
              {isMuted ? <IconMicrophoneOff size={32} /> : <IconMicrophone size={32} />}
            </button>

            <button
              className={`${styles.actionButton} ${styles.endCallButton}`}
              onClick={handleEndCall}
              aria-label="End Call"
              disabled={isDisconnecting}
            >
              <IconPhoneOff size={32} />
            </button>
          </div>
        </>
      )}

      {view === 'feedback' && (
        <CallFeedback
          profileName={profile.name}
          onSubmit={handleSubmitFeedback}
          onClose={handleCloseFeedback}
        />
      )}
    </div>
  );
};

export default AICallScreen;
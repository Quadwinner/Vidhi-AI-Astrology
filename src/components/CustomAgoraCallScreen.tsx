import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconPhoneOff, IconMicrophone, IconMicrophoneOff, IconChevronLeft, IconAlertCircle } from '@tabler/icons-react';
import { supabase } from '../supabaseClient';
import { EnrichedProfile } from './ProfileCard';
import { AgoraManager } from '../utils/AgoraManager';
import CallFeedback from './CallFeedback';
import './CustomAgoraCallScreen.css';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext'; // <--- 1. Import Pricing
import { trackEvent } from '../utils/analytics';

interface CustomAgoraCallScreenProps {
  profile: EnrichedProfile;
  onCallEnded: () => void;
}

const CustomAgoraCallScreen: React.FC<CustomAgoraCallScreenProps> = ({ profile, onCallEnded }) => {
  // <--- 2. Use New Auth Hooks
  const { walletBalance, updateWalletBalance, refreshUserStatusSilent } = useAuth();

  // <--- 3. Get Dynamic Cost
  const { prices, variant: monetizationVariant } = usePricing();
  const costPerMinute = prices['voice_call_minute'] || 0; // Minor units (e.g. 2000 for ₹20)

  const [callState, setCallState] = useState<'connecting' | 'active' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [showEndCallModal, setShowEndCallModal] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const callManagerRef = useRef<AgoraManager | null>(null);
  const callLogIdRef = useRef<string | null>(null);
  const durationIntervalRef = useRef<any>(null);
  const coinDeductionIntervalRef = useRef<any>(null);
  const callStartTimeRef = useRef<number>(Date.now());
  const hasEndedRef = useRef<boolean>(false);
  const initStartedRef = useRef<boolean>(false);

  const [permissionState, setPermissionState] = useState<'pending' | 'granted' | 'denied'>('pending');

  useEffect(() => {
    trackEvent('Custom Agora Call Screen Visited', {
      profile_id: profile.id,
      profile_name: profile.name
    });
  }, [profile.id, profile.name]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let isCancelled = false;

    const initializeAndStartCall = async () => {
      if (isCancelled || initStartedRef.current) return;
      initStartedRef.current = true;

      try {
        const { data: startData, error: startError } = await supabase.functions.invoke('start-call', {
          body: { profile_id: profile.id }
        });
        if (startError || startData?.error) {
          const msg = startError?.message || startData?.error || 'Failed to start call';
          // Friendlier copy for the common "not enough balance" case.
          const friendly = /insufficient|balance|fund/i.test(msg)
            ? 'You don’t have enough balance for a voice call. Please recharge and try again.'
            : msg;
          throw new Error(friendly);
        }
        callLogIdRef.current = startData.call_log_id;
        callStartTimeRef.current = Date.now();
        trackEvent('Voice Call Started', {
          provider: 'agora',
          profile_id: profile.id,
          call_log_id: startData.call_log_id
        });

        const { data, error: invokeError } = await supabase.functions.invoke('initiate-ai-call', {
          body: { profile_id: profile.id, provider: 'agora' }
        });

        if (invokeError) throw new Error(invokeError.context?.json?.error || invokeError.message);
        if (data?.error) {
          console.warn('[AgoraCallScreen] Server pre-call check failed:', data.error);
          throw new Error(data.error);
        }

        const { systemPrompt, gender } = data;
        if (!systemPrompt) throw new Error('Could not retrieve call configuration from server.');
        if (isCancelled) return;

        const manager = new AgoraManager();
        callManagerRef.current = manager;

        manager.onCallStarted = () => {
          trackEvent('AI Call Connected', {
            profile_id: profile.id,
            provider: 'agora'
          });
          if (isCancelled) return;
          setCallState('active');
          callStartTimeRef.current = Date.now();

          // --- 4. NEW DEDUCTION INTERVAL LOGIC ---
          if (!coinDeductionIntervalRef.current) {
            coinDeductionIntervalRef.current = setInterval(async () => {
              const callLogId = callLogIdRef.current;
              if (!callLogId) return;

              // A. OPTIMISTIC UPDATE (Instant UI Change)
              // Update local state immediately so user sees balance drop
              if (costPerMinute > 0) {
                updateWalletBalance((prev) => {
                  const current = prev ?? 0;
                  const next = current - costPerMinute;
                  return next < 0 ? 0 : next;
                });
              }

              try {
                // B. SERVER CALL (Actual Deduction)
                const { data, error } = await supabase.functions.invoke('deduct-call-coins', {
                  body: { call_log_id: callLogId, duration_seconds: 0, coins_deducted: 0 }
                });

                if (error) throw new Error(error.message);

                // C. SYNC (Correct drift)
                // The backend returns 'coin_balance' (legacy name, but contains wallet money)
                if (data.success && data.coin_balance !== undefined) {
                  updateWalletBalance(data.coin_balance);
                }

                // D. SILENT REFRESH (Ensure DB sync)
                // refreshUserStatusSilent();

                if (data?.should_end_call) handleCallEnd();

              } catch (err: any) {
                console.error('[AgoraCallScreen] CRITICAL ERROR during coin deduction:', err);
                handleCallEnd();
              }
            }, 60000); // Runs every 60 seconds
          }
          // ----------------------------------------

          if (!durationIntervalRef.current) {
            durationIntervalRef.current = setInterval(() => {
              setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
            }, 1000);
          }
        };

        manager.onError = (err) => {
          if (!isCancelled) {
            console.error('[AgoraCallScreen] Manager reported an error:', err);
            handleCallEnd();
          }
        };
        manager.onCallEnded = () => { if (!isCancelled) handleCallEnd(); };
        manager.onUserTranscript = (transcript) => { if (!isCancelled) setUserTranscript(transcript); };

        await manager.connectCall(systemPrompt, gender);
      } catch (err: any) {
        if (!isCancelled) {
          const message = err?.message || 'Failed to start the call.';
          console.error('[AgoraCallScreen] CRITICAL ERROR during initialization:', message);
          trackEvent('Voice Call Failed', {
            provider: 'agora',
            profile_id: profile.id,
            error: message
          });
          // Surface the real reason instead of silently closing.
          setErrorMessage(message);
          setCallState('error');
        }
      }
    };

    const startupSequence = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        if (isCancelled) return;
        setPermissionState('granted');
        initializeAndStartCall();
      } catch (err) {
        if (isCancelled) return;
        console.error("Microphone permission was denied.", err);
        setPermissionState('denied');
      }
    };

    startupSequence();

    return () => {
      isCancelled = true;
      initStartedRef.current = false;
      callManagerRef.current?.disconnectCall();
      if (coinDeductionIntervalRef.current) clearInterval(coinDeductionIntervalRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [profile.id, onCallEnded, updateWalletBalance, costPerMinute]); // Updated dependencies

  const handleCallEnd = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    setShowFeedback(true);

    if (coinDeductionIntervalRef.current) {
      clearInterval(coinDeductionIntervalRef.current);
      coinDeductionIntervalRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    const callLogId = callLogIdRef.current;
    if (callLogId) {
      const elapsedSeconds = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      trackEvent('Voice Call Ended', {
        profile_id: profile.id,
        duration_seconds: elapsedSeconds,
        provider: 'agora',
        call_log_id: callLogId
      });
      supabase.functions.invoke('end-call', {
        body: { call_log_id: callLogId, final_duration: elapsedSeconds, status: 'completed' }
      });
      callLogIdRef.current = null;
    }
    // Refresh one last time to ensure final balance is correct
    // refreshUserStatusSilent();
  };

  const handleEndCall = useCallback(async () => {
    if (isDisconnecting) return;
    setShowEndCallModal(true);
  }, [isDisconnecting]);

  const confirmEndCall = async () => {
    setIsDisconnecting(true);
    setShowEndCallModal(false);
    try {
      await callManagerRef.current?.disconnectCall();
    } catch (e) {
      handleCallEnd();
    }
  };

  const handleToggleMute = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    callManagerRef.current?.setMuted(newMutedState);
  }, [isMuted]);

  if (showFeedback) {
    return (
      <div className="custom-call-screen">
        <CallFeedback
          profileName={profile.name}
          onSubmit={async (rating, comments) => {
            try {
              await supabase.functions.invoke('submit-call-feedback', { body: { profile_id: profile.id, rating, comments } });
            } catch { }
            onCallEnded();
          }}
          onClose={onCallEnded}
        />
      </div>
    );
  }

  if (permissionState === 'denied') {
    return (
      <div className="custom-call-screen permission-denied-container">
        <div className="permission-denied-content">
          <IconAlertCircle size={50} strokeWidth={1.5} color="#FF4545" />
          <h3>Microphone Access Denied</h3>
          <p>Vidhi needs access to your microphone to start the call.</p>
          <p className="permission-instructions">
            Please enable microphone permissions for this site in your browser's settings and refresh the page.
          </p>
          <button className="end-btn-confirm" onClick={onCallEnded}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (callState === 'error') {
    return (
      <div className="custom-call-screen permission-denied-container">
        <div className="permission-denied-content">
          <IconAlertCircle size={50} strokeWidth={1.5} color="#FF4545" />
          <h3>Couldn’t start the call</h3>
          <p className="permission-instructions">
            {errorMessage || 'Something went wrong while starting your voice call. Please try again.'}
          </p>
          <button className="end-btn-confirm" onClick={onCallEnded}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="custom-call-screen">
      <div className="call-container">
        <div className="call-header">
          <button className="back-button" onClick={onCallEnded} title="Back">
            <IconChevronLeft size={28} strokeWidth={2} />
          </button>
          <div className="header-title">
            <h2>Aura AI</h2>
            <div className="voice-active-status">
              <span className="status-dot"></span>
              <span>Voice Active</span>
            </div>
          </div>
          <div className="call-timer-badge">
            <span className="timer-icon">⏱️</span>
            <div className="timer-text">
              <span className="timer-main">{formatDuration(callDuration)}</span>
              <span className="timer-sub">elapsed</span>
            </div>
          </div>
        </div>

        <div className="main-content">
          <div className="voice-chat-title">
            <h3>Ask Your Question</h3>
            <p>Your Destiny, Decoded by AURA AI</p>
          </div>

          <div className="mic-button-container">
            <div className="mic-ring-outer">
              <div className="mic-ring-mid">
                <div className="mic-ring-inner">
                  <button className="mic-button-main" disabled>
                    {isMuted ? (
                      <IconMicrophoneOff className="mic-icon" />
                    ) : (
                      <IconMicrophone className="mic-icon" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="mic-dot pink-dot"></div>
            <div className="mic-dot orange-dot"></div>
            <div className="mic-dot purple-dot"></div>
            <div className="mic-dot blue-dot"></div>
          </div>

          <div className="listening-status">
            <div className="listening-indicator">
              <div className="listening-content">
                <div className="listening-dot"></div>
                <p>{userTranscript || (permissionState === 'pending' ? 'Requesting mic permission...' : callState === 'connecting' ? 'Connecting...' : 'Listening...')}</p>
              </div>
            </div>
            <p className="listening-hint">Speak naturally, I'm here to help</p>
          </div>
        </div>

        <div className="call-controls">
          <button
            className="control-button mute-button"
            onClick={handleToggleMute}
            disabled={callState !== 'active'}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <IconMicrophoneOff size={24} /> : <IconMicrophone size={24} />}
          </button>

          <button
            className="control-button end-call-button"
            onClick={handleEndCall}
            disabled={isDisconnecting}
            title="End Call"
          >
            <IconPhoneOff size={28} />
          </button>
        </div>
      </div>

      {showEndCallModal && (
        <div className="end-call-modal">
          <div className="end-modal-content">
            <h3 className="end-modal-title">End Call?</h3>
            <p className="end-modal-sub">Are you sure you want to end this call?</p>
            <div className="call-duration-info">Call Duration: {formatDuration(callDuration)}</div>
            <div className="end-modal-actions">
              <button className="end-btn-cancel" onClick={() => setShowEndCallModal(false)}>Cancel</button>
              <button className="end-btn-confirm" onClick={confirmEndCall}>End Call</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomAgoraCallScreen;
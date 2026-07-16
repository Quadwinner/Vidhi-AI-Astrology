import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconPhoneOff, IconMicrophone, IconMicrophoneOff, IconChevronLeft, IconAlertCircle } from '@tabler/icons-react';
import { supabase } from '../supabaseClient';
import { EnrichedProfile } from './ProfileCard';
import { UltravoxCallManager } from '../utils/UltravoxCallManager';
import CallFeedback from './CallFeedback';
import './CustomAgoraCallScreen.css';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext';
import { trackEvent } from '../utils/analytics';

interface UltravoxCallScreenProps {
  profile: EnrichedProfile;
  onCallEnded: () => void;
}

const UltravoxCallScreen: React.FC<UltravoxCallScreenProps> = ({ profile, onCallEnded }) => {
  const { walletBalance, updateWalletBalance } = useAuth() as any;
  const { prices, variant: monetizationVariant } = usePricing() as any;
  const costPerMinute = prices['voice_call_minute'] || 0;

  const [callState, setCallState] = useState<'connecting' | 'active' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [showEndCallModal, setShowEndCallModal] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [permissionState, setPermissionState] = useState<'pending' | 'granted' | 'denied'>('pending');

  const callManagerRef = useRef<UltravoxCallManager | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const callLogIdRef = useRef<string | null>(null);
  const durationIntervalRef = useRef<any>(null);
  const coinDeductionIntervalRef = useRef<any>(null);
  const callStartTimeRef = useRef<number>(Date.now());
  const hasEndedRef = useRef<boolean>(false);
  const initStartedRef = useRef<boolean>(false);
  const wakeLockRef = useRef<any>(null);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Keep the caption scrolled to the latest text as it streams in.
  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [userTranscript]);

  const handleCallEnd = useCallback(() => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    setShowFeedback(true);
    if (coinDeductionIntervalRef.current) { clearInterval(coinDeductionIntervalRef.current); coinDeductionIntervalRef.current = null; }
    if (durationIntervalRef.current) { clearInterval(durationIntervalRef.current); durationIntervalRef.current = null; }
    const callLogId = callLogIdRef.current;
    if (callLogId) {
      const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      trackEvent('Voice Call Ended', { profile_id: profile.id, duration_seconds: elapsed, provider: 'ultravox', call_log_id: callLogId });
      supabase.functions.invoke('end-call', { body: { call_log_id: callLogId, final_duration: elapsed, status: 'completed' } });
      callLogIdRef.current = null;
    }
  }, [profile.id]);

  useEffect(() => {
    let isCancelled = false;

    const initializeAndStartCall = async () => {
      if (isCancelled || initStartedRef.current) return;
      initStartedRef.current = true;

      try {
        // 1. Wallet / price check + call log
        const { data: startData, error: startError } = await supabase.functions.invoke('start-call', {
          body: { profile_id: profile.id }
        });
        if (startError || startData?.error) {
          const msg = startError?.message || startData?.error || 'Failed to start call';
          throw new Error(/insufficient|balance|fund/i.test(msg)
            ? 'You don’t have enough balance for a voice call. Please recharge and try again.'
            : msg);
        }
        callLogIdRef.current = startData.call_log_id;
        callStartTimeRef.current = Date.now();
        trackEvent('Voice Call Started', { provider: 'ultravox', profile_id: profile.id, call_log_id: startData.call_log_id });

        // 2. Create the Ultravox call (returns joinUrl). Use the configured
        // agent so its voice + persona are used.
        const { data, error: invokeError } = await supabase.functions.invoke('create-ultravox-call', {
          body: { profile_id: profile.id, agentId: process.env.REACT_APP_ULTRAVOX_AGENT_ID }
        });
        if (invokeError) throw new Error(invokeError.message);
        if (data?.error) throw new Error(data.error);
        if (!data?.joinUrl) throw new Error('Could not retrieve call configuration from server.');
        if (isCancelled) return;

        // 3. Join the call
        const manager = new UltravoxCallManager();
        callManagerRef.current = manager;

        manager.onCallStarted = () => {
          if (isCancelled) return;
          trackEvent('AI Call Connected', { profile_id: profile.id, provider: 'ultravox' });
          setCallState('active');
          callStartTimeRef.current = Date.now();

          if (!coinDeductionIntervalRef.current) {
            coinDeductionIntervalRef.current = setInterval(async () => {
              const callLogId = callLogIdRef.current;
              if (!callLogId) return;
              if (costPerMinute > 0) {
                updateWalletBalance((prev: number | null) => {
                  const current = prev ?? 0;
                  const next = current - costPerMinute;
                  return next < 0 ? 0 : next;
                });
              }
              try {
                const { data, error } = await supabase.functions.invoke('deduct-call-coins', {
                  body: { call_log_id: callLogId, duration_seconds: 0, coins_deducted: 0 }
                });
                if (error) throw new Error(error.message);
                if (data?.success && data.coin_balance !== undefined) updateWalletBalance(data.coin_balance);
                if (data?.should_end_call) confirmEndCall();
              } catch (err: any) {
                console.error('[UltravoxCallScreen] coin deduction error:', err);
                confirmEndCall();
              }
            }, 60000);
          }

          if (!durationIntervalRef.current) {
            durationIntervalRef.current = setInterval(() => {
              setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
            }, 1000);
          }
        };

        manager.onError = (err: string) => { if (!isCancelled) { console.error('[UltravoxCallScreen] manager error:', err); handleCallEnd(); } };
        manager.onCallEnded = () => { if (!isCancelled) handleCallEnd(); };
        manager.onUserTranscript = (t: string) => { if (!isCancelled) setUserTranscript(t); };

        await manager.connectCall(data.joinUrl);
      } catch (err: any) {
        if (!isCancelled) {
          const message = err?.message || 'Failed to start the call.';
          console.error('[UltravoxCallScreen] init error:', message);
          trackEvent('Voice Call Failed', { provider: 'ultravox', profile_id: profile.id, error: message });
          setErrorMessage(message);
          setCallState('error');
        }
      }
    };

    const startupSequence = async () => {
      try {
        // Only probe for mic permission — then immediately release the tracks.
        // If we keep this stream open, the Ultravox SDK opens the mic a second
        // time; mobile browsers (esp. iOS) can't hold the mic twice and drop the
        // audio session, ending the call right after the intro.
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
        probe.getTracks().forEach((t) => t.stop());
        if (isCancelled) return;
        setPermissionState('granted');
        initializeAndStartCall();
      } catch (err) {
        if (isCancelled) return;
        console.error('Microphone permission was denied.', err);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  // Mobile fix: keep the screen awake during an active call. On phones the
  // browser suspends/throttles the page a few seconds after the screen dims,
  // which tears down the WebRTC audio session and the call drops right after
  // the intro (endReason "hangup"). A Screen Wake Lock keeps the page alive;
  // it must be re-acquired whenever the page becomes visible again.
  useEffect(() => {
    if (callState !== 'active') return;

    let released = false;

    const acquire = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current?.addEventListener?.('release', () => { wakeLockRef.current = null; });
        }
      } catch (e) {
        console.warn('[UltravoxCallScreen] wakeLock request failed:', e);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !released) acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibility);
      try { wakeLockRef.current?.release?.(); } catch { /* noop */ }
      wakeLockRef.current = null;
    };
  }, [callState]);

  const confirmEndCall = async () => {
    setIsDisconnecting(true);
    setShowEndCallModal(false);
    try {
      await callManagerRef.current?.disconnectCall();
    } catch {
      handleCallEnd();
    }
  };

  const handleEndCall = useCallback(() => {
    if (isDisconnecting) return;
    setShowEndCallModal(true);
  }, [isDisconnecting]);

  const handleToggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    callManagerRef.current?.setMuted(next);
  }, [isMuted]);

  if (showFeedback) {
    return (
      <div className="custom-call-screen">
        <CallFeedback
          profileName={profile.name}
          onSubmit={async (rating, comments) => {
            try { await supabase.functions.invoke('submit-call-feedback', { body: { profile_id: profile.id, rating, comments } }); } catch { }
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
          <p className="permission-instructions">Please enable microphone permissions for this site in your browser's settings and refresh the page.</p>
          <button className="end-btn-confirm" onClick={onCallEnded}>Go Back</button>
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
          <p className="permission-instructions">{errorMessage || 'Something went wrong while starting your voice call. Please try again.'}</p>
          <button className="end-btn-confirm" onClick={onCallEnded}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="custom-call-screen">
      <div className="call-container">
        <div className="call-header">
          <button className="back-button" onClick={onCallEnded} title="Back"><IconChevronLeft size={28} strokeWidth={2} /></button>
          <div className="header-title">
            <h2>Vidhi AI</h2>
            <div className="voice-active-status"><span className="status-dot"></span><span>Voice Active</span></div>
          </div>
          <div className="call-timer-badge">
            <span className="timer-icon">⏱️</span>
            <div className="timer-text"><span className="timer-main">{formatDuration(callDuration)}</span><span className="timer-sub">elapsed</span></div>
          </div>
        </div>

        <div className="main-content">
          <div className="voice-chat-title">
            <h3>Ask Your Question</h3>
            <p>Your Destiny, Decoded by Vidhi AI</p>
          </div>

          <div className="mic-button-container">
            <div className="mic-ring-outer"><div className="mic-ring-mid"><div className="mic-ring-inner">
              <button className="mic-button-main" disabled>
                {isMuted ? <IconMicrophoneOff className="mic-icon" /> : <IconMicrophone className="mic-icon" />}
              </button>
            </div></div></div>
            <div className="mic-dot pink-dot"></div>
            <div className="mic-dot orange-dot"></div>
            <div className="mic-dot purple-dot"></div>
            <div className="mic-dot blue-dot"></div>
          </div>

          <div className="listening-status">
            <div
              ref={transcriptRef}
              className="listening-indicator"
              style={{ maxHeight: 96, overflowY: 'auto', alignItems: 'flex-start' }}
            >
              <div className="listening-content" style={{ alignItems: 'flex-start' }}>
                <div className="listening-dot" style={{ marginTop: 6, flexShrink: 0 }}></div>
                <p style={{ margin: 0, textAlign: 'left', lineHeight: 1.5 }}>
                  {userTranscript || (permissionState === 'pending' ? 'Requesting mic permission...' : callState === 'connecting' ? 'Connecting...' : 'Listening...')}
                </p>
              </div>
            </div>
            <p className="listening-hint">Speak naturally, I'm here to help</p>
          </div>
        </div>

        <div className="call-controls">
          <button className="control-button mute-button" onClick={handleToggleMute} disabled={callState !== 'active'} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <IconMicrophoneOff size={24} /> : <IconMicrophone size={24} />}
          </button>
          <button className="control-button end-call-button" onClick={handleEndCall} title="End call">
            <IconPhoneOff size={24} />
          </button>
        </div>
      </div>

      {showEndCallModal && (
        <div className="end-call-modal" onClick={() => setShowEndCallModal(false)}>
          <div className="end-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="end-modal-title">End this call?</div>
            <div className="end-modal-sub">Your conversation with Vidhi AI will end.</div>
            <div className="call-duration-info">Duration: {formatDuration(callDuration)}</div>
            <div className="end-modal-actions">
              <button className="end-btn-cancel" onClick={() => setShowEndCallModal(false)} disabled={isDisconnecting}>Cancel</button>
              <button className="end-btn-confirm" onClick={confirmEndCall} disabled={isDisconnecting}>{isDisconnecting ? 'Ending…' : 'End Call'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UltravoxCallScreen;

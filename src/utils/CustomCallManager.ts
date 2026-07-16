// Custom Call Manager - Alternative to Agora
import { supabase } from '../supabaseClient';

interface CallConfig {
  systemPrompt: string;
  gender: string;
  useCustomTTS: boolean;
  profileId?: string;
}

export class CustomCallManager {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private microphone: MediaStream | null = null;
  private isRecording = false;
  private callActive = false;
  private config: CallConfig | null = null;
  private isMuted = false; // Track mute state

  // Audio playback tracking
  private currentAudio: HTMLAudioElement | null = null;
  private isPlayingAudio = false;
  private lastAudioEndTime = 0; // Track when AI audio last finished

  // Volume detection for speech
  private analyser: AnalyserNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  // Hallucination detection
  private lastTranscript: string = '';
  private sameTranscriptCount = 0;

  // Callbacks
  public onCallStarted: () => void = () => {};
  public onCallEnded: () => void = () => {};
  public onError: (error: string) => void = () => {};
  public onUserTranscript: (transcript: string) => void = () => {};
  public onAiResponse: (response: string) => void = () => {};
  public onMuteStateChanged: (isMuted: boolean) => void = () => {};

  constructor() {
    console.log('[CustomCallManager] Initialized');
  }

  async startCall(config: CallConfig): Promise<void> {
    try {
      console.log('[CustomCallManager] Starting call...');

      // Store config for later use
      this.config = config;

      // Request microphone access with better audio quality settings
      this.microphone = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000, // Higher quality audio for better transcription
          channelCount: 1
        }
      });

      // Initialize audio context
      this.audioContext = new AudioContext();

      // Set up audio analyser for volume detection during recording
      this.setupAudioAnalyser();

      // Start the call
      this.callActive = true;
      this.onCallStarted();

      // Begin conversation loop
      this.startConversationLoop(config);

    } catch (error: any) {
      console.error('[CustomCallManager] Error starting call:', error);
      this.onError(error.message || 'Failed to start call');
    }
  }

  private async startConversationLoop(config: CallConfig): Promise<void> {
    if (!this.callActive) return;

    try {
      // Send initial greeting FIRST
      const greeting = "नमस्ते जी! मैं आपकी कुंडली के बारे में बात करने के लिए यहाँ हूँ। आप क्या जानना चाहते हैं?";
      await this.speakText(greeting, config.useCustomTTS);

      // THEN start listening for user input after greeting finishes
      await this.startListening();

    } catch (error: any) {
      console.error('[CustomCallManager] Conversation loop error:', error);
      this.onError(error.message || 'Conversation error');
    }
  }

  private async startListening(): Promise<void> {
    if (!this.microphone) return;

    // Don't start recording if muted
    if (this.isMuted) {
      console.log('[CustomCallManager] Microphone is muted, not starting recording');
      return;
    }

    // Don't start new recording if already recording
    if (this.isRecording) {
      console.log('[CustomCallManager] Already recording, skipping...');
      return;
    }

    // Guard period: Don't record for 800ms after AI finishes speaking
    // This prevents microphone from picking up echo/reverb from AI's voice
    const timeSinceAudioEnded = Date.now() - this.lastAudioEndTime;
    const GUARD_PERIOD_MS = 800;

    if (timeSinceAudioEnded < GUARD_PERIOD_MS) {
      const remainingWait = GUARD_PERIOD_MS - timeSinceAudioEnded;
      console.log('[CustomCallManager] Guard period: waiting', remainingWait, 'ms before listening (prevent echo)');

      setTimeout(() => {
        if (this.callActive && !this.isMuted) {
          this.startListening();
        }
      }, remainingWait);
      return;
    }

    try {
      // Create media recorder
      this.mediaRecorder = new MediaRecorder(this.microphone, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const audioChunks: Blob[] = [];
      let maxVolumeDetected = 0; // Track peak volume during recording

      // Monitor volume during recording to detect actual speech
      const volumeCheckInterval = setInterval(() => {
        if (!this.analyser || !this.isRecording) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / bufferLength;

        if (average > maxVolumeDetected) {
          maxVolumeDetected = average;
        }
      }, 100);

      this.mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        clearInterval(volumeCheckInterval);

        // Check if call is still active - if user ended call during recording, don't process
        if (!this.callActive) {
          console.log('[CustomCallManager] ⛔ Call ended during recording, discarding audio');
          return;
        }

        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

        // Check if user actually spoke (volume threshold)
        // Ambient noise: 10-35
        // Real user speech: 50+
        const SPEECH_VOLUME_THRESHOLD = 45;

        console.log('[CustomCallManager] Recording finished. Max volume:', maxVolumeDetected.toFixed(2), 'Threshold:', SPEECH_VOLUME_THRESHOLD);

        if (maxVolumeDetected < SPEECH_VOLUME_THRESHOLD) {
          console.log('[CustomCallManager] ❌ No speech detected (volume too low), skipping transcription');
          // Continue listening without transcribing
          if (this.callActive) {
            this.startListening();
          }
          return;
        }

        console.log('[CustomCallManager] ✅ Speech detected (volume sufficient), processing audio');
        await this.processAudio(audioBlob);
      };

      // Start recording
      this.mediaRecorder.start();
      this.isRecording = true;

      console.log('[CustomCallManager] Started listening...');

      // Auto-stop after 3 seconds to trigger transcription (faster responsiveness)
      setTimeout(() => {
        if (this.isRecording) {
          console.log('[CustomCallManager] Auto-stopping recording after 3s');
          this.stopListening();
        }
      }, 3000);

    } catch (error: any) {
      console.error('[CustomCallManager] Error starting listening:', error);
      this.onError(error.message || 'Failed to start listening');
    }
  }

  async stopListening(): Promise<void> {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      console.log('[CustomCallManager] Stopped listening...');
    }
  }

  /**
   * Mute the microphone - stops listening and prevents auto-restart
   */
  public mute(): void {
    console.log('[CustomCallManager] Muting microphone');
    this.isMuted = true;

    // Stop any ongoing recording
    if (this.isRecording) {
      this.stopListening();
    }

    this.onMuteStateChanged(true);
  }

  /**
   * Unmute the microphone - resumes listening
   */
  public unmute(): void {
    console.log('[CustomCallManager] Unmuting microphone');
    this.isMuted = false;

    // Resume listening if call is active and not currently recording
    if (this.callActive && !this.isRecording && !this.isPlayingAudio) {
      this.startListening();
    }

    this.onMuteStateChanged(false);
  }

  /**
   * Toggle mute state
   */
  public toggleMute(): void {
    if (this.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
  }

  /**
   * Get current mute state
   */
  public getMuteState(): boolean {
    return this.isMuted;
  }

  private async processAudio(audioBlob: Blob): Promise<void> {
    try {
      // Double-check call is still active
      if (!this.callActive) {
        console.log('[CustomCallManager] ⛔ Call ended before processing audio');
        return;
      }

      console.log('[CustomCallManager] Processing audio blob, size:', audioBlob.size, 'bytes');

      // Skip if audio blob is too small (likely complete silence)
      // Lowered threshold since we now use volume detection
      if (audioBlob.size < 5000) {
        console.log('[CustomCallManager] Audio too small (<5KB), skipping transcription - complete silence');
        // Continue listening for next input
        if (this.callActive) {
          this.startListening();
        }
        return;
      }

      // Create FormData with the audio file (transcribe-audio expects FormData)
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      // Send to transcription service using fetch (not supabase.functions.invoke)
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data?.error) throw new Error(data.error);

      // Check if call is still active after async transcription
      if (!this.callActive) {
        console.log('[CustomCallManager] ⛔ Call ended during transcription, discarding result');
        return;
      }

      const transcript = data.text?.trim() || ''; // Note: transcribe-audio returns 'text', not 'transcript'

      if (!transcript) {
        console.log('[CustomCallManager] Empty transcript, continuing to listen');
        // Continue listening for next input if transcript is empty
        if (this.callActive) {
          this.startListening();
        }
        return;
      }

      // Common Whisper hallucinations for Hindi silence/noise
      const KNOWN_HALLUCINATIONS = [
        'करियर के बारे में बताइए।',
        'करियर के बारे में बताइए',
        'धन्यवाद।',
        'धन्यवाद',
        'नमस्ते।',
        'नमस्ते',
      ];

      // Detect Whisper hallucination: same transcript repeating (likely silence being transcribed)
      if (transcript === this.lastTranscript && this.lastTranscript !== '') {
        this.sameTranscriptCount++;
        console.warn('[CustomCallManager] ⚠️ Same transcript repeated:', this.sameTranscriptCount, 'times -', transcript);

        // Block immediately if it's a known hallucination phrase
        if (KNOWN_HALLUCINATIONS.includes(transcript) && this.sameTranscriptCount >= 2) {
          console.error('[CustomCallManager] 🚫 Known Whisper hallucination blocked:', transcript);
          // Keep tracking (don't reset) so it stays blocked
          if (this.callActive) {
            this.startListening();
          }
          return;
        }

        // For other phrases, require 3 repeats before blocking (more lenient)
        if (this.sameTranscriptCount >= 3) {
          console.error('[CustomCallManager] 🚫 Repeated transcript blocked (likely hallucination):', transcript);
          // Keep tracking (don't reset) so it stays blocked
          if (this.callActive) {
            this.startListening();
          }
          return;
        }
      } else {
        // Different transcript, reset counter
        if (this.lastTranscript !== transcript) {
          console.log('[CustomCallManager] ✓ New transcript detected, resetting hallucination counter');
        }
        this.sameTranscriptCount = 1;
      }

      // Update lastTranscript for next comparison
      this.lastTranscript = transcript;
      console.log('[CustomCallManager] User said:', transcript);
      this.onUserTranscript(transcript);

      // Get AI response
      await this.getAiResponse(transcript);

    } catch (error: any) {
      console.error('[CustomCallManager] Error processing audio:', error);
      this.onError(error.message || 'Failed to process audio');
    }
  }

  private async getAiResponse(userInput: string): Promise<void> {
    try {
      // Check if call is still active before processing
      if (!this.callActive) {
        console.log('[CustomCallManager] Call ended, skipping AI response');
        return;
      }

      console.log('[CustomCallManager] Getting AI response...');

      if (!this.config?.profileId) {
        throw new Error('Profile ID not found. Cannot get AI response.');
      }

      // Get current user session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session. Please log in.');
      }

      console.log('[CustomCallManager] Calling simple-call-ai with:', {
        profile_id: this.config.profileId,
        user_message: userInput
      });

      // Use simple-call-ai for AI responses
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/simple-call-ai`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profile_id: this.config.profileId,
            user_message: userInput
          }),
        }
      );

      console.log('[CustomCallManager] simple-call-ai response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[CustomCallManager] simple-call-ai error response:', errorText);
        throw new Error(`AI response failed: ${response.status} - ${errorText}`);
      }

      // Parse JSON response from simple-call-ai
      const data = await response.json();
      const aiResponse = data.response;
      console.log('[CustomCallManager] Raw AI response:', aiResponse);
      console.log('[CustomCallManager] AI response length:', aiResponse?.length);

      if (!aiResponse || aiResponse.trim().length === 0) {
        throw new Error('Empty response from AI. Please try again.');
      }

      if (aiResponse) {
        // Check again if call is still active
        if (!this.callActive) {
          console.log('[CustomCallManager] Call ended during AI response, stopping');
          return;
        }

        console.log('[CustomCallManager] Processing AI response...');

        // Keep responses short for natural conversation (max 300 chars)
        let trimmedResponse = aiResponse.trim();
        if (trimmedResponse.length > 300) {
          // Cut at sentence boundary (Hindi sentences end with '।')
          const sentences = trimmedResponse.split('।');
          // Take first 1-2 sentences to stay within 300 chars
          let result = '';
          for (const sentence of sentences) {
            if ((result + sentence + '।').length <= 300) {
              result += sentence + '।';
            } else {
              break;
            }
          }
          trimmedResponse = result || sentences[0] + '।';
          console.log('[CustomCallManager] Trimmed long response to:', trimmedResponse.length, 'chars');
        }

        this.onAiResponse(trimmedResponse);

        // Speak the response only if call is still active
        if (this.callActive) {
          try {
            await this.speakText(trimmedResponse, true);
            // After successful AI response, reduce hallucination counter
            // This allows one "free pass" per conversation turn
            // Prevents permanent blocking while still catching rapid repeats
            if (this.sameTranscriptCount > 1) {
              this.sameTranscriptCount--;
              console.log('[CustomCallManager] Reduced hallucination counter to', this.sameTranscriptCount, 'after AI response');
            }
          } catch (ttsError) {
            console.error('[CustomCallManager] TTS failed, continuing anyway:', ttsError);
          }
        }

        // Continue listening for next input immediately only if call is still active
        if (this.callActive) {
          this.startListening();
        }
      }

    } catch (error: any) {
      console.error('[CustomCallManager] Error getting AI response:', error);
      this.onError(error.message || 'Failed to get AI response');
    }
  }

  private async speakText(text: string, useCustomTTS: boolean): Promise<void> {
    try {
      console.log('[CustomCallManager] Speaking text:', text);

      let audioUrl: string;

      if (useCustomTTS) {
        try {
          // Try custom F5-Hindi TTS first - returns binary audio
          console.log('[CustomCallManager] Calling custom-tts-proxy...');
          console.log('[CustomCallManager] Text length:', text.length);

          // Add browser-side timeout (70 seconds) for longer text generation
          // F5-TTS can take 30-50 seconds for 500+ character Hindi text on GPU
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            console.error('[CustomCallManager] TTS request timed out after 70s');
            controller.abort();
          }, 70000);

          const response = await fetch(
            `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/custom-tts-proxy`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text: text }),
              signal: controller.signal,
            }
          );

          clearTimeout(timeoutId);

          console.log('[CustomCallManager] custom-tts-proxy response status:', response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[CustomCallManager] custom-tts-proxy error:', errorText);
            throw new Error(`TTS failed: ${response.status} - ${errorText}`);
          }

          console.log('[CustomCallManager] Getting audio blob...');
          // Get binary audio and create object URL
          const audioBlob = await response.blob();
          console.log('[CustomCallManager] Audio blob size:', audioBlob.size, 'bytes');
          audioUrl = URL.createObjectURL(audioBlob);
          console.log('[CustomCallManager] Using F5-Hindi TTS, audio URL created');
        } catch (customError: any) {
          // Fallback to Microsoft TTS if custom fails
          console.error('[CustomCallManager] F5-Hindi TTS FAILED:', customError);
          console.warn('[CustomCallManager] Falling back to Microsoft TTS:', customError.message);

          const { data, error } = await supabase.functions.invoke('generate-tts', {
            body: { text: text }
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          audioUrl = data.audioUrl;
          console.log('[CustomCallManager] Using Microsoft TTS fallback');
        }
      } else {
        // Use Microsoft TTS
        const { data, error } = await supabase.functions.invoke('generate-tts', {
          body: { text: text }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        audioUrl = data.audioUrl;
        console.log('[CustomCallManager] Using Microsoft TTS');
      }

      // Play the audio
      await this.playAudio(audioUrl);

      // Clean up object URL if it was created
      if (audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }

    } catch (error: any) {
      console.error('[CustomCallManager] Error speaking text:', error);
      this.onError(error.message || 'Failed to speak text');
    }
  }

  /**
   * Set up audio analyser for volume detection during recording
   */
  private setupAudioAnalyser(): void {
    if (!this.audioContext || !this.microphone) return;

    try {
      // Create analyser node for volume detection
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect microphone to analyser
      this.micSource = this.audioContext.createMediaStreamSource(this.microphone);
      this.micSource.connect(this.analyser);

      console.log('[CustomCallManager] Audio analyser set up for volume detection');
    } catch (error) {
      console.error('[CustomCallManager] Failed to setup audio analyser:', error);
    }
  }

  private async playAudio(audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      this.isPlayingAudio = true;

      audio.onended = () => {
        console.log('[CustomCallManager] Audio playback completed');

        this.isPlayingAudio = false;
        this.currentAudio = null;

        // Mark when audio finished for guard period
        this.lastAudioEndTime = Date.now();
        console.log('[CustomCallManager] Guard period activated (800ms) to prevent echo');

        resolve();
      };

      audio.onerror = (error) => {
        console.error('[CustomCallManager] Audio playback error:', error);
        this.isPlayingAudio = false;
        this.currentAudio = null;
        this.lastAudioEndTime = Date.now(); // Set guard period even on error
        reject(error);
      };

      audio.play().catch((err) => {
        console.error('[CustomCallManager] Audio play error:', err);
        this.isPlayingAudio = false;
        this.currentAudio = null;
        this.lastAudioEndTime = Date.now(); // Set guard period even on error
        reject(err);
      });
    });
  }

  async endCall(): Promise<void> {
    console.log('[CustomCallManager] Ending call...');

    this.callActive = false;

    // Stop any ongoing audio playback
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    // Reset state
    this.isPlayingAudio = false;
    this.lastTranscript = '';
    this.sameTranscriptCount = 0;
    this.lastAudioEndTime = 0;

    // Stop recording
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }

    // Disconnect analyser
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    this.analyser = null;

    // Stop microphone
    if (this.microphone) {
      this.microphone.getTracks().forEach(track => track.stop());
      this.microphone = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch (e) {
        console.warn('[CustomCallManager] AudioContext already closed');
      }
      this.audioContext = null;
    }

    this.onCallEnded();
    console.log('[CustomCallManager] Call ended');
  }

  cleanup(): void {
    this.endCall();
  }
}

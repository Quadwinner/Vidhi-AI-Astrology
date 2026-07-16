// File: src/utils/GeminiLiveManager.ts
// --- V3.7: INTERRUPTION HANDLING (VAD FIX) ---

import { GoogleGenAI, Modality, type LiveSession } from '@google/genai';

// --- HELPER FUNCTIONS (Unchanged) ---
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

type InteractionState = 'idle' | 'listening' | 'processing' | 'speaking';

export class GeminiLiveManager {
  public onStateChange: (state: InteractionState) => void = () => { };
  public onCallStarted: () => void = () => { };
  public onError: (error: string) => void = () => { };
  public onCallEnded: (reason: string) => void = () => { };

  // --- Private State ---
  private audioContext: AudioContext | null = null;
  private microphoneStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isMuted = false;

  // --- Audio Playback State ---
  private audioQueue: ArrayBuffer[] = [];
  private playbackScheduleId: any = null;
  private nextPlayTime = 0;
  private readonly PLAYBACK_INTERVAL_MS = 100;

  // --- VAD/INTERRUPTION FIX: Keep track of active audio sources to stop them.
  private activeAudioSources: AudioBufferSourceNode[] = [];

  // --- Gemini Live API State ---
  private session: LiveSession | null = null;
  private systemPrompt = '';
  private token = '';
  private sessionResumptionHandle: string | null = null;

  public async connectCall(systemPrompt: string, token: string) {
    this.systemPrompt = systemPrompt;
    this.token = token;

    try {
      const ai = new GoogleGenAI({
        apiKey: this.token,
        httpOptions: { apiVersion: 'v1alpha' },
      });

      this.session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: this.systemPrompt,
          enableAffectiveDialog: true,
          sessionResumption: this.sessionResumptionHandle ? { handle: this.sessionResumptionHandle } : {},

          // --- FIX: Explicitly request the user's audio transcription ---
          // This will be our reliable signal for the "thinking" state.
          inputAudioTranscription: {},

          // This VAD config is still correct and necessary for interruption
          realtimeInputConfig: {
            automaticActivityDetection: {
              silenceDurationMs: 800,
              prefixPaddingMs: 100,
            }
          }
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live session opened.');
            this.onCallStarted();
            this.onStateChange('listening');
          },
          onmessage: (message) => {
            // --- REVISED AND FINAL STATE LOGIC ---

            // To bypass the TypeScript error, we cast serverContent to 'any'
            const serverContent = (message as any).serverContent;

            // 1. AI starts speaking.
            if (message.data) {
              this.onStateChange('speaking');
              this.audioQueue.push(base64ToBuffer(message.data));
            }

            if (serverContent) {
              // 2. User has finished speaking and server has transcribed it. THIS IS OUR "THINKING" TRIGGER.
              if (serverContent.inputTranscription) {
                console.log(`User said: "${serverContent.inputTranscription.text}"`);
                this.onStateChange('processing');
              }

              // 3. AI's turn is complete.
              if (serverContent.turnComplete) {
                this.onStateChange('listening');
              }

              // 4. User interrupts AI.
              if (serverContent.interrupted) {
                console.log("AI generation was interrupted by the user.");
                this._clearPlaybackQueue();
                this.onStateChange('listening');
              }
            }
            if (message.sessionResumptionUpdate?.newHandle) {
              this.sessionResumptionHandle = message.sessionResumptionUpdate.newHandle;
            }
          },
          onerror: (e: any) => {
            const errorMessage = e.message || 'An unknown error occurred.';
            console.error('Gemini Live Error:', errorMessage);
            this.onError(errorMessage);
            if (this.session) this.disconnectCall("Session error");
          },
          onclose: (e: any) => {
            console.log('Gemini Live session closed:', e.reason);
            if (this.session) this.disconnectCall("Session closed by server");
          },
        },
      });

      await this._setupAudioPipeline();
      this._startPlaybackScheduler();

    } catch (err: any) {
      const errorMessage = `Failed to connect to Gemini Live: ${err.message}`;
      console.error(errorMessage);
      this.onError(errorMessage);
    }
  }

  private async _setupAudioPipeline() {
    try {
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      this.nextPlayTime = this.audioContext.currentTime;
      await this.audioContext.audioWorklet.addModule('/audio-processor.js');
      const source = this.audioContext.createMediaStreamSource(this.microphoneStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-resampler-processor', {
        processorOptions: {
          sourceSampleRate: this.audioContext.sampleRate,
        },
      });
      this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (this.isMuted || !this.session) return;
        this.session.sendRealtimeInput({
          audio: { data: bufferToBase64(event.data), mimeType: "audio/pcm;rate=16000" }
        });
      };
      source.connect(this.workletNode);
    } catch (err: any) {
      this.onError(`Audio Pipeline Error: ${err.message}`);
      throw err;
    }
  }

  private _startPlaybackScheduler() {
    if (this.playbackScheduleId) clearInterval(this.playbackScheduleId);
    this.playbackScheduleId = setInterval(() => {
      this._schedulePlayback();
    }, this.PLAYBACK_INTERVAL_MS);
  }

  private _schedulePlayback() {
    if (this.audioQueue.length === 0 || !this.audioContext) return;
    if (this.audioContext.state === 'suspended') this.audioContext.resume();

    const chunksToPlay = this.audioQueue.splice(0, this.audioQueue.length);
    const totalLength = chunksToPlay.reduce((acc, chunk) => acc + chunk.byteLength, 0);
    const combinedBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunksToPlay) {
      combinedBuffer.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    const pcm16Data = new Int16Array(combinedBuffer.buffer);
    const frameCount = pcm16Data.length;
    if (frameCount === 0) return;

    const audioBuffer = this.audioContext.createBuffer(1, frameCount, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = pcm16Data[i] / 32768.0;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const scheduledPlayTime = Math.max(this.nextPlayTime, this.audioContext.currentTime);
    source.start(scheduledPlayTime);

    // --- VAD/INTERRUPTION FIX: Track the source so we can stop it.
    this.activeAudioSources.push(source);
    source.onended = () => {
      // Remove the source from the active list when it finishes playing.
      this.activeAudioSources = this.activeAudioSources.filter(s => s !== source);
    };

    this.nextPlayTime = scheduledPlayTime + audioBuffer.duration;
  }

  // --- VAD/INTERRUPTION FIX: NEW - Helper function to stop all audio playback instantly.
  private _clearPlaybackQueue() {
    // Stop and discard all currently scheduled audio sources.
    this.activeAudioSources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors if the source has already stopped.
      }
    });
    this.activeAudioSources = [];

    // Clear any audio data that hasn't been scheduled yet.
    this.audioQueue = [];

    // Reset the playback time to now.
    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime;
    }
  }

  public setMuted(isMuted: boolean) {
    this.isMuted = isMuted;
  }

  public disconnectCall(reason: string = "User disconnected") {
    if (!this.session) return;
    console.log(`Disconnecting call. Reason: ${reason}`);

    if (this.playbackScheduleId) {
      clearInterval(this.playbackScheduleId);
      this.playbackScheduleId = null;
    }

    // --- VAD/INTERRUPTION FIX: Also clear playback on disconnect.
    this._clearPlaybackQueue();

    this.session.close();
    this.session = null;
    this.microphoneStream?.getTracks().forEach(track => track.stop());
    this.microphoneStream = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.workletNode?.port.close();
    this.workletNode = null;

    console.log("Local call resources cleaned up.");
    this.onCallEnded(reason);
  }
}
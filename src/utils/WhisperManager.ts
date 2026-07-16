// src/utils/WhisperManager.ts

export class WhisperManager {
    // --- Batch Mode (MediaRecorder) Properties ---
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private apiEndpoint: string;
    private authToken: string | null = null;

    // --- Real-time Mode (Web Speech API) Property ---
    private recognition: SpeechRecognition | null = null;
    
    // --- General State Properties ---
    private isRecording: boolean = false;
    private muted: boolean = false;

    // Event handlers
    public onRecordingStart: () => void = () => {};
    public onRecordingStop: () => void = () => {};
    public onTranscriptionReceived: (text: string) => void = () => {}; // Used by Batch mode
    public onError: (error: string) => void = () => {};

    constructor(apiEndpoint: string) {
      this.apiEndpoint = apiEndpoint;
    }

    public static isSpeechRecognitionSupported(): boolean {
        return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    }

    public setAuthToken(token: string) {
      this.authToken = token;
    }

    public setMuted(isMuted: boolean): void {
      this.muted = isMuted;
    }
  
    public startRealtimeRecognition(callbacks: {
        onResult: (text: string) => void;
    }): void {
        if (this.isRecording) return;

        // Note: The types for these are now available from @types/webspeechapi
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.onError("Speech recognition is not supported in this browser.");
            return;
        }

        try {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            
            let finalTranscript = '';

            // --- FIXED: Explicitly type the event parameter ---
            this.recognition.onresult = (event: SpeechRecognitionEvent) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                callbacks.onResult(finalTranscript + interimTranscript);
            };

            // --- FIXED: Explicitly type the event parameter ---
            this.recognition.onerror = (event: SpeechRecognitionError) => {
                this.onError(`Speech recognition error: ${event.error}`);
            };

            this.recognition.onend = () => {
                if(this.isRecording) {
                    this.stopRecording();
                }
            };
            
            this.recognition.start();
            this.isRecording = true;
            this.onRecordingStart();
        } catch (error: any) {
            this.onError(`Failed to start speech recognition: ${error.message}`);
        }
    }

    public async startBatchRecording(): Promise<void> {
      if (this.isRecording) return;
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(this.stream);
        this.audioChunks = [];
        this.mediaRecorder.ondataavailable = (event) => {
          if (!this.muted && event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };
        this.mediaRecorder.onstop = () => this.sendToAPI();
        this.mediaRecorder.start();
        this.isRecording = true;
        this.onRecordingStart();
      } catch (error: any) {
        this.onError(`Failed to access microphone: ${error.message}`);
      }
    }

    public stopRecording(): void {
      if (!this.isRecording) return;
      
      if (this.recognition) {
          this.recognition.stop();
          this.recognition = null;
      } else if (this.mediaRecorder) {
          this.mediaRecorder.stop();
      }

      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      this.isRecording = false;
      this.onRecordingStop();
    }
  
    private async sendToAPI(): Promise<void> {
      if (this.audioChunks.length === 0) return;
      if (!this.authToken) {
        this.onError("Authentication token not set.");
        return;
      }

      try {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${this.authToken}` },
          body: formData, 
        });
  
        if (!response.ok) {
          const errorJson = await response.json().catch(() => ({}));
          const errorMessage = errorJson?.error?.message || response.statusText;
          throw new Error(`API error: ${errorMessage} (${response.status})`);
        }
  
        const result = await response.json();
        this.onTranscriptionReceived(result.text || '');
  
      } catch (error: any) {
        this.onError(`Transcription failed: ${error.message}`);
      }
    }
  
    public get recording(): boolean {
      return this.isRecording;
    }
  
    public cleanup(): void {
      if (this.isRecording) {
        this.stopRecording();
      }
    }
}
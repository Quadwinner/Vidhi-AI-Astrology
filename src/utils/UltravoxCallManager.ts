// File: src/utils/UltravoxCallManager.ts
// Thin wrapper around the Ultravox web SDK (ultravox-client). The backend
// `create-ultravox-call` function returns a joinUrl which we join here.

import { UltravoxSession } from 'ultravox-client';

const log = (...args: any[]) => console.log('[UltravoxCallManager]', ...args);

export class UltravoxCallManager {
  private session: UltravoxSession | null = null;
  private joined = false;

  // Callbacks (wired by the call screen)
  public onCallStarted: () => void = () => {};
  public onCallEnded: () => void = () => {};
  public onError: (message: string) => void = () => {};
  public onUserTranscript: (text: string) => void = () => {};
  public onStatusChange: (status: string) => void = () => {};

  async connectCall(joinUrl: string): Promise<void> {
    try {
      log('connectCall initiated.');
      if (!joinUrl) throw new Error('Missing joinUrl for Ultravox call.');

      const session = new UltravoxSession();
      this.session = session;

      session.addEventListener('status', () => {
        const status = (session as any).status as string;
        this.onStatusChange(status);
        log('status:', status);

        // First time we reach an active conversational state, mark started.
        if (!this.joined && (status === 'idle' || status === 'listening' || status === 'speaking' || status === 'thinking')) {
          this.joined = true;
          this.onCallStarted();
        }

        if (status === 'disconnected') {
          this.onCallEnded();
        }
      });

      session.addEventListener('transcripts', () => {
        const transcripts = (session as any).transcripts as Array<{ text: string; isFinal: boolean; speaker: string }>;
        if (!Array.isArray(transcripts) || transcripts.length === 0) return;
        // Show the latest utterance from whoever spoke last (agent or user),
        // so both sides of the conversation appear as live text.
        const last = transcripts[transcripts.length - 1];
        if (last?.text) this.onUserTranscript(last.text);
      });

      session.joinCall(joinUrl);
      log('joinCall called.');
    } catch (err: any) {
      log('connectCall error:', err);
      this.onError(err?.message || 'Failed to start the Ultravox call.');
      await this.disconnectCall();
    }
  }

  setMuted(muted: boolean): void {
    if (!this.session) return;
    try {
      if (muted) this.session.muteMic();
      else this.session.unmuteMic();
    } catch (e) {
      log('setMuted error:', e);
    }
  }

  async disconnectCall(): Promise<void> {
    log('disconnectCall initiated.');
    try {
      await this.session?.leaveCall();
    } catch (e) {
      log('leaveCall error:', e);
    } finally {
      this.session = null;
      this.joined = false;
    }
  }
}

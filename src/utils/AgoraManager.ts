// File: src/utils/AgoraManager.ts

import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { supabase } from '../supabaseClient';

const log = (message: string, ...args: any[]) => {
  console.log(`[AgoraManager] ${message}`, ...args);
};

export class AgoraManager {
  private client: IAgoraRTCClient;
  private localAudioTrack: IMicrophoneAudioTrack | null = null;
  private appId: string | null = null;
  private channelName: string | null = null;

  // --- Callbacks for UI updates ---
  public onCallStarted: () => void = () => {};
  public onCallEnded: () => void = () => {};
  public onError: (error: string) => void = () => {};
  public onUserTranscript: (transcript: string) => void = () => {};

  constructor() {
    this.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    log("Agora client created.");
    this.addAgoraEventListeners();
  }
  
  private addAgoraEventListeners(): void {
    this.client.on("user-published", async (user, mediaType) => {
      log(`Remote user published: UID ${user.uid}, Media Type: ${mediaType}`);
      if (mediaType === "audio") {
        const remoteAudioTrack = await this.client.subscribe(user, "audio");
        remoteAudioTrack.play();
        log("✅ Subscribed to and playing remote user's audio.");
      }
    });

    this.client.on("user-unpublished", (user) => {
      log(`Remote user unpublished: UID ${user.uid}. Call may be ending.`);
    });
    
    this.client.on("stream-message", (uid, payload) => {
      const message = new TextDecoder().decode(payload);
      try {
        const data = JSON.parse(message);
        if (data.type === "transcriber_final") {
          // This logic is now dormant unless the backend sends the message,
          // but it is harmless to keep.
          this.onUserTranscript(data.text);
        }
      } catch (error) {
        // Silently ignore non-JSON messages
      }
    });
  }

  public async connectCall(systemPrompt: string, gender?: string): Promise<void> {
    log("connectCall initiated.");
    
    try {
      this.channelName = `aura-ai-call-${Date.now()}`;
      log(`Generated channel name: ${this.channelName}`);

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('generate-agora-token', {
        body: { channelName: this.channelName }
      });
      if (tokenError) throw new Error(`Token fetch error: ${tokenError.message}`);

      // Handle the new error format where errors return 200 status with { error: "message" }
      if (tokenData && tokenData.error) throw new Error(tokenData.error);

      const { token, appId } = tokenData;
      if (!token || !appId) throw new Error("Could not retrieve token or appId.");
      this.appId = appId;
      log("✅ Successfully fetched user RTC token.");
      
      if (!this.appId || !this.channelName) {
        throw new Error("AppID or Channel Name is not set. Cannot join channel.");
      }

      await this.client.join(this.appId, this.channelName, token, null);
      log("✅ User joined channel.");

      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      await this.client.publish([this.localAudioTrack]);
      log("✅ User microphone published.");

      log("Requesting AI agent to join the channel...");
      const { data: agentData, error: startError } = await supabase.functions.invoke('manage-agora-ai', {
        body: {
          channelName: this.channelName,
          systemPrompt: systemPrompt,
          token: token,
          gender: gender || 'Male', // Default to Male if not provided
          provider: 'agora' 
        }
      });
      if (startError) throw new Error(`Could not start AI agent: ${startError.message}`);

      // Handle the new error format where errors return 200 status with { error: "message" }
      if (agentData && agentData.error) throw new Error(`Could not start AI agent: ${agentData.error}`);
      log("✅ AI agent start request sent successfully.");

      this.onCallStarted();

    } catch (err: any) {
      log("❌ An error occurred during the connection process:", err);
      this.onError(err.message || "Failed to start the call.");
      await this.disconnectCall();
    }
  }

  public async disconnectCall(): Promise<void> {
    log("disconnectCall initiated.");
    log(`Current connection state: ${this.client.connectionState}`);

    try {
      // First leave the channel properly
      log("Leaving Agora channel...");
      if (this.client.connectionState !== 'DISCONNECTED') {
        log("Client is connected, attempting to leave...");
        await this.client.leave();
        log("✅ Left channel successfully.");
      } else {
        log("Client already disconnected, skipping leave.");
      }
    } catch (error) {
      log("❌ Error leaving channel:", error);
      // Continue with cleanup even if leave fails
    }

    try {
      // Then cleanup resources
      log("Starting cleanup...");
      this.cleanup();
      log("✅ Cleanup completed.");
    } catch (error) {
      log("❌ Error during cleanup:", error);
    }

    try {
      // Finally notify that call ended
      log("Triggering onCallEnded callback...");
      this.onCallEnded();
      log("✅ onCallEnded callback triggered.");
    } catch (error) {
      log("❌ Error in onCallEnded callback:", error);
    }

    log("disconnectCall process complete.");
  }

  public setMuted(muted: boolean): void {
    if (this.localAudioTrack) {
      this.localAudioTrack.setEnabled(!muted);
    }
  }

  private cleanup(): void {
    log("Performing cleanup.");

    try {
      // Cleanup local audio track
      if (this.localAudioTrack) {
        log("Stopping and closing local audio track...");
        this.localAudioTrack.stop();
        this.localAudioTrack.close();
        this.localAudioTrack = null;
        log("✅ Local audio track cleaned up.");
      }
    } catch (error) {
      log("❌ Error cleaning up audio track:", error);
    }

    try {
      // Remove all event listeners
      log("Removing all client listeners...");
      this.client.removeAllListeners();
      log("✅ Client listeners removed.");
    } catch (error) {
      log("❌ Error removing listeners:", error);
    }

    // Reset state
    this.appId = null;
    this.channelName = null;
    log("✅ Cleanup complete.");
  }
}
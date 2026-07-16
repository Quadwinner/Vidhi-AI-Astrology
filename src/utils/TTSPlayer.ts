/**
 * TTSPlayer manages the playback of streamed MP3 audio using Media Source Extensions (MSE).
 * This allows for low-latency playback, starting the audio as soon as the first chunks
 * of data are received, rather than waiting for the entire file to download.
 */
export class TTSPlayer {
    private audio: HTMLAudioElement;
    private mediaSource: MediaSource | null = null;
    private sourceBuffer: SourceBuffer | null = null;
    private streamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    
    private isAppending = false; // Flag to manage buffer updates
    private pendingChunks: Uint8Array[] = []; // Queue for incoming audio data

    // Public state and callbacks
    public isPlaying = false;
    public onPlaybackComplete?: () => void;

    constructor() {
        // Create a hidden audio element to handle playback
        this.audio = new Audio();
        this.audio.style.display = 'none';
        document.body.appendChild(this.audio);

        // Listen for the 'ended' event to know when playback finishes naturally
        this.audio.addEventListener('ended', this.handlePlaybackEnded);
    }

    /**
     * Starts playing an audio stream.
     * @param stream A ReadableStream of Uint8Array, typically from a fetch response body.
     */
    public play(stream: ReadableStream<Uint8Array>): void {
        if (this.isPlaying) {
            console.warn("TTSPlayer is already playing. Call stop() first.");
            this.stop();
        }

        this.isPlaying = true;
        this.streamReader = stream.getReader();
        
        // Create a new MediaSource for this playback session
        this.mediaSource = new MediaSource();
        this.audio.src = URL.createObjectURL(this.mediaSource);

        // The 'sourceopen' event fires once the MediaSource is attached to the audio element
        this.mediaSource.addEventListener('sourceopen', this.handleSourceOpen);
    }

    /**
     * Stops the current playback immediately.
     */
    public stop(): void {
        if (!this.isPlaying && !this.streamReader) {
            return; // Nothing to stop
        }

        // Pause the audio element
        this.audio.pause();

        // Cancel reading from the network stream
        if (this.streamReader) {
            this.streamReader.cancel().catch(() => {}); // Ignore cancellation errors
            this.streamReader = null;
        }

        // Clean up MediaSource resources
        if (this.mediaSource && this.mediaSource.readyState === 'open') {
             // Abort any pending buffer appends before closing the source
            if (this.sourceBuffer && this.sourceBuffer.updating) {
                try {
                    this.sourceBuffer.abort();
                } catch(e) { console.error("Error aborting source buffer:", e); }
            }
             // We can't call endOfStream() when aborting, it will throw an error.
             // Detaching the src is the cleanest way to stop.
        }
        
        // Revoke the object URL to free memory
        if (this.audio.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.audio.src);
            this.audio.src = ""; // Detach the source
        }

        this.cleanup();
    }

    // --- Private Methods ---

    // Bound arrow function to maintain 'this' context in event listeners
    private handleSourceOpen = (): void => {
        if (!this.mediaSource) return;

        // Create a SourceBuffer to accept the MP3 data
        this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mpeg');
        
        // Listen for 'updateend' to know when it's safe to append more data
        this.sourceBuffer.addEventListener('updateend', this.processNextChunk);

        // Start the audio playback and begin pumping data from the stream
        this.audio.play().catch(error => {
            console.error("Audio playback failed:", error);
            this.stop(); // Stop if playback fails
        });
        this.pump(); // Start the data pump
    };

    /**
     * The main loop that reads from the stream and queues chunks for the SourceBuffer.
     */
    private pump = (): void => {
        if (!this.streamReader) return;

        this.streamReader.read().then(({ done, value }) => {
            if (done) {
                // The stream has ended
                this.pendingChunks.push(new Uint8Array(0)); // Add an empty chunk to signal the end
                this.processNextChunk(); // Process it to end the MediaSource
                return;
            }

            if (value) {
                this.pendingChunks.push(value);
                this.processNextChunk(); // Attempt to process the new chunk
            }
        }).catch(error => {
            console.error("Error reading from stream:", error);
            this.stop();
        });
    }

    /**
     * Appends the next available chunk from the queue to the SourceBuffer.
     * This is called after an 'updateend' event or when a new chunk arrives.
     */
    private processNextChunk = (): void => {
        // Do nothing if we are already appending, or if there's nothing to append
        if (this.isAppending || this.pendingChunks.length === 0) {
            return;
        }

        // If the last chunk was the empty "end" signal, finalize the media source
        if (this.pendingChunks[0].length === 0) {
            if (this.mediaSource && this.mediaSource.readyState === 'open') {
                this.mediaSource.endOfStream();
            }
            this.pendingChunks.shift(); // Remove the signal
            return;
        }
        
        if (this.sourceBuffer && !this.sourceBuffer.updating) {
            try {
                this.isAppending = true;
                const chunk = this.pendingChunks.shift();
                if (chunk) {
                    this.sourceBuffer.appendBuffer(chunk);
                }
                // Continue pumping data from the network
                this.pump();
            } catch (error) {
                console.error("Error appending buffer:", error);
                this.stop(); // Stop on critical error
            } finally {
                this.isAppending = false;
            }
        }
    };
    
    // Bound arrow function for the 'ended' event listener
    private handlePlaybackEnded = (): void => {
        this.cleanup();
    };

    /**
     * Resets the player state and notifies the UI via the callback.
     */
    private cleanup = (): void => {
        // Reset all state flags and objects
        this.isPlaying = false;
        this.isAppending = false;
        this.pendingChunks = [];
        
        if(this.mediaSource) {
            this.mediaSource.removeEventListener('sourceopen', this.handleSourceOpen);
            this.mediaSource = null;
        }
        if(this.sourceBuffer) {
            this.sourceBuffer.removeEventListener('updateend', this.processNextChunk);
            this.sourceBuffer = null;
        }

        // Trigger the callback to update the UI
        if (this.onPlaybackComplete) {
            this.onPlaybackComplete();
        }
    }

    /**
     * Public method to release resources, e.g., when a component unmounts.
     */
    public dispose(): void {
    this.stop();
    this.audio.removeEventListener('ended', this.handlePlaybackEnded);

    // This check makes the dispose method idempotent (safe to call multiple times).
    // It verifies that the audio element is still a child of the document body
    // before attempting to remove it.
    if (document.body.contains(this.audio)) {
        document.body.removeChild(this.audio);
    }
}
}
// File: src/utils/audio-processor.js

class AudioResamplerProcessor extends AudioWorkletProcessor {
  // ... (same exact code as before) ...
  constructor(options) {
    super();
    this.targetSampleRate = 16000;
    this.sourceSampleRate = options.processorOptions.sourceSampleRate;
    this.buffer = [];
  }
  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      const pcmData = input[0];
      console.log(`[AudioWorklet] Processing audio chunk. Size: ${pcmData.length}`);
      const ratio = this.sourceSampleRate / this.targetSampleRate;
      let result = [];
      let offset = 0;
      while (offset < pcmData.length) {
        const nextOffset = Math.round((result.length + 1) * ratio);
        result.push(pcmData[Math.round(offset)]);
        offset = nextOffset;
      }
      const pcm16Data = new Int16Array(result.length);
      for (let i = 0; i < result.length; i++) {
        let s = Math.max(-1, Math.min(1, result[i]));
        pcm16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.port.postMessage(pcm16Data.buffer, [pcm16Data.buffer]);
    }
    return true;
  }
}

registerProcessor('audio-resampler-processor', AudioResamplerProcessor);
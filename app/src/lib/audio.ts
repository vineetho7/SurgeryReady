/**
 * Browser audio for the voice agent.
 *
 * Capture: microphone -> 16 kHz mono PCM16 -> websocket.
 * Playback: 24 kHz mono PCM16 from the websocket -> speakers, scheduled back to back.
 *
 * Barge-in is the reason playback is a scheduled queue rather than a series of fire-and-
 * forget plays: when the agent hears the user start talking, everything still queued has
 * to stop immediately or the two of them talk over each other.
 */

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;

export class Microphone {
  private context?: AudioContext;
  private stream?: MediaStream;
  private processor?: ScriptProcessorNode;

  async start(onChunk: (pcm: ArrayBuffer) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.context = new AudioContext({ sampleRate: INPUT_RATE });
    const source = this.context.createMediaStreamSource(this.stream);
    // ScriptProcessor is deprecated but universally available; an AudioWorklet would
    // need a separate module file for no audible gain at this buffer size.
    this.processor = this.context.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const clamped = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      }
      onChunk(pcm.buffer);
    };

    source.connect(this.processor);
    // Chrome will not run a ScriptProcessor unless it reaches the destination. Routing
    // through a muted gain node keeps it alive without echoing the mic to the speakers.
    const mute = this.context.createGain();
    mute.gain.value = 0;
    this.processor.connect(mute);
    mute.connect(this.context.destination);
  }

  stop(): void {
    this.processor?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close();
    this.processor = undefined;
    this.stream = undefined;
    this.context = undefined;
  }
}

export class Speaker {
  private context?: AudioContext;
  private playhead = 0;
  private sources = new Set<AudioBufferSourceNode>();

  private ensure(): AudioContext {
    this.context ??= new AudioContext({ sampleRate: OUTPUT_RATE });
    return this.context;
  }

  enqueue(pcm: ArrayBuffer): void {
    const context = this.ensure();
    const samples = new Int16Array(pcm);
    if (samples.length === 0) {
      return;
    }
    const buffer = context.createBuffer(1, samples.length, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      channel[i] = samples[i] / 0x8000;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    // Never schedule in the past, or chunks overlap and the voice sounds doubled.
    const startAt = Math.max(context.currentTime + 0.02, this.playhead);
    source.start(startAt);
    this.playhead = startAt + buffer.duration;

    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }

  /** Barge-in: stop everything queued and reset the playhead to now. */
  clear(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Already finished — nothing to stop.
      }
    }
    this.sources.clear();
    this.playhead = this.context?.currentTime ?? 0;
  }

  close(): void {
    this.clear();
    void this.context?.close();
    this.context = undefined;
  }
}

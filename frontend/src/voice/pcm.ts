/** Play incoming PCM16 mono 24 kHz without waiting for the complete utterance. */
export class PcmPlayer {
  private context: AudioContext;
  private ownsContext: boolean;
  private sources = new Set<AudioBufferSourceNode>();
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private remainder: number | null = null;
  private nextAt = 0;
  private stopped = false;
  private ended = false;
  private drain: (() => void) | null = null;
  private cancelReady: (() => void) | null = null;
  private requestedAt = performance.now();
  started = false;

  constructor(context?: AudioContext) {
    this.context = context ?? new AudioContext({ sampleRate: 24000 });
    this.ownsContext = !context;
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.cancelReady?.();
    this.cancelReady = null;
    void this.reader?.cancel().catch(() => {});
    for (const source of this.sources) { try { source.stop(); } catch { /* already ended */ } }
    this.sources.clear();
    this.drain?.();
    this.drain = null;
    if (this.ownsContext) void this.context.close().catch(() => {});
  }

  private queue(chunk: Uint8Array) {
    if (this.stopped) return;
    let bytes = chunk;
    if (this.remainder !== null) {
      bytes = new Uint8Array(chunk.length + 1);
      bytes[0] = this.remainder;
      bytes.set(chunk, 1);
      this.remainder = null;
    }
    if (bytes.length % 2) this.remainder = bytes[bytes.length - 1];
    const count = Math.floor(bytes.length / 2);
    if (!count) return;
    const buffer = this.context.createBuffer(1, count, 24000);
    const output = buffer.getChannelData(0);
    const view = new DataView(bytes.buffer, bytes.byteOffset, count * 2);
    for (let i = 0; i < count; i++) output[i] = view.getInt16(i * 2, true) / 32768;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    this.sources.add(source);
    source.onended = () => {
      source.disconnect();
      this.sources.delete(source);
      if (this.ended && !this.sources.size) this.drain?.();
    };
    // A short cushion prevents clicks; queued chunks play back-to-back.
    const at = Math.max(this.context.currentTime + 0.04, this.nextAt);
    this.nextAt = at + count / 24000;
    source.start(at);
    if (!this.started) console.debug('[voice] PCM playback started', JSON.stringify({ elapsedMs: Math.round(performance.now() - this.requestedAt), state: this.context.state }));
    this.started = true;
  }

  async play(stream: ReadableStream<Uint8Array>, signal?: AbortSignal) {
    if (this.stopped) { await stream.cancel(); return; }
    this.reader = stream.getReader();
    try {
      // Do not hang forever when a browser keeps resume() pending after a long network wait.
      await new Promise<void>((resolve, reject) => {
        const cancelled = () => settle(new DOMException('Aborted', 'AbortError'));
        const timer = setTimeout(() => settle(new Error('Audio remained suspended')), 3000);
        let settled = false;
        const settle = (error?: unknown) => {
          if (settled) return;
          settled = true;
          this.cancelReady = null;
          clearTimeout(timer);
          signal?.removeEventListener('abort', cancelled);
          error ? reject(error) : resolve();
        };
        this.cancelReady = cancelled;
        signal?.addEventListener('abort', cancelled, { once: true });
        if (signal?.aborted) { cancelled(); return; }
        if (this.context.state === 'running') { settle(); return; }
        this.context.resume().then(() => settle(), settle);
      });
      while (!this.stopped) {
        const { done, value } = await this.reader.read();
        if (done) break;
        this.queue(value);
      }
      if (this.stopped) return;
      if (this.remainder !== null || !this.started) throw new Error('Invalid PCM stream');
      console.debug('[voice] PCM stream received', JSON.stringify({ elapsedMs: Math.round(performance.now() - this.requestedAt) }));
      this.ended = true;
      if (this.sources.size) await new Promise<void>((resolve) => { this.drain = resolve; });
    } finally {
      if (!this.stopped) { try { await this.reader.cancel(); } catch { /* stream failed */ } }
      this.reader.releaseLock();
      this.reader = null;
      this.stop();
    }
  }
}

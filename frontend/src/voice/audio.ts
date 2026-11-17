/** Keep one output context unlocked by the visitor's gesture across STT/chat waits. */
let output: AudioContext | null = null;

export function playbackContext(): AudioContext {
  if (!output || output.state === 'closed') output = new AudioContext({ sampleRate: 24000 });
  return output;
}

/** Call synchronously from a click/tap, before recording or awaiting a server. */
export function unlockPlayback(): void {
  try {
    const context = playbackContext();
    // resume() must be invoked while the user gesture is still active.
    void context.resume().catch(() => console.warn('[voice] Audio unlock failed'));
    const silence = context.createBufferSource();
    silence.buffer = context.createBuffer(1, 1, 24000);
    silence.connect(context.destination);
    silence.onended = () => silence.disconnect();
    silence.start();
  } catch { console.warn('[voice] Audio unavailable'); }
}

if (import.meta.hot) import.meta.hot.dispose(() => {
  if (output && output.state !== 'closed') void output.close().catch(() => {});
  output = null;
});

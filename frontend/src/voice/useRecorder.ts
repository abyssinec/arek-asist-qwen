import { useCallback, useEffect, useRef, useState } from 'react';

interface Internals {
  stream: MediaStream | null;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  ctx: AudioContext | null;
  raf: number;
  tick: number;
  startedAt: number;
}

/**
 * Запись голоса с микрофона.
 * onLevel получает громкость 0…1 на каждом кадре — ей «дышит» эквалайзер бота.
 * Если микрофона нет или доступ запрещён, уровень имитируется, а stop() вернёт null.
 */
export function useRecorder(onLevel?: (level: number) => void) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const levelRef = useRef(onLevel);
  const r = useRef<Internals>({ stream: null, recorder: null, chunks: [], ctx: null, raf: 0, tick: 0, startedAt: 0 });

  useEffect(() => {
    levelRef.current = onLevel;
  }, [onLevel]);

  const cleanup = useCallback(() => {
    const s = r.current;
    cancelAnimationFrame(s.raf);
    clearInterval(s.tick);
    s.stream?.getTracks().forEach((t) => t.stop());
    void s.ctx?.close().catch(() => {});
    s.stream = null;
    s.ctx = null;
    s.recorder = null;
  }, []);

  const start = useCallback(async () => {
    const s = r.current;
    s.chunks = [];
    let smooth = 0;
    const emit = (target: number) => {
      smooth = smooth * 0.75 + target * 0.25;
      levelRef.current?.(Math.min(1, smooth));
    };
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('mediaDevices unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      s.stream = stream;
      if (typeof MediaRecorder !== 'undefined') {
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size) s.chunks.push(e.data);
        };
        recorder.start(250);
        s.recorder = recorder;
      }
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      s.ctx = ctx;
      const buf = new Uint8Array(analyser.fftSize);
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        emit(Math.sqrt(sum / buf.length) * 5);
        s.raf = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      // Демо без микрофона: «живой» уровень, чтобы анимация не замирала.
      const loop = () => {
        const t = performance.now() / 1000;
        emit(0.3 + 0.5 * Math.abs(Math.sin(t * 4.2) * Math.sin(t * 1.7)));
        s.raf = requestAnimationFrame(loop);
      };
      loop();
    }
    s.startedAt = performance.now();
    setElapsed(0);
    s.tick = window.setInterval(() => setElapsed(Math.floor((performance.now() - s.startedAt) / 1000)), 250);
    setRecording(true);
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const s = r.current;
    const recorder = s.recorder;
    let blob: Blob | null = null;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });
      if (s.chunks.length) blob = new Blob(s.chunks, { type: recorder.mimeType || 'audio/webm' });
    }
    cleanup();
    levelRef.current?.(0);
    setRecording(false);
    return blob;
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return { recording, elapsed, start, stop };
}

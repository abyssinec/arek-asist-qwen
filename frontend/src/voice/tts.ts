import { api } from '../api';
import type { Lang } from '../api/types';
import { config } from '../config';
import { delay } from '../utils/misc';
import { PcmPlayer } from './pcm';
import { playbackContext } from './audio';

let audio: HTMLAudioElement | null = null;
let pcm: PcmPlayer | null = null;
let voiceAbort: AbortController | null = null;
let turn = 0;
let finishPlayback: (() => void) | null = null;

export function stopSpeaking() {
  turn++;
  voiceAbort?.abort();
  voiceAbort = null;
  pcm?.stop();
  pcm = null;
  finishPlayback?.();
  finishPlayback = null;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (audio) { audio.pause(); URL.revokeObjectURL(audio.src); audio = null; }
}

const voiceLang = (lang: Lang) => ({ kk: 'kk-KZ', ru: 'ru-RU', en: 'en-US' })[lang];

/** Qwen streams PCM immediately. Other adapters retain their existing Blob/browser voice. */
export async function speak(text: string, lang: Lang): Promise<void> {
  stopSpeaking();
  const my = turn;
  const readingTime = Math.min(7000, 900 + text.length * 35);
  if (!config.ttsEnabled) return delay(readingTime);
  if (api.ai.ttsStream) {
    const ctrl = new AbortController();
    voiceAbort = ctrl;
    let player: PcmPlayer | null = null;
    try {
      player = new PcmPlayer(playbackContext());
      pcm = player;
      const stream = await api.ai.ttsStream(text, lang, ctrl.signal);
      if (my !== turn) { await stream?.cancel(); return; }
      if (stream) { await player.play(stream, ctrl.signal); return; }
    } catch (error) {
      if (!ctrl.signal.aborted) console.warn('[voice] Stream playback failed', error instanceof Error ? error.name : 'unknown');
      // Never repeat an utterance after any part of it has begun playing.
      if (player?.started || my !== turn || ctrl.signal.aborted) return;
    } finally {
      player?.stop();
      if (pcm === player) pcm = null;
      if (voiceAbort === ctrl) voiceAbort = null;
    }
  } else {
    try {
      const blob = await api.ai.tts(text, lang);
      if (blob && my === turn) {
        const el = new Audio(URL.createObjectURL(blob));
        audio = el;
        await new Promise<void>((resolve) => {
          const done = () => { if (finishPlayback === done) finishPlayback = null; resolve(); };
          finishPlayback = done;
          el.onended = el.onerror = done;
          void el.play().catch(done);
        });
        return;
      }
    } catch { /* no backend voice: use the existing browser fallback */ }
  }
  if (my !== turn) return;
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voiceLang(lang);
    await new Promise<void>((resolve) => {
      const done = () => { if (finishPlayback === done) finishPlayback = null; resolve(); };
      finishPlayback = done;
      u.onend = u.onerror = done;
      window.speechSynthesis.speak(u);
    });
    return;
  }
  return delay(readingTime);
}

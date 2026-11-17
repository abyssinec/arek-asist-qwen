import { config } from '../config';
import type { ChatRequest, ChatResponse, KioskApi, Lang } from './types';

const active = new Set<AbortController>();
let generation = 0;
const receipts = new Map<string, { token: string; lang: Lang }>();
export function cancelQwen() { generation++; for (const c of active) c.abort(); active.clear(); receipts.clear(); }
async function request<T>(path: string, data: unknown, audio = false): Promise<T> {
  const ctrl = new AbortController(); active.add(ctrl);
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(config.qwenApiUrl + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kiosk-Id': config.kioskId }, body: JSON.stringify(data), signal: ctrl.signal });
    if (!res.ok) throw new Error('Qwen unavailable');
    if (res.status === 204) return null as T;
    return (audio ? await res.blob() : await res.json()) as T;
  } finally { clearTimeout(timer); active.delete(ctrl); }
}

/** Keep MediaRecorder and the kiosk interaction unchanged; decode its Blob for Omni PCM input. */
export async function toPcm(audio: Blob): Promise<string> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await audio.arrayBuffer());
    if (!decoded.length || decoded.duration > 20) throw new Error('Invalid recording');
    const count = Math.floor(decoded.duration * 16000), bytes = new Uint8Array(count * 2), view = new DataView(bytes.buffer);
    for (let i = 0; i < count; i++) {
      const at = i * decoded.sampleRate / 16000, p = Math.floor(at), f = at - p;
      let sample = 0;
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) { const a = decoded.getChannelData(ch); sample += a[p] * (1 - f) + a[Math.min(p + 1, a.length - 1)] * f; }
      sample = Math.max(-1, Math.min(1, sample / decoded.numberOfChannels));
      view.setInt16(i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
    }
    let text = ''; for (let i = 0; i < bytes.length; i += 16000) text += String.fromCharCode(...bytes.subarray(i, i + 16000));
    return btoa(text);
  } finally { await ctx.close(); }
}
function validate(raw: unknown): asserts raw is ChatResponse & { voiceToken: string } {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid Qwen response');
  const r = raw as Record<string, unknown>;
  if (typeof r.reply !== 'string' || !Array.isArray(r.actions) || typeof r.voiceToken !== 'string' || !['ru', 'kk', 'en'].includes(String(r.replyLang))) throw new Error('Invalid Qwen response');
  for (const a of r.actions) {
    if (!a || typeof a.title !== 'string') throw new Error('Invalid action');
    if (a.type === 'open_documents') { if (!['connection-private-house', 'meter-check', 'recalculation', 'contract-reissue'].includes(a.serviceCode) || !Number.isInteger(a.count) || a.count < 0) throw new Error('Invalid service action'); }
    else if (a.type !== 'open_account') throw new Error('Unknown action');
  }
}
async function streamVoice(text: string, signal?: AbortSignal): Promise<ReadableStream<Uint8Array> | null> {
  const receipt = receipts.get(text);
  if (!receipt) return null;
  receipts.delete(text);
  const ctrl = new AbortController(); active.add(ctrl);
  const abort = () => ctrl.abort(); signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) ctrl.abort();
  const timer = setTimeout(abort, 90000);
  const cleanup = () => { clearTimeout(timer); active.delete(ctrl); signal?.removeEventListener('abort', abort); };
  try {
    const res = await fetch(config.qwenApiUrl + '/ai/tts-stream', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kiosk-Id': config.kioskId }, body: JSON.stringify({ text, lang: receipt.lang, voiceToken: receipt.token }), signal: ctrl.signal });
    if (!res.ok || !res.body || !res.headers.get('Content-Type')?.startsWith('audio/pcm') || res.headers.get('X-Audio-Sample-Rate') !== '24000') throw new Error('Invalid voice stream');
    const reader = res.body.getReader();
    let bytes = 0;
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (ctrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          if (done) { cleanup(); reader.releaseLock(); controller.close(); }
          else { bytes += value.length; if (bytes > 3000000) throw new Error('Voice too long'); controller.enqueue(value); }
        } catch (error) { ctrl.abort(); void reader.cancel().catch(() => {}); cleanup(); controller.error(error); }
      },
      async cancel() { ctrl.abort(); cleanup(); try { await reader.cancel(); } catch { /* cancelled network */ } }
    }, { highWaterMark: 0 });
  } catch (error) { ctrl.abort(); cleanup(); throw error; }
}

export const qwenAi: KioskApi['ai'] = {
  ttsStream: (text, _lang, signal) => streamVoice(text, signal),
  async chat(req: ChatRequest) {
    // UI history remains on the kiosk; each provider turn is isolated to save tokens.
    const res = await request<unknown>('/ai/chat', { text: req.text, lang: req.lang, sessionId: req.sessionId, kioskId: req.kioskId });
    validate(res);
    if (receipts.size >= 10) receipts.delete(receipts.keys().next().value!);
    receipts.set(res.reply, { token: res.voiceToken, lang: res.replyLang! });
    return res;
  },
  async stt(audio, lang) { if (!audio) throw new Error('No microphone audio'); const started = generation; const pcm = await toPcm(audio); if (started !== generation) throw new DOMException('Cancelled', 'AbortError'); return request('/ai/stt', { audio: pcm, lang }); },
  async tts(text, _lang) { const receipt = receipts.get(text); if (!receipt) return null; receipts.delete(text); return request<Blob | null>('/ai/tts', { text, lang: receipt.lang, voiceToken: receipt.token }, true); },
  cancel: cancelQwen,
};

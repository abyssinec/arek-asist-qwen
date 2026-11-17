import { config } from '../config';
import type { KioskApi } from './types';

export class ApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  json?: unknown;
  body?: BodyInit;
  as?: 'json' | 'blob';
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.apiTimeoutMs);
  const headers: Record<string, string> = { 'X-Kiosk-Id': config.kioskId };
  let body = opts.body;
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  }
  try {
    const res = await fetch(config.apiBaseUrl + path, {
      method: body ? 'POST' : 'GET',
      headers,
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
    if (res.status === 204) return null as T;
    return (opts.as === 'blob' ? await res.blob() : await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(ctrl.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
}

/** Реальный бэкенд. Пути и структуры — в корневом README.md и types.ts. */
export const httpApi: KioskApi = {
  ai: {
    chat: (req) => request('/ai/chat', { json: req }),
    stt: (audio, lang) => {
      if (!audio) return Promise.reject(new ApiError('no-audio'));
      const form = new FormData();
      form.append('audio', audio, 'speech.webm');
      form.append('lang', lang);
      return request('/ai/stt', { body: form });
    },
    tts: (text, lang) => request<Blob | null>('/ai/tts', { json: { text, lang }, as: 'blob' }),
  },
  services: {
    getDocuments: (code, lang) => request(`/services/${encodeURIComponent(code)}/documents?lang=${lang}`),
  },
  billing: {
    lookup: (req) => request('/billing/lookup', { json: req }),
    statement: (accountId, months = 6) =>
      request(`/billing/accounts/${encodeURIComponent(accountId)}/statement?months=${months}`),
  },
  content: {
    playlist: () => request('/content/playlist'),
  },
};

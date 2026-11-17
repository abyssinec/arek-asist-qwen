import type { Lang } from './api/types';

export type PrintMode = 'mock' | 'browser' | 'bridge';

const env = import.meta.env;

const positive = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const oneOf = <T extends string>(value: string | undefined, options: readonly T[], fallback: T): T =>
  (options as readonly string[]).includes(value ?? '') ? (value as T) : fallback;

/** Все настройки киоска читаются из .env (см. .env.example). */
export const config = {
  useMocks: env.VITE_USE_MOCKS !== 'false',
  qwenEnabled: env.VITE_QWEN_ENABLED === 'true',
  qwenApiUrl: (env.VITE_QWEN_API_URL || '/qwen-api').replace(/\/$/, ''),
  apiBaseUrl: (env.VITE_API_BASE_URL || '/api').replace(/\/$/, ''),
  apiTimeoutMs: positive(env.VITE_API_TIMEOUT_MS, 15000),
  printMode: oneOf<PrintMode>(env.VITE_PRINT_MODE, ['mock', 'browser', 'bridge'], 'mock'),
  deviceBridgeUrl: env.VITE_DEVICE_BRIDGE_URL || 'ws://127.0.0.1:8787',
  idleTimeoutSec: positive(env.VITE_IDLE_TIMEOUT_SEC, 75),
  idleWarningSec: positive(env.VITE_IDLE_WARNING_SEC, 15),
  ttsEnabled: env.VITE_TTS_ENABLED === 'true',
  defaultLang: oneOf<Lang>(env.VITE_DEFAULT_LANG, ['kk', 'ru', 'en'], 'ru'),
  kioskId: env.VITE_KIOSK_ID || 'kiosk-01',
  /** Длительность слайда заставки, если в плейлисте не указана своя. */
  slideDurationMs: 7000,
  /** Автостоп записи голоса. */
  maxRecordingSec: 15,
  /** Минимальное время анимации печати, чтобы человек успел увидеть процесс. */
  minPrintAnimationMs: 3000,
} as const;

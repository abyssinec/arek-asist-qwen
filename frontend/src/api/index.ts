import { config } from '../config';
import { qwenAi } from './qwen';
import { httpApi } from './http';
import { mockApi } from './mocks';
import type { KioskApi } from './types';

/** Единая точка доступа к данным: моки или реальный бэкенд по VITE_USE_MOCKS. */
const base = config.useMocks ? mockApi : httpApi;
export const api: KioskApi = config.qwenEnabled ? { ...base, ai: qwenAi } : base;

export { DEFAULT_PLAYLIST } from './mocks';
export { ApiError } from './http';
export type * from './types';

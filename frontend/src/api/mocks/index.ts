import type { KioskApi, Playlist } from '../types';
import { delay } from '../../utils/misc';
import { mockChat, mockStt } from './ai';
import { mockLookup, mockStatement } from './billing';
import { buildServiceDocuments } from './services';

const jitter = (min: number, max: number) => delay(min + Math.random() * (max - min));

export const DEFAULT_PLAYLIST: Playlist = {
  items: [
    { id: 'slide-balance', type: 'slide', slide: 'balance' },
    { id: 'slide-documents', type: 'slide', slide: 'documents' },
    { id: 'slide-voice', type: 'slide', slide: 'voice' },
  ],
};

export const mockApi: KioskApi = {
  ai: {
    chat: async (req) => {
      await jitter(900, 1500);
      return mockChat(req);
    },
    stt: async (_audio, lang) => {
      await jitter(500, 800);
      return { text: mockStt(lang) };
    },
    tts: async () => null,
  },
  services: {
    getDocuments: async (code, lang) => {
      await jitter(300, 600);
      return buildServiceDocuments(code, lang);
    },
  },
  billing: {
    lookup: async (req) => {
      await jitter(900, 1300);
      return mockLookup(req);
    },
    statement: async (accountId, months) => {
      await jitter(400, 700);
      return mockStatement(accountId, months);
    },
  },
  content: {
    // Без бэкенда ролики можно добавить файлом public/media/playlist.json (формат Playlist).
    playlist: async () => {
      try {
        const res = await fetch('./media/playlist.json', { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as Playlist;
          if (Array.isArray(data.items) && data.items.length) return data;
        }
      } catch {
        /* файла нет — используем встроенные слайды */
      }
      return DEFAULT_PLAYLIST;
    },
  },
};

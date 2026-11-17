import type { Lang } from '../api/types';
import { useKiosk } from '../app/store';
import { en } from './en';
import { kk } from './kk';
import { ru, type Dict } from './ru';

export const dictionaries: Record<Lang, Dict> = { kk, ru, en };
export const LANGS: Lang[] = ['kk', 'ru', 'en'];

/** Словарь текущего языка сессии. */
export function useT(): Dict {
  return dictionaries[useKiosk().state.lang];
}

export type { Dict };

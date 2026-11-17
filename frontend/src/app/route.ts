import type { Lang } from '../api/types';
import { config } from '../config';
import type { Screen } from './store';

/**
 * Прямые ссылки на экраны (для показа и отладки):
 *   #/                         заставка
 *   #/assistant                консультант
 *   #/documents/<код услуги>   документы, например #/documents/meter-check
 *   #/account                  лицевой счёт
 * Параметры: ?lang=kk|ru|en, демо-флаги (например ?printer=fail) сохраняются при переходах.
 */

const NAMES: Record<string, Screen> = {
  '': 'attract',
  attract: 'attract',
  assistant: 'assistant',
  documents: 'documents',
  account: 'account',
};

export interface Route {
  screen: Screen;
  serviceCode?: string;
  lang?: Lang;
}

const isLang = (v: string | null): v is Lang => v === 'kk' || v === 'ru' || v === 'en';

const split = (hash: string) => {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  return { path, params: new URLSearchParams(query) };
};

export function parseHash(hash = window.location.hash): Route {
  const { path, params } = split(hash);
  const [name = '', service] = path.split('/');
  const screen = NAMES[name] ?? 'attract';
  const lang = params.get('lang');
  return {
    screen,
    serviceCode: screen === 'documents' && service ? decodeURIComponent(service) : undefined,
    lang: isLang(lang) ? lang : undefined,
  };
}

export function buildHash(route: { screen: Screen; serviceCode: string; lang: Lang }, current = window.location.hash) {
  const path =
    route.screen === 'attract'
      ? ''
      : route.screen === 'documents'
        ? `documents/${encodeURIComponent(route.serviceCode)}`
        : route.screen;
  const { params } = split(current);
  if (route.lang === config.defaultLang) params.delete('lang');
  else params.set('lang', route.lang);
  const query = params.toString();
  return `#/${path}${query ? `?${query}` : ''}`;
}

/** Демо-флаг из адреса, например hasDemoFlag('printer', 'fail') для `?printer=fail`. */
export const hasDemoFlag = (name: string, value: string) => split(window.location.hash).params.get(name) === value;

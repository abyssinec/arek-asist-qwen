import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { ChatAction, Lang } from '../api/types';
import { config } from '../config';
import { api } from '../api';
import { uid } from '../utils/misc';
import { stopSpeaking } from '../voice/tts';
import { buildHash, parseHash, type Route } from './route';

export type Screen = 'attract' | 'assistant' | 'documents' | 'account';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actions?: ChatAction[];
  error?: boolean;
}

interface State {
  screen: Screen;
  lang: Lang;
  sessionId: string;
  /** Услуга для экрана «Документы» (выбирается консультантом). */
  serviceCode: string;
  chat: ChatMessage[];
}

type Action =
  | { type: 'go'; screen: Screen; serviceCode?: string }
  | { type: 'lang'; lang: Lang }
  | { type: 'chat'; messages: ChatMessage[] }
  | { type: 'route'; route: Route }
  | { type: 'reset' };

const DEFAULT_SERVICE = 'connection-private-house';

const fresh = (route?: Route): State => ({
  screen: route?.screen ?? 'attract',
  lang: route?.lang ?? config.defaultLang,
  sessionId: uid(),
  serviceCode: route?.serviceCode ?? DEFAULT_SERVICE,
  chat: [],
});

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'go':
      return { ...state, screen: action.screen, serviceCode: action.serviceCode ?? state.serviceCode };
    case 'lang':
      return { ...state, lang: action.lang };
    case 'chat':
      return { ...state, chat: [...state.chat, ...action.messages] };
    case 'route':
      return {
        ...state,
        screen: action.route.screen,
        serviceCode: action.route.serviceCode ?? state.serviceCode,
        lang: action.route.lang ?? state.lang,
      };
    case 'reset':
      return fresh();
  }
}

interface KioskContext {
  state: State;
  go: (screen: Screen, serviceCode?: string) => void;
  setLang: (lang: Lang) => void;
  addMessages: (messages: ChatMessage[]) => void;
  /** Полный сброс сессии: диалог, введённые данные, язык. Возврат на заставку. */
  reset: () => void;
}

const Ctx = createContext<KioskContext | null>(null);

export function KioskProvider({ children }: { children: ReactNode }) {
  // Стартовый экран и язык можно задать ссылкой (см. route.ts).
  const [state, dispatch] = useReducer(reducer, undefined, () => fresh(parseHash()));

  // Адрес в строке браузера всегда соответствует текущему экрану.
  useEffect(() => {
    const next = buildHash(state);
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
  }, [state.screen, state.serviceCode, state.lang]);

  // Ссылку вставили в адресную строку на открытой странице.
  useEffect(() => {
    const onHash = () => dispatch({ type: 'route', route: parseHash() });
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((screen: Screen, serviceCode?: string) => dispatch({ type: 'go', screen, serviceCode }), []);
  const setLang = useCallback((lang: Lang) => dispatch({ type: 'lang', lang }), []);
  const addMessages = useCallback((messages: ChatMessage[]) => dispatch({ type: 'chat', messages }), []);
  const reset = useCallback(() => {
    api.ai.cancel?.();
    stopSpeaking();
    dispatch({ type: 'reset' });
  }, []);

  const value = useMemo(() => ({ state, go, setLang, addMessages, reset }), [state, go, setLang, addMessages, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKiosk() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useKiosk must be used inside <KioskProvider>');
  return ctx;
}

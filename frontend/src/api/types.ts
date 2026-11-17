/**
 * Контракты между фронтом киоска и бэкендом.
 * Это единственный источник правды для бэкенд-разработчика: реальный API
 * должен возвращать ровно эти структуры (см. также корневой README.md).
 */

export type Lang = 'kk' | 'ru' | 'en';

/* ─────────────── AI-консультант ─────────────── */

/** Карточка-действие под ответом консультанта. */
export type ChatAction =
  | { type: 'open_documents'; serviceCode: string; title: string; count: number }
  | { type: 'open_account'; title: string };

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** POST /ai/chat */
export interface ChatRequest {
  sessionId: string;
  kioskId: string;
  lang: Lang;
  text: string;
  /** Последние реплики диалога (до 10), без приветствия. */
  history: ChatTurn[];
}

export interface ChatResponse {
  reply: string;
  actions: ChatAction[];
  /** Language of the actual question/approved voice reply. */
  replyLang?: Lang;
}

/** POST /ai/stt (multipart: audio, lang) */
export interface SttResponse {
  text: string;
}

/* ─────────────── Услуги и документы ─────────────── */

export interface ServiceDocument {
  id: string;
  title: string;
  note?: string;
}

/** GET /services/{code}/documents?lang= */
export interface ServiceDocuments {
  code: string;
  title: string;
  category: string;
  audience: string;
  documents: ServiceDocument[];
  /** Куда обращаться: адрес (обязательно), кабинет и телефоны (если есть). */
  office: { address: string; room?: string; phone?: string };
  hours: { weekdays: string; lunch?: string };
  /** Важная пометка для печати на чеке (например, «Выдача ТУ — бесплатно»). */
  note?: string;
  /** Номер обращения для печати на чеке. */
  ticket: string;
}

/* ─────────────── Биллинг ─────────────── */

export type IdType = 'iin' | 'bin' | 'phone';

/** POST /billing/lookup. value — только цифры (телефон без +7). */
export interface BillingLookupRequest {
  type: IdType;
  value: string;
}

export interface BillingAccount {
  accountId: string;
  accountNumber: string;
  /** ФИО/наименование уже маскированы на бэкенде. */
  holderMasked: string;
  address: string;
  contract: string;
  customerType: 'individual' | 'legal';
}

/** Пустой список accounts = «не найдено». */
export interface BillingLookupResponse {
  accounts: BillingAccount[];
}

export interface StatementPeriod {
  /** «YYYY-MM» */
  month: string;
  consumptionKwh: number;
  charged: number;
  paid: number;
}

/** GET /billing/accounts/{accountId}/statement?months=6 */
export interface Statement {
  account: BillingAccount;
  /** «YYYY-MM-DD» — дата, на которую рассчитан баланс. */
  asOf: string;
  /** > 0 — задолженность, < 0 — переплата. */
  balanceDue: number;
  currency: 'KZT';
  tariff?: number;
  lastPayment?: { date: string; amount: number };
  periods: StatementPeriod[];
}

/* ─────────────── Контент заставки ─────────────── */

export type SlideId = 'balance' | 'documents' | 'voice';

export type PlaylistItem =
  | { id: string; type: 'slide'; slide: SlideId; durationMs?: number }
  | { id: string; type: 'video'; src: string; poster?: string };

/** GET /content/playlist */
export interface Playlist {
  items: PlaylistItem[];
}

/* ─────────────── Клиент ─────────────── */

export interface KioskApi {
  ai: {
    chat(req: ChatRequest): Promise<ChatResponse>;
    stt(audio: Blob | null, lang: Lang): Promise<SttResponse>;
    /** null — бэкенд не озвучивает, фронт использует синтез речи браузера. */
    tts(text: string, lang: Lang): Promise<Blob | null>;
    /** PCM16 little endian mono 24 kHz; optional to preserve other API adapters. */
    ttsStream?(text: string, lang: Lang, signal?: AbortSignal): Promise<ReadableStream<Uint8Array> | null>;
    /** Cancel pending AI work when the visitor ends the session. */
    cancel?(): void;
  };
  services: {
    getDocuments(code: string, lang: Lang): Promise<ServiceDocuments>;
  };
  billing: {
    lookup(req: BillingLookupRequest): Promise<BillingLookupResponse>;
    statement(accountId: string, months?: number): Promise<Statement>;
  };
  content: {
    playlist(): Promise<Playlist>;
  };
}

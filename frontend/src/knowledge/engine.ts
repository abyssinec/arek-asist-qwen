import type { Lang } from '../api/types';

/**
 * База знаний Астана-РЭК (data/knowledge) — разбор файлов и поиск ответа.
 * Модуль без зависимостей от Vite/React: его же можно переиспользовать на бэкенде (Node).
 *
 * Форматы источников:
 *  - company_*.txt  — блоки «ключ: значение», разделённые пустой строкой
 *                     (id, keywords, answer_ru, answer_kk, answer_en, emotion);
 *  - directory_*.csv — id,keywords,answer_ru,answer_kk,answer_en,route,emotion.
 */

export interface KnowledgeEntry {
  id: string;
  source: 'company' | 'directory';
  keywords: string;
  answers: Record<Lang, string>;
  /** В справочнике отмечены записи с адресом, куда можно «проложить маршрут». */
  route: boolean;
  emotion: string;
}

export interface KnowledgeHit {
  entry: KnowledgeEntry;
  score: number;
  matched: string[];
}

/* ─────────────── разбор файлов ─────────────── */

const clean = (raw: string) => raw.replace(/^\uFEFF/, '').replace(/\r/g, '');

export function parseCompanyTxt(raw: string): KnowledgeEntry[] {
  return clean(raw)
    .split(/\n\s*\n/)
    .map((block) => {
      const fields: Record<string, string> = {};
      for (const line of block.split('\n')) {
        const i = line.indexOf(':');
        if (i > 0) fields[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
      return fields;
    })
    .filter((f) => f.id && f.answer_ru)
    .map((f) => ({
      id: f.id,
      source: 'company' as const,
      keywords: f.keywords ?? '',
      answers: { ru: f.answer_ru, kk: f.answer_kk || f.answer_ru, en: f.answer_en || f.answer_ru },
      route: false,
      emotion: f.emotion || 'idle',
    }));
}

/** CSV по RFC 4180: поля в кавычках могут содержать запятые и удвоенные кавычки. */
export function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const text = clean(raw);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export function parseDirectoryCsv(raw: string): KnowledgeEntry[] {
  const [header, ...rows] = parseCsv(raw);
  const col = (name: string) => header.indexOf(name);
  return rows
    .map((r) => ({
      id: r[col('id')],
      source: 'directory' as const,
      keywords: r[col('keywords')] ?? '',
      answers: {
        ru: r[col('answer_ru')],
        kk: r[col('answer_kk')] || r[col('answer_ru')],
        en: r[col('answer_en')] || r[col('answer_ru')],
      },
      route: /^true$/i.test(r[col('route')] ?? ''),
      emotion: r[col('emotion')] || 'idle',
    }))
    .filter((e) => e.id && e.answers.ru);
}

/* ─────────────── поиск ─────────────── */

const STOP = new Set(
  (
    'как что где для это или при мне мой моя мои наш вы мы на по за из не ли бы его их есть кто какой какая какие ' +
    'когда куда можно нужно надо хочу сколько у в с и а о об от до же то так все вас вам мен мен және бар ма ме ба бе ' +
    'қалай қайда қандай не үшін the and for how what where is are my me i to of a in can do does you your with'
  ).split(' '),
);

const normalize = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

export const tokenize = (s: string) =>
  normalize(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2 && !STOP.has(t));

/**
 * Совпадение слов с учётом окончаний: общий префикс ≈ ¾ длины более короткого слова, но не меньше 5 букв
 * («счётчика» = «счетчик», «подключить» = «подключение», но «электроэнергия» ≠ «электроплита»).
 */
function same(q: string, k: string) {
  if (/^\d/.test(q) || /^\d/.test(k)) return q === k;
  if (k.length <= 4 || q.length <= 4) return q === k || (q.startsWith(k) && q.length - k.length <= 2);
  const n = Math.max(5, Math.floor(Math.min(q.length, k.length) * 0.75));
  return q.slice(0, n) === k.slice(0, n);
}

/** Основа слова для подсчёта частоты: «тариф» и «тарифы» считаются одним словом. */
const stem = (k: string) => (/^\d/.test(k) ? k : k.slice(0, 5));

interface Indexed {
  entry: KnowledgeEntry;
  keys: string[];
  answerTokens: Record<Lang, string[]>;
  boost: number;
}

export interface KnowledgeIndex {
  entries: KnowledgeEntry[];
  search(text: string, lang: Lang): KnowledgeHit | null;
}

export interface IndexOptions {
  /** Дополнительные синонимы к записям базы (разговорные формулировки посетителей). */
  aliases?: Record<string, string>;
  /** Приоритет записей, важных для посетителей киоска, при равенстве совпадений. */
  boost?: Record<string, number>;
  /** Минимальный балл, ниже которого ответ считается ненайденным. */
  threshold?: number;
}

export function buildIndex(entries: KnowledgeEntry[], opts: IndexOptions = {}): KnowledgeIndex {
  const indexed: Indexed[] = entries.map((entry) => ({
    entry,
    keys: [...new Set(tokenize(`${entry.keywords} ${opts.aliases?.[entry.id] ?? ''}`))],
    answerTokens: {
      ru: [...new Set(tokenize(entry.answers.ru))],
      kk: [...new Set(tokenize(entry.answers.kk))],
      en: [...new Set(tokenize(entry.answers.en))],
    },
    boost: opts.boost?.[entry.id] ?? 0,
  }));

  // IDF: редкие слова («пломбировка») весят больше частых («тариф», «телефон»).
  const df = new Map<string, number>();
  for (const it of indexed) for (const s of new Set(it.keys.map(stem))) df.set(s, (df.get(s) ?? 0) + 1);
  const idf = (k: string) => Math.log(1 + indexed.length / (df.get(stem(k)) ?? 1));
  const threshold = opts.threshold ?? 2.5;

  return {
    entries,
    search(text, lang) {
      const query = [...new Set(tokenize(text))];
      if (!query.length) return null;
      let best: KnowledgeHit | null = null;
      for (const it of indexed) {
        // Каждое слово вопроса засчитывается один раз — по самому редкому совпавшему ключу.
        const matched: string[] = [];
        let score = 0;
        for (const q of query) {
          let bestKey = '';
          for (const k of it.keys) if (same(q, k) && (!bestKey || idf(k) > idf(bestKey))) bestKey = k;
          if (bestKey) {
            matched.push(bestKey);
            score += idf(bestKey);
          }
        }
        // Слова из текста ответа на языке вопроса — слабый сигнал (помогает казахским вопросам).
        const inAnswer = query.filter((q) => it.answerTokens[lang].some((a) => same(q, a))).length;
        score += inAnswer * 0.6;
        if (!matched.length && !inAnswer) continue;
        score += it.boost;
        const better =
          !best ||
          score > best.score + 1e-9 ||
          (Math.abs(score - best.score) < 1e-9 && it.entry.source === 'company' && best.entry.source !== 'company');
        if (better) best = { entry: it.entry, score, matched };
      }
      return best && best.score >= threshold ? best : null;
    },
  };
}

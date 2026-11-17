import type { Lang } from '../api/types';

export const localeOf = (lang: Lang) => ({ kk: 'kk-KZ', ru: 'ru-RU', en: 'en-GB' })[lang];

export const formatMoney = (value: number, lang: Lang) =>
  value.toLocaleString(localeOf(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatNumber = (value: number, lang: Lang) => value.toLocaleString(localeOf(lang));

/** «2026-04» → «Апрель 2026» / «апр.» */
export const formatMonth = (yearMonth: string, lang: Lang, style: 'long' | 'short' = 'long') => {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  const text =
    style === 'long'
      ? date.toLocaleDateString(localeOf(lang), { month: 'long', year: 'numeric' })
      : date.toLocaleDateString(localeOf(lang), { month: 'short' });
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/\s?г\.$/, '');
};

/** «2026-10-01» → «01.10.2026» */
export const formatDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};

/** Штамп для чека: «09.10.2026  14:05» */
export const formatStamp = (date: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()}  ${p(date.getHours())}:${p(date.getMinutes())}`;
};

export const formatTime = (date: Date, lang: Lang) =>
  date.toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit' });

export const formatDay = (date: Date, lang: Lang) =>
  date.toLocaleDateString(localeOf(lang), { weekday: 'short', day: 'numeric', month: 'long' });

export const formatSeconds = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

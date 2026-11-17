import companyRaw from '../../../data/knowledge/company_ASTREC_FULL_2026-10-06.txt?raw';
import directoryRaw from '../../../data/knowledge/directory_ASTREC_FULL_2026-10-06.csv?raw';
import { buildIndex, parseCompanyTxt, parseDirectoryCsv } from './engine';
import { ALIASES, BOOST } from './tuning';

/** Дата актуальности базы (из имени файлов и записи data_freshness). */
export const KNOWLEDGE_UPDATED = '2026-10-06';

export const knowledge = buildIndex(
  [...parseCompanyTxt(companyRaw), ...parseDirectoryCsv(directoryRaw)],
  { aliases: ALIASES, boost: BOOST },
);

import { knowledge } from '../../knowledge';
import { tokenize } from '../../knowledge/engine';
import type { ChatAction, ChatRequest, ChatResponse, Lang } from '../types';
import { findService } from './services';

/**
 * ДЕМО-консультант на базе знаний astrec.kz (data/knowledge).
 *  1. Сценарии с действиями (документы на печать, лицевой счёт) — ответ + карточка.
 *  2. Иначе — поиск ответа в базе знаний (тарифы, оплата, показания, аварии, адреса, руководство…).
 *  3. Иначе — вежливый отказ со списком тем.
 * На проде заменяется LLM + RAG на бэкенде с тем же контрактом /ai/chat.
 */
type L10n = Record<Lang, string>;

interface Intent {
  id: string;
  /** Начала слов (совпадение по префиксу слова) или фразы с пробелом (поиск подстроки). */
  keys: string[];
  reply: L10n;
  actions: (lang: Lang) => ChatAction[];
}

const docs = (code: string, lang: Lang): ChatAction => {
  const s = findService(code);
  return { type: 'open_documents', serviceCode: s.code, title: s.title[lang], count: s.documents.length };
};

const account = (lang: Lang): ChatAction => ({
  type: 'open_account',
  title: { ru: 'Открыть лицевой счёт', kk: 'Дербес шотты ашу', en: 'Open my account' }[lang],
});

// Порядок важен: первым срабатывает более узкий сценарий.
const INTENTS: Intent[] = [
  {
    id: 'recalc',
    keys: ['перерасч', 'қайта есепте', 'recalc'],
    reply: {
      ru: 'Вопросы начислений и перерасчёта: 576-578 (пн–пт 07:30–18:00), esep@astrec.kz. Сначала проверьте начисления в лицевом счёте, затем распечатайте список документов для заявления.',
      kk: 'Есептеу және қайта есептеу мәселелері: 576-578 (дс–жм 07:30–18:00), esep@astrec.kz. Алдымен дербес шоттағы есептеулерді тексеріп, өтінішке арналған құжаттар тізімін басып шығарыңыз.',
      en: 'Billing and recalculation: 576-578 (Mon–Fri 07:30–18:00), esep@astrec.kz. Check the charges in your account first, then print the document list for the application.',
    },
    actions: (lang) => [account(lang), docs('recalculation', lang)],
  },
  {
    id: 'connect',
    keys: ['подключ', 'присоедин', 'техусло', 'технические условия', 'техникалық шарт', 'электросет', 'қосыл', 'қосқ', 'connect'],
    reply: {
      ru: 'Для подключения нужны технические условия (ТУ) — их выдают бесплатно, а работы по подключению оплачивает собственник. Документы принимает Служба доступа к электросетям: 620-456 (меню 3), лично на ул. Домалак Ана, 9 или онлайн через eOtinish. Список документов можно распечатать.',
      kk: 'Қосылу үшін техникалық шарттар (ТШ) қажет — олар тегін беріледі, ал қосылу жұмыстарын меншік иесі төлейді. Құжаттарды желіге қол жеткізу қызметі қабылдайды: 620-456 (3-мәзір), Домалақ Ана көш., 9 немесе eOtinish арқылы. Құжаттар тізімін басып шығаруға болады.',
      en: 'To connect you need technical specifications (TU) — issued free of charge; connection works are paid by the owner. The Grid Access Service accepts documents: 620-456 (menu 3), at 9 Domalak Ana St. or online via eOtinish. You can print the document list.',
    },
    actions: (lang) => [docs('connection-private-house', lang)],
  },
  {
    id: 'contract',
    keys: ['договор', 'переоформ', 'шарт', 'contract'],
    reply: {
      ru: 'Договор для жильцов публичный — заключается по заявлению об акцепте типового договора. Консультации: физлица — 571-152, юрлица — 571-244, 571-243. Список документов можно распечатать.',
      kk: 'Тұрғындарға арналған шарт жария — үлгілік шартты акцептеу өтінішімен жасалады. Кеңес: жеке тұлғалар — 571-152, заңды тұлғалар — 571-244, 571-243. Құжаттар тізімін басып шығаруға болады.',
      en: 'The household contract is public — concluded by an acceptance of the standard contract. Advice: individuals 571-152, companies 571-244, 571-243. You can print the document list.',
    },
    actions: (lang) => [docs('contract-reissue', lang)],
  },
  {
    id: 'meter',
    keys: ['пломб', 'поверк', 'проверить счетчик', 'проверка счетчика', 'проверку счетчика', 'есептегішті тексер', 'meter check', 'seal'],
    reply: {
      ru: 'Проверку, снятие показаний и пломбировку счётчика делают сервис-центры по районам, пн–пт 08:30–17:30. Например, Нура — ул. Домалак Ана, 9, тел. 620-417. Сотрудники Астана-РЭК не просят SMS-коды по телефону.',
      kk: 'Есептегішті тексеру, көрсеткіш алу және пломбалауды аудандық сервис орталықтары жасайды, дс–жм 08:30–17:30. Мысалы, Нұра — Домалақ Ана көш., 9, тел. 620-417. Астана-РЭК қызметкерлері SMS-код сұрамайды.',
      en: 'Meter checks, readings and sealing are handled by district service centers, Mon–Fri 08:30–17:30 — e.g. Nura: 9 Domalak Ana St., 620-417. Astana-REC staff never ask for SMS codes.',
    },
    actions: (lang) => [docs('meter-check', lang)],
  },
  {
    id: 'balance',
    keys: ['баланс', 'долж', 'задолж', 'лицев', 'мой счет', 'қарыз', 'дербес шот', 'owe', 'balance', 'my account'],
    reply: {
      ru: 'Покажу баланс и начисления — откройте лицевой счёт и введите ИИН, БИН или номер телефона. По вопросам начислений: 576-578.',
      kk: 'Баланс пен есептеулерді көрсетемін — дербес шотты ашып, ЖСН, БСН немесе телефон нөмірін енгізіңіз. Есептеу сұрақтары: 576-578.',
      en: 'I will show your balance and charges — open your account and enter your IIN, BIN or phone number. Billing questions: 576-578.',
    },
    actions: (lang) => [account(lang)],
  },
];

const FALLBACK: L10n = {
  ru: 'Пока не нашёл ответа на этот вопрос. Спросите про тарифы, оплату, показания, подключение, аварии, адреса сервис-центров или руководство — или позвоните в call-центр 576-580.',
  kk: 'Бұл сұраққа әзірге жауап таппадым. Тарифтер, төлем, көрсеткіштер, қосылу, апаттар, сервис орталықтарының мекенжайы немесе басшылық туралы сұраңыз — немесе 576-580 call-орталығына хабарласыңыз.',
  en: "I couldn't find an answer yet. Ask about tariffs, payment, meter readings, connection, outages, service-center addresses or management — or call 576-580.",
};

const normalize = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

function matches(intent: Intent, text: string, words: string[]) {
  return intent.keys.some((key) => {
    const k = normalize(key);
    return k.includes(' ') ? text.includes(k) : words.some((w) => w.startsWith(k));
  });
}

export function mockChat(req: ChatRequest): ChatResponse {
  const text = normalize(req.text);
  const words = tokenize(req.text);
  const intent = INTENTS.find((i) => matches(i, text, words));
  if (intent) return { reply: intent.reply[req.lang], actions: intent.actions(req.lang) };

  const hit = knowledge.search(req.text, req.lang);
  if (hit) return { reply: hit.entry.answers[req.lang], actions: [] };

  return { reply: FALLBACK[req.lang], actions: [] };
}

/** Распознавание речи в демо: по кругу отдаёт типовые вопросы посетителей. */
const STT_PHRASES: Record<Lang, string[]> = {
  ru: [
    'Сколько я должен за электроэнергию?',
    'Как передать показания счётчика?',
    'Хочу подключить частный дом к электросети',
    'Какой тариф на электроэнергию для квартиры?',
    'Нет света — куда звонить?',
  ],
  kk: [
    'Электр энергиясы үшін қанша қарызым бар?',
    'Көрсеткіштерді қалай беремін?',
    'Жеке үйді электр желісіне қосқым келеді',
    'Тариф қандай?',
    'Жарық өшті, қайда хабарласу керек?',
  ],
  en: [
    'How much do I owe for electricity?',
    'How do I submit meter readings?',
    'I want to connect a private house to the grid',
    'What is the electricity tariff?',
    'Power outage, who do I call?',
  ],
};
let sttTurn = 0;

export function mockStt(lang: Lang): string {
  const list = STT_PHRASES[lang];
  return list[sttTurn++ % list.length];
}

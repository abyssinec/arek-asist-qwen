import type { Lang, ServiceDocuments } from '../types';

/**
 * Справочник услуг для экрана «Документы».
 * Адреса, телефоны, часы работы и перечень документов на ТУ взяты из базы знаний astrec.kz
 * (data/knowledge, актуальность 06.10.2026). Перечни для проверки счётчика, перерасчёта и договора
 * в базе не опубликованы — они примерные и требуют подтверждения заказчиком.
 */
type L10n = Record<Lang, string>;

interface ServiceSpec {
  code: string;
  title: L10n;
  category: L10n;
  office: { address: L10n; room?: string; phone?: L10n };
  note?: L10n;
  documents: L10n[];
}

const AUDIENCE: L10n = { ru: 'Физическое лицо', kk: 'Жеке тұлға', en: 'Individual' };
/** Режим работы сервис-центров и касс: пн–пт 08:30–17:30 без обеда. */
const HOURS = { weekdays: '08:30–17:30' };

const HEAD_OFFICE: L10n = {
  ru: 'ул. Домалак Ана, 9',
  kk: 'Домалақ Ана көш., 9',
  en: '9 Domalak Ana St.',
};

const ID_DOC: L10n = { ru: 'Удостоверение личности', kk: 'Жеке куәлік', en: 'ID card' };
const TITLE_DOC: L10n = {
  ru: 'Правоустанавливающий документ на объект',
  kk: 'Объектіге құқық белгілейтін құжат',
  en: 'Property title document',
};
const PROXY: L10n = {
  ru: 'Доверенность — если обращается представитель',
  kk: 'Сенімхат — өкіл жүгінген жағдайда',
  en: 'Power of attorney — if a representative applies',
};

export const SERVICES: ServiceSpec[] = [
  {
    code: 'connection-private-house',
    title: {
      ru: 'Подключение частного дома к электросети',
      kk: 'Жеке үйді электр желісіне қосу',
      en: 'Connecting a private house to the grid',
    },
    category: { ru: 'Технические условия (ТУ)', kk: 'Техникалық шарттар (ТШ)', en: 'Technical specifications (TU)' },
    office: {
      address: {
        ru: 'ул. Домалак Ана, 9 или онлайн через eOtinish',
        kk: 'Домалақ Ана көш., 9 немесе eOtinish арқылы онлайн',
        en: '9 Domalak Ana St. or online via eOtinish',
      },
      phone: { ru: '620-456 (меню 3), +7 701 081 65 51', kk: '620-456 (3-мәзір), +7 701 081 65 51', en: '620-456 (menu 3), +7 701 081 65 51' },
    },
    note: {
      ru: 'Выдача ТУ — бесплатно. Работы по подключению оплачивает собственник.',
      kk: 'ТШ беру — тегін. Қосылу жұмыстарын меншік иесі төлейді.',
      en: 'TU issuance is free. Connection works are paid by the owner.',
    },
    documents: [
      { ru: 'Заявление на выдачу ТУ (шаблон — на astrec.kz)', kk: 'ТШ беруге өтініш (үлгісі — astrec.kz)', en: 'TU application (template on astrec.kz)' },
      {
        ru: 'Документ, удостоверяющий личность (ИП и юрлица — регистрационные документы)',
        kk: 'Жеке басты куәландыратын құжат (ЖК мен заңды тұлғалар — тіркеу құжаттары)',
        en: 'ID document (sole traders and companies — registration documents)',
      },
      TITLE_DOC,
      { ru: 'Ситуационный план', kk: 'Ситуациялық жоспар', en: 'Site plan' },
      { ru: 'Расчёт-обоснование заявляемой мощности', kk: 'Мәлімделген қуаттың есеп-негіздемесі', en: 'Requested-power calculation' },
      { ru: 'Опросный лист', kk: 'Сауалнама парағы', en: 'Questionnaire' },
      PROXY,
    ],
  },
  {
    code: 'meter-check',
    title: {
      ru: 'Проверка и пломбировка прибора учёта',
      kk: 'Есептеу құралын тексеру және пломбалау',
      en: 'Meter check and sealing',
    },
    category: { ru: 'Сервис-центр', kk: 'Сервис орталығы', en: 'Service center' },
    office: {
      address: {
        ru: 'Сервис-центр №2 (Нура), ул. Домалак Ана, 9 — или сервис-центр вашего района',
        kk: '№2 сервис орталығы (Нұра), Домалақ Ана көш., 9 — немесе ауданыңыздағы орталық',
        en: 'Service Center 2 (Nura), 9 Domalak Ana St. — or your district center',
      },
      phone: { ru: '620-417, WhatsApp +7 771 210 64 96', kk: '620-417, WhatsApp +7 771 210 64 96', en: '620-417, WhatsApp +7 771 210 64 96' },
    },
    note: {
      ru: 'Сотрудники Астана-РЭК не просят SMS-коды и не предлагают замену счётчика по телефону.',
      kk: 'Астана-РЭК қызметкерлері SMS-код сұрамайды және телефон арқылы есептегішті ауыстыруды ұсынбайды.',
      en: 'Astana-REC staff never ask for SMS codes or offer meter replacement by phone.',
    },
    documents: [
      ID_DOC,
      { ru: 'Номер лицевого счёта или последняя квитанция', kk: 'Дербес шот нөмірі немесе соңғы түбіртек', en: 'Account number or latest bill' },
      { ru: 'Заявка на проверку / пломбировку (заполняется на месте)', kk: 'Тексеруге / пломбалауға өтінім (орнында толтырылады)', en: 'Check / sealing request (filled in on site)' },
    ],
  },
  {
    code: 'recalculation',
    title: { ru: 'Перерасчёт начислений', kk: 'Есептеулерді қайта есептеу', en: 'Recalculation of charges' },
    category: { ru: 'Начисления', kk: 'Есептеу', en: 'Billing' },
    office: {
      address: HEAD_OFFICE,
      phone: { ru: '576-578 (пн–пт 07:30–18:00), esep@astrec.kz', kk: '576-578 (дс–жм 07:30–18:00), esep@astrec.kz', en: '576-578 (Mon–Fri 07:30–18:00), esep@astrec.kz' },
    },
    documents: [
      ID_DOC,
      { ru: 'Заявление на перерасчёт', kk: 'Қайта есептеуге өтініш', en: 'Recalculation application' },
      { ru: 'Подтверждающие документы (акт, справка)', kk: 'Растайтын құжаттар (акт, анықтама)', en: 'Supporting documents (act, certificate)' },
      { ru: 'Квитанции об оплате за спорный период', kk: 'Даулы кезеңдегі төлем түбіртектері', en: 'Payment receipts for the disputed period' },
    ],
  },
  {
    code: 'contract-reissue',
    title: {
      ru: 'Договор электроснабжения для физлиц',
      kk: 'Жеке тұлғаларға электрмен жабдықтау шарты',
      en: 'Electricity supply contract for individuals',
    },
    category: { ru: 'Договоры', kk: 'Шарттар', en: 'Contracts' },
    office: {
      address: HEAD_OFFICE,
      phone: { ru: '571-152 (юрлица: 571-244, 571-243)', kk: '571-152 (заңды тұлғалар: 571-244, 571-243)', en: '571-152 (companies: 571-244, 571-243)' },
    },
    note: {
      ru: 'Договор для жильцов публичный — заключается по заявлению об акцепте типового договора.',
      kk: 'Тұрғындарға арналған шарт жария — үлгілік шартты акцептеу өтінішімен жасалады.',
      en: 'The household contract is public — concluded by an acceptance of the standard contract.',
    },
    documents: [
      { ru: 'Заявление об акцепте типового договора', kk: 'Үлгілік шартты акцептеу туралы өтініш', en: 'Acceptance of the standard contract' },
      ID_DOC,
      TITLE_DOC,
      PROXY,
    ],
  },
];

export const findService = (code: string) => SERVICES.find((s) => s.code === code) ?? SERVICES[0];

export function buildServiceDocuments(code: string, lang: Lang): ServiceDocuments {
  const s = findService(code);
  return {
    code: s.code,
    title: s.title[lang],
    category: s.category[lang],
    audience: AUDIENCE[lang],
    documents: s.documents.map((d, i) => ({ id: `${s.code}-${i + 1}`, title: d[lang] })),
    office: { address: s.office.address[lang], room: s.office.room, phone: s.office.phone?.[lang] },
    hours: HOURS,
    note: s.note?.[lang],
    ticket: 'A-' + String(Math.floor(100 + Math.random() * 900)).padStart(4, '0'),
  };
}

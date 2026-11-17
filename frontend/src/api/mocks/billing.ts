import type { BillingAccount, BillingLookupRequest, BillingLookupResponse, Statement } from '../types';

/**
 * ДЕМО-биллинг. Любой номер находит счёт, номер на …0000 — «не найдено»,
 * номер на …9999 — «биллинг недоступен» (имитация сбоя).
 * Лицевые счета и потребление выдуманы, а тарифы — реальные из базы знаний astrec.kz (с 01.07.2026):
 * физлица без электроплиты — ступени 24,81 / 33,74 / 42,18 тг/кВт·ч (до 70, 70–140, свыше 140 кВт·ч, с НДС);
 * прочие юрлица — 35,72 тг/кВт·ч без НДС.
 */
const HOUSEHOLD_TIERS: [limit: number, price: number][] = [
  [70, 24.81],
  [140, 33.74],
  [Infinity, 42.18],
];
const HOUSEHOLD_AVERAGE = 28.12;
const LEGAL_TARIFF = 35.72;
const KWH = [210, 185, 170, 196, 230, 248];

/** Стоимость месячного потребления по ступенчатому тарифу. */
function householdCharge(kwh: number) {
  let rest = kwh;
  let prev = 0;
  let sum = 0;
  for (const [limit, price] of HOUSEHOLD_TIERS) {
    const part = Math.min(rest, limit - prev);
    if (part <= 0) break;
    sum += part * price;
    rest -= part;
    prev = limit;
  }
  return sum;
}

const accounts = new Map<string, BillingAccount>();

export function mockLookup(req: BillingLookupRequest): BillingLookupResponse {
  if (req.value.endsWith('9999')) throw new Error('demo: billing unavailable');
  if (req.value.endsWith('0000')) return { accounts: [] };
  const legal = req.type === 'bin';
  const account: BillingAccount = {
    accountId: `acc-${req.type}-${req.value.slice(-4)}`,
    accountNumber: legal ? '7002 1934 55' : '3001 4821 07',
    holderMasked: legal ? 'ТОО «Д*****»' : 'А*** Е. С.',
    address: legal ? 'г. Астана, ул. Демонстрационная, 5, офис 12' : 'г. Астана, пр. Демонстрационный, 12, кв. 45',
    contract: legal ? 'ЮЛ-2021/1178' : 'ЭС-2019/0482',
    customerType: legal ? 'legal' : 'individual',
  };
  accounts.set(account.accountId, account);
  return { accounts: [account] };
}

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const iso = (d: Date) => `${ym(d)}-${String(d.getDate()).padStart(2, '0')}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function mockStatement(accountId: string, months = 6): Statement {
  const account = accounts.get(accountId) ?? mockLookup({ type: 'iin', value: '000000001234' }).accounts[0];
  const factor = account.customerType === 'legal' ? 12 : 1;
  const now = new Date();
  const count = Math.min(months, KWH.length);
  const periods = Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - count + i, 1);
    const kwh = KWH[KWH.length - count + i] * factor;
    const charged = round2(factor > 1 ? kwh * LEGAL_TARIFF : householdCharge(kwh));
    const isLast = i === count - 1;
    const isPrev = i === count - 2;
    const paid = isLast ? 0 : isPrev ? round2(Math.min(charged, 5000 * factor)) : charged;
    return { month: ym(date), consumptionKwh: kwh, charged, paid };
  });
  const balanceDue = round2(periods.reduce((sum, p) => sum + p.charged - p.paid, 0));
  const lastPaymentDate = new Date(now.getFullYear(), now.getMonth() - 1, 5);
  return {
    account,
    asOf: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    balanceDue,
    currency: 'KZT',
    tariff: factor > 1 ? LEGAL_TARIFF : HOUSEHOLD_AVERAGE,
    lastPayment: { date: iso(lastPaymentDate), amount: 5000 * factor },
    periods,
  };
}

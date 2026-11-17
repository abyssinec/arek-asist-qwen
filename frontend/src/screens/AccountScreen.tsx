import { useState } from 'react';
import { api } from '../api';
import type { IdType, Statement } from '../api/types';
import { useKiosk } from '../app/store';
import { BackButton, Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { Numpad } from '../components/Numpad';
import { PrintOverlay, type PrintPhase } from '../components/PrintOverlay';
import { config } from '../config';
import { bridge } from '../devices/bridge';
import { useT } from '../i18n';
import { formatDate, formatMoney, formatMonth, formatNumber } from '../utils/format';
import { delay, fillTemplate, maskTail } from '../utils/misc';
import './AccountScreen.css';

type Phase = 'input' | 'loading' | 'result' | 'notFound' | 'error';

const ID_FORMATS: Record<IdType, { template: string; length: number; demo: string }> = {
  iin: { template: '###### ######', length: 12, demo: '880312450128' },
  bin: { template: '###### ######', length: 12, demo: '120540018342' },
  phone: { template: '+7 (###) ###-##-##', length: 10, demo: '7017771234' },
};
const MODES: IdType[] = ['iin', 'bin', 'phone'];

/** Экран 4 · Лицевой счёт: ввод ИИН / БИН / телефона → выписка из биллинга → печать A4. */
export function AccountScreen() {
  const { state, go, reset } = useKiosk();
  const t = useT();
  const lang = state.lang;
  const [mode, setMode] = useState<IdType>('iin');
  const [digits, setDigits] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [statement, setStatement] = useState<Statement | null>(null);
  const [invalid, setInvalid] = useState(0);
  const [printPhase, setPrintPhase] = useState<PrintPhase>(null);

  const format = ID_FORMATS[mode];
  const masked = `${t.account.modes[mode]} ${maskTail(digits || format.demo)}`;

  const pickMode = (next: IdType) => {
    setMode(next);
    setDigits('');
    setInvalid(0);
  };

  const type = (d: string) => {
    setInvalid(0);
    setDigits((v) => (v.length < format.length ? v + d : v));
  };

  const find = async () => {
    if (digits && digits.length < format.length) {
      setInvalid((n) => n + 1);
      return;
    }
    const value = digits || format.demo;
    setDigits(value);
    setPhase('loading');
    try {
      const { accounts } = await api.billing.lookup({ type: mode, value });
      if (!accounts.length) {
        setPhase('notFound');
        return;
      }
      setStatement(await api.billing.statement(accounts[0].accountId, 6));
      setPhase('result');
    } catch {
      setPhase('error');
    }
  };

  const newSearch = () => {
    setDigits('');
    setStatement(null);
    setPrintPhase(null);
    setPhase('input');
  };

  const print = async () => {
    if (!statement) return;
    setPrintPhase('printing');
    try {
      await Promise.all([
        bridge.print({ kind: 'a4', template: 'statement', data: statement, lang }),
        delay(config.minPrintAnimationMs),
      ]);
      setPrintPhase('done');
    } catch {
      setPrintPhase('error');
    }
  };

  return (
    <main className="screen account">
      <div className="screen__grid" />

      <Header right={<BackButton label={t.common.toAssistant} onClick={() => go('assistant')} />} />

      <section className="account__intro">
        <div className="account__heading">
          <span className="eyebrow">{t.account.eyebrow}</span>
          <h1 className="display account__title">{t.account.title}</h1>
        </div>
        {config.useMocks && <span className="chip chip--demo">{t.common.demo}</span>}
      </section>

      {phase === 'input' && (
        <section className="account__body a-rise">
          <div className="segmented" role="radiogroup" aria-label={t.account.title}>
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={m === mode}
                className={`segmented__btn press${m === mode ? ' segmented__btn--active' : ''}`}
                onClick={() => pickMode(m)}
              >
                {t.account.modes[m]}
              </button>
            ))}
          </div>

          <div className="id-field">
            <span className="id-field__label" id="id-field-label">
              {t.account.fields[mode]}
            </span>
            <div
              key={invalid}
              className={`id-field__value mono${invalid ? ' id-field__value--invalid a-shake' : ''}`}
              aria-labelledby="id-field-label"
              aria-live="polite"
            >
              {fillTemplate(format.template, digits)}
            </div>
            <span className={`id-field__hint${invalid ? ' id-field__hint--error' : ''}`} role={invalid ? 'alert' : undefined}>
              {invalid ? t.account.needDigits(format.length) : t.account.demoHint}
            </span>
          </div>

          <Numpad
            onDigit={type}
            onErase={() => setDigits((v) => v.slice(0, -1))}
            onSubmit={find}
            submitLabel={t.account.find}
            eraseLabel={t.account.erase}
          />

          <div className="account__privacy">
            <Icon name="lock" size={32} color="var(--green)" />
            <span>{t.account.privacy(config.idleTimeoutSec)}</span>
          </div>
        </section>
      )}

      {phase === 'loading' && (
        <section className="account__body" aria-busy="true">
          <div className="card account__loading">
            <div className="spinner a-spin" />
            <div className="account__loading-text">
              <strong>{t.account.loading}</strong>
              <span>{masked}</span>
            </div>
          </div>
          <div className="card skeleton a-shimmer" style={{ height: 300 }} />
          <div className="card skeleton a-shimmer" style={{ height: 320 }} />
          <div className="card skeleton a-shimmer" style={{ height: 420 }} />
        </section>
      )}

      {(phase === 'notFound' || phase === 'error') && (
        <section className="account__body account__body--center a-rise">
          <div className="card account__empty" role="alert">
            <div className="result-badge result-badge--error">
              <Icon name={phase === 'notFound' ? 'search' : 'wifiOff'} size={80} color="var(--red)" />
            </div>
            <h2 className="display">{phase === 'notFound' ? t.account.notFoundTitle : t.account.errorTitle}</h2>
            <p>{phase === 'notFound' ? t.account.notFoundText : t.account.errorText}</p>
            <span className="mono account__masked">{masked}</span>
            <div className="account__empty-actions">
              <button type="button" className="btn btn--cyan press" onClick={() => go('assistant')}>
                {t.account.askAi}
              </button>
              <button type="button" className="btn btn--light press" onClick={phase === 'error' ? find : newSearch}>
                {phase === 'error' ? t.common.retry : t.account.newSearch}
              </button>
            </div>
          </div>
        </section>
      )}

      {phase === 'result' && statement && (
        <StatementView
          statement={statement}
          masked={masked}
          onPrint={print}
          onAsk={() => go('assistant')}
          onNewSearch={newSearch}
        />
      )}

      <PrintOverlay
        phase={printPhase}
        variant="a4"
        printerName={t.account.printer}
        printingText={t.account.printing}
        paper={
          statement && (
            <>
              <strong style={{ fontSize: 20 }}>{t.account.statementTitle}</strong>
              <span style={{ color: 'var(--paper-muted)' }}>
                {statement.account.accountNumber} · {statement.account.holderMasked}
              </span>
              <div style={{ height: 2, background: 'var(--paper-ink)' }} />
              {[100, 80, 90, 70, 100, 60].map((w, i) => (
                <div key={i} style={{ height: 10, width: `${w}%`, borderRadius: 3, background: '#d9dde5' }} />
              ))}
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 20 }}>
                <span>{t.account.total}</span>
                <span>{formatMoney(Math.max(0, statement.balanceDue), lang)} ₸</span>
              </div>
            </>
          )
        }
        doneTitle={t.account.printedTitle}
        doneText={t.account.printedText}
        errorTitle={t.account.printErrorTitle}
        errorText={t.account.printErrorText}
        secondary={{ label: t.account.backToStatement, onClick: () => setPrintPhase(null) }}
        primary={{ label: t.common.finish, onClick: reset }}
      />
    </main>
  );
}

interface StatementViewProps {
  statement: Statement;
  masked: string;
  onPrint: () => void;
  onAsk: () => void;
  onNewSearch: () => void;
}

function StatementView({ statement, masked, onPrint, onAsk, onNewSearch }: StatementViewProps) {
  const t = useT();
  const { lang } = useKiosk().state;
  const a = statement.account;
  const due = statement.balanceDue;
  const asOf = formatDate(statement.asOf);
  const maxKwh = Math.max(...statement.periods.map((p) => p.consumptionKwh), 1);
  const chartSummary = statement.periods
    .map((p) => `${formatMonth(p.month, lang, 'short')} ${formatNumber(p.consumptionKwh, lang)}`)
    .join(', ');

  return (
    <section className="account__body account__body--result">
      <div className="card summary a-rise">
        <dl className="summary__grid">
          <div>
            <dt>{t.account.labels.account}</dt>
            <dd className="mono">{a.accountNumber}</dd>
          </div>
          <div>
            <dt>{t.account.labels.identifier}</dt>
            <dd className="mono summary__small">{masked}</dd>
          </div>
          <div>
            <dt>{t.account.labels.holder}</dt>
            <dd>{a.holderMasked}</dd>
          </div>
          <div>
            <dt>{t.account.labels.contract}</dt>
            <dd>{a.contract}</dd>
          </div>
          <div className="summary__wide">
            <dt>{t.account.labels.address}</dt>
            <dd>{a.address}</dd>
          </div>
        </dl>
        <div className={`balance${due > 0 ? '' : ' balance--ok'}`}>
          <span className="balance__label">
            {due > 0 ? t.account.due(asOf) : due < 0 ? t.account.overpay(asOf) : t.account.noDebt}
          </span>
          <span className="display balance__amount tabular">{formatMoney(Math.abs(due), lang)} ₸</span>
          {statement.lastPayment && (
            <span className="balance__last">
              {t.account.lastPay(formatMoney(statement.lastPayment.amount, lang), formatDate(statement.lastPayment.date).slice(0, 5))}
            </span>
          )}
        </div>
      </div>

      <div className="card chart a-rise" style={{ animationDelay: '60ms' }}>
        <div className="chart__head">
          <span className="chart__title">{t.account.consumption}</span>
          <span className="chart__period">
            {formatMonth(statement.periods[0].month, lang)} — {formatMonth(statement.periods[statement.periods.length - 1].month, lang)}
          </span>
        </div>
        <div className="chart__bars" role="img" aria-label={t.account.chartLabel(chartSummary)}>
          {statement.periods.map((p, i) => (
            <div key={p.month} className="chart__col">
              <span className="chart__value mono tabular">{formatNumber(p.consumptionKwh, lang)}</span>
              <div
                className={`chart__bar a-grow${i === statement.periods.length - 1 ? ' chart__bar--current' : ''}`}
                style={{ height: Math.round((p.consumptionKwh / maxKwh) * 150), animationDelay: `${i * 50}ms` }}
              />
              <span className="chart__month">{formatMonth(p.month, lang, 'short')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card periods a-rise" style={{ animationDelay: '120ms' }}>
        <table>
          <thead>
            <tr>
              <th scope="col">{t.account.table.month}</th>
              <th scope="col">{t.account.table.kwh}</th>
              <th scope="col">{t.account.table.charged}</th>
              <th scope="col">{t.account.table.paid}</th>
            </tr>
          </thead>
          <tbody>
            {statement.periods.map((p) => (
              <tr key={p.month}>
                <th scope="row">{formatMonth(p.month, lang)}</th>
                <td className="mono tabular">{formatNumber(p.consumptionKwh, lang)}</td>
                <td className="mono tabular">{formatMoney(p.charged, lang)}</td>
                <td className={`mono tabular${p.paid < p.charged ? ' periods__underpaid' : ''}`}>{formatMoney(p.paid, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="account__result-actions">
        <button type="button" className="btn btn--primary press" onClick={onPrint}>
          <Icon name="printer" size={40} color="var(--ink)" />
          <span>{t.account.printA4}</span>
        </button>
        <button type="button" className="btn btn--cyan press" onClick={onAsk}>
          {t.account.askAi}
        </button>
        <button type="button" className="btn btn--ghost press" onClick={onNewSearch}>
          {t.account.newSearch}
        </button>
      </div>
    </section>
  );
}

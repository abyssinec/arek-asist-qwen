import { createPortal } from 'react-dom';
import type { Lang, ServiceDocuments, Statement } from '../api/types';
import { config } from '../config';
import { usePrintJob } from '../devices/printStore';
import { dictionaries } from '../i18n';
import { formatDate, formatMoney, formatMonth, formatNumber, formatStamp } from '../utils/format';

/**
 * Шаблоны для печати браузером (VITE_PRINT_MODE=browser).
 * В режиме bridge эти же данные уходят агенту устройств, и вёрстку чека делает он.
 */
export function PrintArea() {
  const job = usePrintJob();
  const root = document.getElementById('print-root');
  if (!job || !root) return null;
  return createPortal(
    job.kind === 'receipt' ? (
      <ReceiptPrint data={job.data} lang={job.lang} />
    ) : (
      <StatementPrint data={job.data} lang={job.lang} />
    ),
    root,
  );
}

function ReceiptPrint({ data, lang }: { data: ServiceDocuments; lang: Lang }) {
  const t = dictionaries[lang];
  const r = t.docs.receipt;
  return (
    <div className="print-receipt">
      <h1>{t.brand.name.toUpperCase()}</h1>
      <div className="center">{r.center}</div>
      <div className="rule" />
      <div className="row">
        <span>{formatStamp(new Date())}</span>
        <span>№ {data.ticket}</span>
      </div>
      <div className="rule" />
      <strong>
        {r.service}: {data.title}
      </strong>
      <div className="rule" />
      <strong>{r.documents}:</strong>
      <ol>
        {data.documents.map((d) => (
          <li key={d.id}>[ ] {d.title}</li>
        ))}
      </ol>
      <div className="rule" />
      <div>
        {r.where}: {t.docs.place(data.office.address, data.office.room)}
      </div>
      {data.office.phone && (
        <div>
          {r.phone}: {data.office.phone}
        </div>
      )}
      <div>
        {r.hours}: {r.days} {data.hours.weekdays}
      </div>
      {data.hours.lunch && (
        <div>
          {r.lunch}: {data.hours.lunch}
        </div>
      )}
      {data.note && (
        <>
          <div className="rule" />
          <strong>{data.note}</strong>
        </>
      )}
    </div>
  );
}

function StatementPrint({ data, lang }: { data: Statement; lang: Lang }) {
  const t = dictionaries[lang];
  const a = t.account;
  return (
    <div className="print-a4">
      <header>
        <div>
          <div>{t.brand.name}</div>
          <h1>{a.statementTitle}</h1>
        </div>
        <div>{formatDate(data.asOf)}</div>
      </header>
      <dl>
        <dt>{a.labels.account}</dt>
        <dd>{data.account.accountNumber}</dd>
        <dt>{a.labels.holder}</dt>
        <dd>{data.account.holderMasked}</dd>
        <dt>{a.labels.contract}</dt>
        <dd>{data.account.contract}</dd>
        <dt>{a.labels.address}</dt>
        <dd>{data.account.address}</dd>
      </dl>
      <table>
        <thead>
          <tr>
            <th>{a.table.month}</th>
            <th>{a.table.kwh}</th>
            <th>{a.table.charged}</th>
            <th>{a.table.paid}</th>
          </tr>
        </thead>
        <tbody>
          {data.periods.map((p) => (
            <tr key={p.month}>
              <td>{formatMonth(p.month, lang)}</td>
              <td>{formatNumber(p.consumptionKwh, lang)}</td>
              <td>{formatMoney(p.charged, lang)}</td>
              <td>{formatMoney(p.paid, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="total">
        <span>{a.total}</span>
        <span>{formatMoney(Math.max(0, data.balanceDue), lang)} ₸</span>
      </div>
      <footer>{a.generated(formatStamp(new Date()), config.kioskId)}</footer>
    </div>
  );
}

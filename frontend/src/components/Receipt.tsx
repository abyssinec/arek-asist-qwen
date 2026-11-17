import type { ServiceDocuments } from '../api/types';
import { useT } from '../i18n';
import './Receipt.css';

/** Превью термочека со списком документов (как его увидит человек на ленте 80 мм). */
export function Receipt({ data, stamp }: { data: ServiceDocuments; stamp: string }) {
  const t = useT();
  const r = t.docs.receipt;
  return (
    <article className="receipt" aria-label={data.title}>
      <div className="receipt__head">
        <span className="receipt__brand">{t.brand.name.toUpperCase()}</span>
        <span className="receipt__muted">{r.center}</span>
      </div>
      <div className="receipt__row receipt__muted">
        <span>{stamp}</span>
        <span>№ {data.ticket}</span>
      </div>
      <hr className="receipt__rule" />
      <strong>
        {r.service}: {data.title.toUpperCase()}
      </strong>
      <hr className="receipt__rule" />
      <strong>{r.documents}:</strong>
      <ol className="receipt__list">
        {data.documents.map((doc, i) => (
          <li key={doc.id}>
            <span className="receipt__box" aria-hidden="true" />
            <span>
              {i + 1}. {doc.title}
            </span>
          </li>
        ))}
      </ol>
      <hr className="receipt__rule" />
      <div className="receipt__info">
        <span>
          <b>{r.where}:</b> {t.docs.place(data.office.address, data.office.room)}
        </span>
        {data.office.phone && (
          <span>
            <b>{r.phone}:</b> {data.office.phone}
          </span>
        )}
        <span>
          <b>{r.hours}:</b> {r.days} {data.hours.weekdays}
        </span>
        {data.hours.lunch && (
          <span>
            <b>{r.lunch}:</b> {data.hours.lunch}
          </span>
        )}
      </div>
      {data.note && (
        <>
          <hr className="receipt__rule" />
          <strong className="receipt__note">{data.note}</strong>
        </>
      )}
      <hr className="receipt__rule" />
      <div className="receipt__qr">
        <QrPlaceholder />
        <span className="receipt__muted">{r.qr}</span>
      </div>
    </article>
  );
}

/** Заглушка QR. Что кодировать (ссылка на список / номер обращения) — открытый вопрос к заказчику. */
export function QrPlaceholder({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M0 0h7v7H0zM1 1v5h5V1zM2 2h3v3H2zM14 0h7v7h-7zM15 1v5h5V1zM16 2h3v3h-3zM0 14h7v7H0zM1 15v5h5v-5zM2 16h3v3H2zM8 0h1v1H8zM10 0h2v2h-2zM9 2h1v2H9zM11 3h2v1h-2zM8 5h2v2H8zM12 5h1v3h-1zM8 8h3v1H8zM0 8h2v1H0zM3 8h2v2H3zM6 9h2v1H6zM13 8h2v2h-2zM16 8h1v2h-1zM18 8h3v1h-3zM1 10h1v2H1zM9 10h2v2H9zM12 11h3v1h-3zM17 11h2v2h-2zM0 12h3v1H0zM5 12h2v1H5zM8 13h1v3H8zM10 13h3v2h-3zM14 13h2v1h-2zM20 12h1v3h-1zM15 15h3v1h-3zM10 16h2v2h-2zM13 16h1v2h-1zM19 16h2v1h-2zM8 18h1v3H8zM15 17h2v3h-2zM11 19h3v2h-3zM18 18h2v1h-2zM19 20h2v1h-2z"
      />
    </svg>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { ServiceDocuments } from '../api/types';
import { useKiosk } from '../app/store';
import { useNow } from '../app/useNow';
import { BackButton, Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { PrintOverlay, type PrintPhase } from '../components/PrintOverlay';
import { Receipt } from '../components/Receipt';
import { config } from '../config';
import { bridge } from '../devices/bridge';
import { useT } from '../i18n';
import { formatStamp } from '../utils/format';
import { delay } from '../utils/misc';
import './DocumentsScreen.css';

/** Экран 3 · Список документов: превью термочека «как в банкомате» и кнопка ПЕЧАТЬ. */
export function DocumentsScreen() {
  const { state, go, reset } = useKiosk();
  const t = useT();
  const now = useNow(30000);
  const [data, setData] = useState<ServiceDocuments | null>(null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<PrintPhase>(null);

  const load = useCallback(() => {
    let alive = true;
    setFailed(false);
    setData(null);
    api.services
      .getDocuments(state.serviceCode, state.lang)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [state.serviceCode, state.lang]);

  useEffect(load, [load]);

  const print = async () => {
    if (!data) return;
    setPhase('printing');
    try {
      await Promise.all([
        bridge.print({ kind: 'receipt', template: 'documents', data, lang: state.lang }),
        delay(config.minPrintAnimationMs),
      ]);
      setPhase('done');
    } catch {
      setPhase('error');
    }
  };

  return (
    <main className="screen docs">
      <div className="screen__grid" />

      <Header right={<BackButton label={t.common.toAssistant} onClick={() => go('assistant')} />} />

      <section className="docs__intro">
        <span className="eyebrow">{data?.category ?? ' '}</span>
        <h1 className="display docs__title">{data?.title ?? t.docs.loading}</h1>
        <div className="docs__chips">
          {data && <span className="chip">{data.audience}</span>}
          {data && <span className="chip">{t.docs.count(data.documents.length)}</span>}
          {config.useMocks && <span className="chip chip--demo">{t.common.demo}</span>}
        </div>
      </section>

      <section className="docs__well" aria-busy={!data && !failed}>
        {data && <Receipt data={data} stamp={formatStamp(now)} />}
        {!data && !failed && <div className="docs__skeleton a-shimmer" />}
        {failed && (
          <div className="docs__error">
            <Icon name="wifiOff" size={64} color="var(--red)" />
            <p>{t.docs.loadError}</p>
            <button type="button" className="btn btn--ghost press" onClick={load}>
              {t.common.retry}
            </button>
          </div>
        )}
      </section>

      <section className="docs__actions">
        <div className="docs__tray">
          <span className="dot a-glow" style={{ color: 'var(--amber)' }} />
          <div className="docs__slot" />
          <span>{t.docs.tray}</span>
        </div>
        <div className="docs__buttons">
          <button type="button" className="btn btn--ghost docs__back press" onClick={() => go('assistant')}>
            <Icon name="back" size={30} />
            <span>{t.common.back}</span>
          </button>
          <button type="button" className="btn btn--primary docs__print press" onClick={print} disabled={!data}>
            <Icon name="printer" size={48} color="var(--ink)" />
            <span>{t.docs.print}</span>
          </button>
        </div>
      </section>

      <PrintOverlay
        phase={phase}
        variant="receipt"
        printerName={t.docs.printer}
        printingText={t.docs.printing}
        paper={
          data && (
            <>
              <strong style={{ textAlign: 'center', letterSpacing: '0.08em' }}>{t.brand.name.toUpperCase()}</strong>
              <hr className="receipt__rule" />
              {data.documents.map((d) => (
                <span key={d.id}>[ ] {d.title}</span>
              ))}
              <hr className="receipt__rule" />
              <strong>{t.docs.place(data.office.address, data.office.room).toUpperCase()}</strong>
            </>
          )
        }
        doneTitle={t.docs.doneTitle}
        doneText={data ? t.docs.doneText(t.docs.place(data.office.address, data.office.room), data.ticket) : ''}
        errorTitle={t.docs.errorTitle}
        errorText={t.docs.errorText}
        secondary={
          phase === 'error'
            ? { label: t.common.retry, onClick: () => { setPhase(null); void print(); } }
            : { label: t.docs.printAgain, onClick: () => setPhase(null) }
        }
        primary={phase === 'error' ? { label: t.common.back, onClick: () => setPhase(null) } : { label: t.common.finish, onClick: reset }}
      />
    </main>
  );
}

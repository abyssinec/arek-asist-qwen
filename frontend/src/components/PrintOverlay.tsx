import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import './PrintOverlay.css';

export type PrintPhase = 'printing' | 'done' | 'error' | null;

interface Action {
  label: string;
  onClick: () => void;
}

interface PrintOverlayProps {
  phase: PrintPhase;
  variant: 'receipt' | 'a4';
  printerName: string;
  printingText: string;
  /** Содержимое листа, «выезжающего» из принтера. */
  paper: ReactNode;
  doneTitle: string;
  doneText: string;
  errorTitle: string;
  errorText: string;
  primary: Action;
  secondary: Action;
}

/** Полноэкранная анимация печати: процесс → «заберите» или ошибка принтера. */
export function PrintOverlay(p: PrintOverlayProps) {
  return (
    <AnimatePresence>
      {p.phase && (
        <motion.div
          key="print-overlay"
          className="print-overlay"
          role="dialog"
          aria-modal="true"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          transition={{ duration: 0.28 }}
        >
          {p.phase === 'printing' && (
            <div className="print-overlay__stack">
              <div className={`printer printer--${p.variant}`}>
                <div className="printer__body">
                  <span>{p.printerName}</span>
                  <span className="printer__led a-glow" />
                </div>
                <div className="printer__slot" />
                <div className="printer__window">
                  <div className={`printer__paper printer__paper--${p.variant} a-slip`}>{p.paper}</div>
                </div>
              </div>
              <div className="print-overlay__progress">
                <span className="display print-overlay__label">{p.printingText}</span>
                <div className="progress">
                  <div className="progress__fill" />
                </div>
              </div>
            </div>
          )}

          {p.phase === 'done' && (
            <div className="print-overlay__result">
              <div className="result-badge result-badge--ok a-pop">
                <Icon name="check" size={96} strokeWidth={2.4} color="var(--green)" />
              </div>
              <h2 className="display print-overlay__title">{p.doneTitle}</h2>
              <p className="print-overlay__text">{p.doneText}</p>
              {p.variant === 'receipt' && <Icon name="arrowDown" size={72} color="var(--amber)" className="a-bob" />}
              <div className="print-overlay__actions">
                <button type="button" className="btn btn--ghost press" onClick={p.secondary.onClick}>
                  {p.secondary.label}
                </button>
                <button type="button" className="btn btn--light press" onClick={p.primary.onClick}>
                  {p.primary.label}
                </button>
              </div>
            </div>
          )}

          {p.phase === 'error' && (
            <div className="print-overlay__result">
              <div className="result-badge result-badge--error a-pop">
                <Icon name="alert" size={88} strokeWidth={2.2} color="var(--red)" />
              </div>
              <h2 className="display print-overlay__title">{p.errorTitle}</h2>
              <p className="print-overlay__text">{p.errorText}</p>
              <div className="print-overlay__actions">
                <button type="button" className="btn btn--ghost press" onClick={p.secondary.onClick}>
                  {p.secondary.label}
                </button>
                <button type="button" className="btn btn--light press" onClick={p.primary.onClick}>
                  {p.primary.label}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

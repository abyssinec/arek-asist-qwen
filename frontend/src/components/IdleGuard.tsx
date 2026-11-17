import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useKiosk } from '../app/store';
import { config } from '../config';
import { bridge } from '../devices/bridge';
import { useT } from '../i18n';
import './IdleGuard.css';

const R = 88;
const CIRCLE = 2 * Math.PI * R;

/**
 * Таймаут бездействия: за idleWarningSec до конца показывает «Вы ещё здесь?»,
 * по истечении — сбрасывает сессию (данные человека удаляются) и возвращает заставку.
 * Касание экрана или сигнал датчика присутствия продлевают сессию.
 */
export function IdleGuard() {
  const { state, reset } = useKiosk();
  const t = useT();
  const [left, setLeft] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());
  const active = state.screen !== 'attract';

  useEffect(() => {
    if (!active) {
      setLeft(null);
      return;
    }
    lastActivity.current = Date.now();
    const bump = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener('pointerdown', bump, { passive: true });
    window.addEventListener('keydown', bump);
    const offPresence = bridge.onPresence((present) => present && bump());
    const timer = window.setInterval(() => {
      const idle = (Date.now() - lastActivity.current) / 1000;
      if (idle >= config.idleTimeoutSec) {
        setLeft(null);
        reset();
        return;
      }
      const remaining = Math.ceil(config.idleTimeoutSec - idle);
      setLeft(remaining <= config.idleWarningSec ? remaining : null);
    }, 250);
    return () => {
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
      offPresence();
      clearInterval(timer);
    };
  }, [active, reset]);

  const progress = left === null ? 0 : left / config.idleWarningSec;

  return (
    <AnimatePresence>
      {left !== null && (
        <motion.div
          key="idle"
          className="idle"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="idle-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          <motion.div className="idle__card" initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}>
            <div className="idle__ring">
              <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
                <circle
                  cx="100"
                  cy="100"
                  r={R}
                  fill="none"
                  stroke="var(--amber)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={CIRCLE}
                  strokeDashoffset={CIRCLE * (1 - progress)}
                  transform="rotate(-90 100 100)"
                  style={{ transition: 'stroke-dashoffset 250ms linear' }}
                />
              </svg>
              <span className="idle__count display tabular">{left}</span>
            </div>
            <h2 id="idle-title" className="display idle__title">
              {t.idle.title}
            </h2>
            <p className="idle__text">{t.idle.text(left)}</p>
            <div className="idle__actions">
              <button type="button" className="btn btn--ghost press" onClick={reset}>
                {t.idle.end}
              </button>
              <button type="button" className="btn btn--primary press" onClick={() => setLeft(null)}>
                {t.idle.stay}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

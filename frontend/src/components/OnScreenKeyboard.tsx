import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { Lang } from '../api/types';
import { useKiosk } from '../app/store';
import { useT } from '../i18n';
import { Icon } from './Icon';
import './OnScreenKeyboard.css';

const LAYOUTS: Record<Lang, string[]> = {
  ru: ['1234567890', 'йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'],
  kk: ['1234567890', 'әіңғүұқөһ', 'йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'],
  en: ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
};

const MAX_LENGTH = 200;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

/** Экранная клавиатура для текстового вопроса (раскладка следует языку интерфейса). */
export function OnScreenKeyboard({ open, onClose, onSubmit }: Props) {
  const { lang } = useKiosk().state;
  const t = useT();
  const [text, setText] = useState('');

  const type = (ch: string) => setText((v) => (v + ch).slice(0, MAX_LENGTH));
  const erase = () => setText((v) => v.slice(0, -1));
  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onSubmit(value.charAt(0).toUpperCase() + value.slice(1));
    setText('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="osk"
          className="osk"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
        >
          <button type="button" className="osk__scrim" aria-label={t.keyboard.close} onClick={onClose} />
          <motion.div
            className="osk__sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t.keyboard.title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className="osk__top">
              <span className="osk__title">{t.keyboard.title}</span>
              <button type="button" className="osk__close press" onClick={onClose} aria-label={t.keyboard.close}>
                <Icon name="close" size={32} />
              </button>
            </div>
            <div className="osk__field-row">
              <div className="osk__field" aria-live="polite">
                {text ? <span>{text}</span> : <span className="osk__placeholder">{t.keyboard.placeholder}</span>}
                <span className="osk__caret a-caret" aria-hidden="true" />
              </div>
              <button type="button" className="osk__send press" onClick={submit} disabled={!text.trim()}>
                <Icon name="send" size={34} />
                <span>{t.keyboard.send}</span>
              </button>
            </div>
            <div className="osk__rows">
              {LAYOUTS[lang].map((row) => (
                <div key={row} className="osk__row">
                  {[...row].map((ch) => (
                    <button key={ch} type="button" className="osk__key press" onClick={() => type(ch)}>
                      {ch}
                    </button>
                  ))}
                </div>
              ))}
              <div className="osk__row">
                <button type="button" className="osk__key press" onClick={() => type(',')}>
                  ,
                </button>
                <button type="button" className="osk__key press" onClick={() => type('.')}>
                  .
                </button>
                <button type="button" className="osk__key osk__key--space press" onClick={() => type(' ')}>
                  {t.keyboard.space}
                </button>
                <button type="button" className="osk__key press" onClick={() => type('?')}>
                  ?
                </button>
                <button type="button" className="osk__key osk__key--wide press" onClick={erase} aria-label={t.keyboard.erase}>
                  <Icon name="backspace" size={40} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

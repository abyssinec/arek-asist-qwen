import type { MouseEvent, ReactNode } from 'react';
import { useKiosk } from '../app/store';
import { useNow } from '../app/useNow';
import { LANGS, dictionaries, useT } from '../i18n';
import { formatDay, formatTime } from '../utils/format';
import { Icon } from './Icon';
import './Header.css';

export function Header({ right }: { right?: ReactNode }) {
  const t = useT();
  return (
    <header className="header">
      <div className="header__brand">
        <div className="header__logo">
          <Icon name="bolt" size={38} color="var(--ink)" strokeWidth={2.2} />
        </div>
        <div className="header__brand-text">
          <span className="header__name">{t.brand.name}</span>
          <span className="header__sub">{t.brand.sub}</span>
        </div>
      </div>
      {right && <div className="header__right">{right}</div>}
    </header>
  );
}

export function LangSwitch() {
  const { state, setLang } = useKiosk();
  const t = useT();
  // stopPropagation: на заставке тап по экрану запускает консультацию, а смена языка — нет.
  const pick = (e: MouseEvent, lang: (typeof LANGS)[number]) => {
    e.stopPropagation();
    setLang(lang);
  };
  return (
    <div className="lang" role="group" aria-label={t.common.langLabel}>
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          aria-pressed={state.lang === lang}
          className={`lang__btn press${state.lang === lang ? ' lang__btn--active' : ''}`}
          onClick={(e) => pick(e, lang)}
        >
          {dictionaries[lang].short}
        </button>
      ))}
    </div>
  );
}

export function Clock() {
  const now = useNow();
  const { lang } = useKiosk().state;
  return (
    <div className="clock">
      <span className="clock__time mono tabular">{formatTime(now, lang)}</span>
      <span className="clock__date">{formatDay(now, lang)}</span>
    </div>
  );
}

export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="pill press" onClick={onClick}>
      <Icon name="back" size={26} />
      <span>{label}</span>
    </button>
  );
}

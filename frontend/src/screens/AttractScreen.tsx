import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PLAYLIST, api } from '../api';
import type { PlaylistItem, SlideId } from '../api/types';
import { useKiosk } from '../app/store';
import { BotAvatar } from '../components/BotAvatar';
import { Clock, Header, LangSwitch } from '../components/Header';
import { Icon } from '../components/Icon';
import { config } from '../config';
import { bridge } from '../devices/bridge';
import { useT } from '../i18n';
import './AttractScreen.css';

/** Экран 1 · Режим ожидания: ролики/слайды по кругу. Касание или датчик присутствия → консультант. */
export function AttractScreen() {
  const { go } = useKiosk();
  const t = useT();
  const [items, setItems] = useState<PlaylistItem[]>(DEFAULT_PLAYLIST.items);
  const [step, setStep] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);

  const index = step % items.length;
  const item = items[index];
  const next = useCallback(() => {
    setVideoProgress(0);
    setStep((s) => s + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    api.content
      .playlist()
      .then((p) => alive && p.items.length && setItems(p.items))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (item.type !== 'slide') return;
    const timer = setTimeout(next, item.durationMs ?? config.slideDurationMs);
    return () => clearTimeout(timer);
  }, [item, step, next]);

  useEffect(() => bridge.onPresence((present) => present && go('assistant')), [go]);

  const start = () => go('assistant');
  const slideMs = item.type === 'slide' ? (item.durationMs ?? config.slideDurationMs) : 0;

  return (
    <main className="screen attract" onClick={start}>
      <div className="screen__grid" />
      <div className="screen__glow attract__glow" />

      <Header
        right={
          <>
            <LangSwitch />
            <Clock />
          </>
        }
      />

      <section className="attract__stage" aria-roledescription="carousel">
        <div className="attract__bars">
          {items.map((it, i) => (
            <div key={it.id} className="attract__track">
              {i < index && <div className="attract__fill attract__fill--done" />}
              {i === index &&
                (it.type === 'slide' ? (
                  <div key={step} className="attract__fill attract__fill--run" style={{ animationDuration: `${slideMs}ms` }} />
                ) : (
                  <div className="attract__fill attract__fill--done" style={{ transform: `scaleX(${videoProgress})` }} />
                ))}
            </div>
          ))}
        </div>
        <div className="attract__badge">
          <Icon name="video" size={20} color="var(--text-muted)" />
          <span>{t.attract.video(index + 1, items.length)}</span>
        </div>

        {item.type === 'video' ? (
          <video
            key={`${item.id}-${step}`}
            className="attract__video"
            src={item.src}
            poster={item.poster}
            autoPlay
            muted
            playsInline
            onEnded={next}
            onError={next}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setVideoProgress(v.currentTime / v.duration);
            }}
          />
        ) : (
          <Slide key={step} id={item.slide} />
        )}
      </section>

      <section className="attract__bottom">
        <BotAvatar mode="idle" />
        <div className="attract__cta">
          <span className="attract__hello">{t.attract.hello}</span>
          <h2 className="display attract__title">{t.attract.title}</h2>
          <button type="button" className="btn btn--primary attract__start a-pulse-amber press" onClick={start}>
            <Icon name="mic" size={40} color="var(--ink)" strokeWidth={2.2} />
            <span>{t.attract.start}</span>
          </button>
          <div className="attract__sensor">
            <span className="dot a-glow" style={{ color: 'var(--green)' }} />
            <span>{t.attract.sensor}</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function Slide({ id }: { id: SlideId }) {
  const t = useT();
  const s = t.attract.slides[id];
  return (
    <div className="slide a-rise">
      <div className="slide__copy">
        <span className="eyebrow">{s.eyebrow}</span>
        <h1 className="display slide__title">{s.title}</h1>
        <p className="slide__text">{s.text}</p>
      </div>
      {id === 'balance' && <BalanceVisual />}
      {id === 'documents' && <ReceiptVisual />}
      {id === 'voice' && <VoiceVisual />}
    </div>
  );
}

const BAR_HEIGHTS = [60, 48, 42, 56, 78, 100];

function BalanceVisual() {
  const t = useT();
  return (
    <div className="visual-card" aria-hidden="true">
      <div className="visual-card__top">
        <span>{t.attract.card.account}</span>
      </div>
      <div className="visual-card__amount">
        <span>{t.attract.card.due}</span>
        <strong className="display">12 480 ₸</strong>
      </div>
      <div className="visual-card__bars">
        {BAR_HEIGHTS.map((h, i) => (
          <div key={i} style={{ height: `${h}%` }} className={i === BAR_HEIGHTS.length - 1 ? 'is-current' : undefined} />
        ))}
      </div>
    </div>
  );
}

function ReceiptVisual() {
  const r = useT().attract.receipt;
  return (
    <div className="visual-receipt" aria-hidden="true">
      <strong>{r.title}</strong>
      <hr />
      {r.lines.map((line, i) => (
        <span key={line}>
          {i < 3 ? '[x]' : '[ ]'} {line}
        </span>
      ))}
      <hr />
      <strong>{r.place}</strong>
    </div>
  );
}

function VoiceVisual() {
  return (
    <div className="visual-voice" aria-hidden="true">
      {[0, 1, 2, 3, 4, 2, 1, 0].map((d, i) => (
        <span key={i} className={i === 3 ? 'is-accent' : undefined} style={{ animationDelay: `${d * 0.12}s` }} />
      ))}
    </div>
  );
}

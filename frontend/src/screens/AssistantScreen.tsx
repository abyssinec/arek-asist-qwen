import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { ChatAction } from '../api/types';
import { useKiosk, type ChatMessage } from '../app/store';
import { BotAvatar, type BotMode } from '../components/BotAvatar';
import { BackButton, Header, LangSwitch } from '../components/Header';
import { Icon, type IconName } from '../components/Icon';
import { OnScreenKeyboard } from '../components/OnScreenKeyboard';
import { config } from '../config';
import { useT } from '../i18n';
import type { Dict } from '../i18n/ru';
import { formatSeconds } from '../utils/format';
import { uid } from '../utils/misc';
import { speak, stopSpeaking } from '../voice/tts';
import { unlockPlayback } from '../voice/audio';
import { useRecorder } from '../voice/useRecorder';
import './AssistantScreen.css';

type TopicId = keyof Dict['assistant']['topics'];

const TOPICS: { id: TopicId; icon: IconName }[] = [
  { id: 'balance', icon: 'wallet' },
  { id: 'connect', icon: 'plug' },
  { id: 'readings', icon: 'gauge' },
  { id: 'tariff', icon: 'bolt' },
  { id: 'payment', icon: 'card' },
  { id: 'outage', icon: 'alert' },
];

/** Экран 2 · AI-консультант: голос, быстрые темы, диалог с карточками-действиями. */
export function AssistantScreen() {
  const { state, go, addMessages, reset } = useKiosk();
  const t = useT();
  const [mode, setMode] = useState<BotMode>('idle');
  const [starting, setStarting] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Громкость микрофона → CSS-переменная --mic (без перерисовки React на каждом кадре).
  const setLevel = useCallback((level: number) => {
    rootRef.current?.style.setProperty('--mic', level.toFixed(3));
  }, []);
  const recorder = useRecorder(setLevel);
  const busy = mode === 'thinking';
  // Номер текущего запроса: ответ устаревшего запроса не должен менять состояние бота.
  const turnRef = useRef(0);
  const sessionRef = useRef(state.sessionId);
  sessionRef.current = state.sessionId;

  useEffect(() => {
    const el = listRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [state.chat.length, mode]);

  useEffect(() => () => { turnRef.current++; api.ai.cancel?.(); stopSpeaking(); }, []);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    if (config.ttsEnabled) unlockPlayback();
    stopSpeaking();
    const turn = ++turnRef.current;
    const session = state.sessionId;
    const isCurrent = () => turn === turnRef.current && session === sessionRef.current;
    const userMessage: ChatMessage = { id: uid(), role: 'user', text };
    addMessages([userMessage]);
    setMode('thinking');
    try {
      const history = [...state.chat, userMessage]
        .filter((m) => !m.error)
        .slice(-10)
        .map(({ role, text: body }) => ({ role, text: body }));
      const res = await api.ai.chat({
        sessionId: state.sessionId,
        kioskId: config.kioskId,
        lang: state.lang,
        text,
        history,
      });
      if (!isCurrent()) return;
      addMessages([{ id: uid(), role: 'assistant', text: res.reply, actions: res.actions }]);
      setMode('speaking');
      await speak(res.reply, res.replyLang ?? state.lang);
    } catch (e) {
      if (!isCurrent() || (e instanceof DOMException && e.name === 'AbortError')) return;
      addMessages([{ id: uid(), role: 'assistant', text: t.assistant.errors.network, error: true }]);
    }
    if (isCurrent()) setMode((m) => (m === 'speaking' || m === 'thinking' ? 'idle' : m));
  };

  const finishRecording = async () => {
    const turn = ++turnRef.current, session = state.sessionId;
    const current = () => turn === turnRef.current && session === sessionRef.current;
    const audio = await recorder.stop();
    if (!current()) return;
    setMode('thinking');
    try {
      const { text } = await api.ai.stt(audio, state.lang);
      if (!current()) return;
      if (text.trim()) {
        await send(text);
        return;
      }
      addMessages([{ id: uid(), role: 'assistant', text: t.assistant.errors.stt, error: true }]);
    } catch {
      if (!current()) return;
      addMessages([{ id: uid(), role: 'assistant', text: t.assistant.errors.stt, error: true }]);
    }
    setMode('idle');
  };

  const toggleMic = async () => {
    if (config.ttsEnabled) unlockPlayback();
    if (recorder.recording) return finishRecording();
    if (starting || busy) return;
    stopSpeaking();
    setStarting(true);
    await recorder.start();
    setStarting(false);
    setMode('listening');
  };

  // Автостоп длинной записи.
  useEffect(() => {
    if (recorder.recording && recorder.elapsed >= config.maxRecordingSec) void finishRecording();
  }, [recorder.recording, recorder.elapsed]);

  const runAction = (action: ChatAction) => {
    stopSpeaking();
    if (action.type === 'open_documents') go('documents', action.serviceCode);
    else go('account');
  };

  const listening = recorder.recording;

  return (
    <main ref={rootRef} className="screen assistant">
      <div className="screen__grid" />
      <div className="screen__glow assistant__glow" />

      <Header right={<LangSwitch />} />

      <nav className="assistant__nav">
        <BackButton label={t.common.toMain} onClick={reset} />
        <span className="chip chip--online">
          <span className="dot a-glow" />
          {t.assistant.online}
        </span>
      </nav>

      <section className="assistant__hero">
        <BotAvatar mode={mode} />
        <AnimatePresence mode="wait">
          <motion.span
            key={mode}
            className={`display assistant__status assistant__status--${mode}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            transition={{ duration: 0.22 }}
            aria-live="polite"
          >
            {t.assistant.status[mode]}
          </motion.span>
        </AnimatePresence>
      </section>

      <section className="chat card" ref={listRef} aria-live="polite">
        <div className="chat__inner">
          <div className="bubble bubble--bot">{t.assistant.greeting}</div>
          <AnimatePresence initial={false}>
            {state.chat.map((m) => (
              <motion.div
                key={m.id}
                className={`bubble ${m.role === 'user' ? 'bubble--user' : 'bubble--bot'}${m.error ? ' bubble--error' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <span>{m.text}</span>
                {m.actions?.map((a) => (
                  <ActionCard key={a.type + ('serviceCode' in a ? a.serviceCode : '')} action={a} onRun={runAction} />
                ))}
              </motion.div>
            ))}
            {listening && (
              <motion.div
                key="live"
                className="bubble bubble--user bubble--live"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span>{t.assistant.speakNow}</span>
                <span className="bubble__timer mono tabular">{formatSeconds(recorder.elapsed)}</span>
              </motion.div>
            )}
            {mode === 'thinking' && (
              <motion.div
                key="typing"
                className="bubble bubble--bot bubble--typing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                aria-label={t.assistant.status.thinking}
              >
                <span />
                <span />
                <span />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <section className="topics" aria-label={t.assistant.topicsLabel}>
        {TOPICS.map(({ id, icon }) => (
          <button
            key={id}
            type="button"
            className="topic press"
            disabled={busy || listening}
            onClick={() => send(t.assistant.topics[id].prompt)}
          >
            <Icon name={icon} size={34} color="var(--cyan)" />
            <span>{t.assistant.topics[id].label}</span>
          </button>
        ))}
      </section>

      <section className="dock">
        <button
          type="button"
          className="dock__side press"
          aria-label={t.assistant.keyboard}
          onClick={() => { if (config.ttsEnabled) unlockPlayback(); setKeyboardOpen(true); }}
          disabled={listening}
        >
          <Icon name="keyboard" size={40} />
        </button>
        <div className="dock__mic">
          <button
            type="button"
            className={`mic press ${listening ? 'mic--live a-pulse-cyan' : ''}`}
            aria-label={listening ? t.assistant.micStopAria : t.assistant.micStartAria}
            aria-pressed={listening}
            onClick={toggleMic}
            disabled={busy || starting}
          >
            <Icon name={listening ? 'stop' : 'mic'} size={listening ? 60 : 68} color="var(--ink)" />
          </button>
          <span className={`dock__label${listening ? ' dock__label--live' : ''}`}>
            {listening ? t.assistant.micStop : t.assistant.micStart}
          </span>
        </div>
        <button type="button" className="dock__side dock__side--end press" aria-label={t.assistant.end} onClick={reset}>
          <Icon name="close" size={40} color="var(--red)" strokeWidth={2.2} />
        </button>
      </section>

      <OnScreenKeyboard
        open={keyboardOpen}
        onClose={() => setKeyboardOpen(false)}
        onSubmit={(text) => {
          setKeyboardOpen(false);
          void send(text);
        }}
      />
    </main>
  );
}

function ActionCard({ action, onRun }: { action: ChatAction; onRun: (a: ChatAction) => void }) {
  const t = useT();
  const isDocs = action.type === 'open_documents';
  return (
    <button type="button" className="action-card press" onClick={() => onRun(action)}>
      <span className="action-card__icon">
        <Icon name={isDocs ? 'file' : 'wallet'} size={32} color="var(--amber)" />
      </span>
      <span className="action-card__text">
        <span className="action-card__title">
          {isDocs ? `${action.title} · ${t.assistant.docsCount(action.count)}` : action.title}
        </span>
        <span className="action-card__sub">{isDocs ? t.assistant.docsOpen : t.assistant.accountOpen}</span>
      </span>
      <Icon name="arrowRight" size={30} color="var(--amber)" strokeWidth={2.2} />
    </button>
  );
}

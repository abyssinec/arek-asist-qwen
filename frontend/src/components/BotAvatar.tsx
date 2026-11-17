import { Icon } from './Icon';
import './BotAvatar.css';

export type BotMode = 'idle' | 'listening' | 'thinking' | 'speaking';

interface BotAvatarProps {
  mode?: BotMode;
  /** Масштаб относительно базового размера 360×440. */
  scale?: number;
}

/**
 * Анимированный аватар консультанта. Четыре состояния:
 * idle — парит и моргает; listening — эквалайзер от громкости микрофона (CSS-переменная --mic
 * на любом родителе); thinking — смотрит вверх, точки; speaking — эквалайзер «речи».
 */
export function BotAvatar({ mode = 'idle', scale = 1 }: BotAvatarProps) {
  return (
    <div className="bot-slot" style={{ width: 360 * scale, height: 440 * scale }} aria-hidden="true">
      <div className={`bot bot--${mode}`} style={{ transform: `scale(${scale})` }}>
        <div className="bot__body a-float">
          {mode === 'thinking' ? (
            <div className="bot__ring bot__ring--dashed a-spin" />
          ) : (
            <>
              <div className={`bot__ring ${mode === 'listening' ? 'a-ring-fast' : 'a-ring'}`} />
              <div className={`bot__ring a-delay-half ${mode === 'listening' ? 'a-ring-fast' : 'a-ring'}`} />
            </>
          )}
          <div className="bot__antenna" />
          <div className="bot__tip a-glow" />
          <div className="bot__ear bot__ear--left" />
          <div className="bot__ear bot__ear--right" />
          <div className="bot__head">
            <div className="bot__face">
              <div className="bot__eyes a-look">
                <div className="bot__eye a-blink" />
                <div className="bot__eye a-blink" />
              </div>
              <div className="bot__mouth">
                {mode === 'idle' && <div className="bot__smile" />}
                {mode === 'thinking' && (
                  <div className="bot__dots">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
                {(mode === 'listening' || mode === 'speaking') && (
                  <div className="bot__bars">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="bot__torso">
            <div className="bot__core a-glow">
              <Icon name="bolt" size={22} color="var(--amber)" strokeWidth={2.4} />
            </div>
          </div>
        </div>
        <div className="bot__shadow" />
      </div>
    </div>
  );
}

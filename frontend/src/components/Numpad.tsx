import { Icon } from './Icon';
import './Numpad.css';

interface NumpadProps {
  onDigit: (digit: string) => void;
  onErase: () => void;
  onSubmit: () => void;
  submitLabel: string;
  eraseLabel: string;
  disabled?: boolean;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Крупная цифровая клавиатура для ИИН / БИН / телефона. */
export function Numpad({ onDigit, onErase, onSubmit, submitLabel, eraseLabel, disabled }: NumpadProps) {
  return (
    <div className="numpad">
      {DIGITS.map((d) => (
        <button key={d} type="button" className="numpad__key press" onClick={() => onDigit(d)} disabled={disabled}>
          {d}
        </button>
      ))}
      <button type="button" className="numpad__key numpad__key--ghost press" onClick={onErase} disabled={disabled} aria-label={eraseLabel}>
        <Icon name="backspace" size={52} strokeWidth={1.8} />
      </button>
      <button type="button" className="numpad__key press" onClick={() => onDigit('0')} disabled={disabled}>
        0
      </button>
      <button type="button" className="numpad__key numpad__key--submit press" onClick={onSubmit} disabled={disabled}>
        {submitLabel}
      </button>
    </div>
  );
}

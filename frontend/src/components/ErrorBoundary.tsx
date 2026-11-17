import { Component, type ErrorInfo, type ReactNode } from 'react';
import './ErrorBoundary.css';

const RESTART_MS = 4000;

interface State {
  failed: boolean;
}

/**
 * Последняя линия обороны киоска: если интерфейс упал, вместо чёрного экрана
 * показываем заставку-заглушку и через несколько секунд перезапускаем приложение с главного экрана.
 * Не использует контекст и словари — они могут быть причиной сбоя.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };
  private timer = 0;

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[kiosk] UI crashed, restarting', error, info.componentStack);
  }

  // Таймер ставится при монтировании/обновлении, а не в componentDidCatch:
  // так он переживает повторное монтирование в StrictMode.
  componentDidMount() {
    if (this.state.failed) this.scheduleRestart();
  }

  componentDidUpdate(_: unknown, prev: State) {
    if (this.state.failed && !prev.failed) this.scheduleRestart();
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  private scheduleRestart() {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      window.location.hash = '#/';
      window.location.reload();
    }, RESTART_MS);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash" role="alert">
        <div className="crash__spinner a-spin" />
        <p className="crash__title">Перезапускаем консультанта…</p>
        <p className="crash__sub">Кеңесшіні қайта іске қосып жатырмыз…</p>
      </div>
    );
  }
}

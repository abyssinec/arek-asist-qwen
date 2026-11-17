import type { Lang, ServiceDocuments, Statement } from '../api/types';
import { hasDemoFlag } from '../app/route';
import { config, type PrintMode } from '../config';
import { delay, uid } from '../utils/misc';
import { printStore } from './printStore';

/**
 * Device Bridge — связь фронта с оборудованием киоска.
 *
 * Режимы (VITE_PRINT_MODE):
 *  - mock    — печать имитируется (с флагом ?printer=fail в адресе — ошибка принтера),
 *              датчик присутствия: клавиша F2 или window.kiosk.presence()
 *  - browser — печать через window.print() (Chromium с флагом --kiosk-printing печатает без диалога
 *              на принтер по умолчанию); датчик — как в mock
 *  - bridge  — локальный агент по WebSocket (протокол описан в корневом README.md)
 */

export type PrintJob =
  | { kind: 'receipt'; template: 'documents'; data: ServiceDocuments; lang: Lang }
  | { kind: 'a4'; template: 'statement'; data: Statement; lang: Lang };

export interface DeviceBridge {
  readonly mode: PrintMode;
  onPresence(listener: (present: boolean) => void): () => void;
  print(job: PrintJob): Promise<void>;
}

class Emitter<T> {
  private listeners = new Set<(value: T) => void>();
  on(listener: (value: T) => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }
  emit(value: T) {
    this.listeners.forEach((l) => l(value));
  }
}

declare global {
  interface Window {
    kiosk?: { presence: (present?: boolean) => void };
  }
}

class LocalBridge implements DeviceBridge {
  readonly mode: PrintMode;
  private presence = new Emitter<boolean>();

  constructor(mode: PrintMode) {
    this.mode = mode;
    window.kiosk = { presence: (present = true) => this.presence.emit(present) };
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') this.presence.emit(true);
    });
  }

  onPresence(listener: (present: boolean) => void) {
    return this.presence.on(listener);
  }

  async print(job: PrintJob) {
    if (this.mode !== 'browser') {
      await delay(1200);
      if (hasDemoFlag('printer', 'fail')) throw new Error('demo: printer unavailable');
      return;
    }
    printStore.set(job);
    // Даём React отрисовать шаблон в #print-root перед печатью.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.print();
    printStore.set(null);
  }
}

interface Pending {
  resolve: () => void;
  reject: (e: Error) => void;
  timer: number;
}

class WebSocketBridge implements DeviceBridge {
  readonly mode: PrintMode = 'bridge';
  private ws: WebSocket | null = null;
  private presence = new Emitter<boolean>();
  private pending = new Map<string, Pending>();
  private retry = 0;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect() {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      ws.send(JSON.stringify({ type: 'hello', kioskId: config.kioskId }));
    };
    ws.onmessage = (event) => {
      let msg: { type?: string; present?: boolean; id?: string; ok?: boolean; error?: string };
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (msg.type === 'presence') this.presence.emit(Boolean(msg.present));
      if (msg.type === 'print.result' && msg.id) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        clearTimeout(p.timer);
        this.pending.delete(msg.id);
        if (msg.ok) p.resolve();
        else p.reject(new Error(msg.error || 'print failed'));
      }
    };
    ws.onclose = () => {
      this.ws = null;
      const wait = Math.min(30000, 1000 * 2 ** this.retry++);
      window.setTimeout(() => this.connect(), wait);
    };
  }

  onPresence(listener: (present: boolean) => void) {
    return this.presence.on(listener);
  }

  print(job: PrintJob) {
    return new Promise<void>((resolve, reject) => {
      const ws = this.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return reject(new Error('bridge offline'));
      const id = uid();
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('print timeout'));
      }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      ws.send(
        JSON.stringify({
          type: job.kind === 'receipt' ? 'print.receipt' : 'print.a4',
          id,
          template: job.template,
          lang: job.lang,
          payload: job.data,
        }),
      );
    });
  }
}

export const bridge: DeviceBridge =
  config.printMode === 'bridge' ? new WebSocketBridge(config.deviceBridgeUrl) : new LocalBridge(config.printMode);

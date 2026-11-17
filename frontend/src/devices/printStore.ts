import { useSyncExternalStore } from 'react';
import type { PrintJob } from './bridge';

/** Текущее задание для печати браузером (режим VITE_PRINT_MODE=browser). */
let job: PrintJob | null = null;
const listeners = new Set<() => void>();

export const printStore = {
  set(next: PrintJob | null) {
    job = next;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  get: () => job,
};

export const usePrintJob = () => useSyncExternalStore(printStore.subscribe, printStore.get);

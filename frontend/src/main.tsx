import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/manrope';
import '@fontsource-variable/jetbrains-mono';
import './styles/tokens.css';
import './styles/base.css';
import './styles/animations.css';
import './styles/print.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

/* Киоск-режим: без контекстного меню, перетаскивания картинок и зума жестами. */
const block = (e: Event) => e.preventDefault();
document.addEventListener('contextmenu', block);
document.addEventListener('dragstart', block);
document.addEventListener('gesturestart', block);
document.addEventListener(
  'wheel',
  (e) => {
    if (e.ctrlKey) e.preventDefault();
  },
  { passive: false },
);
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

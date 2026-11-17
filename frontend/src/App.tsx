import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ComponentType } from 'react';
import { hasDemoFlag } from './app/route';
import { KioskProvider, useKiosk, type Screen } from './app/store';
import { IdleGuard } from './components/IdleGuard';
import { KioskFrame } from './components/KioskFrame';
import { PrintArea } from './components/PrintArea';
import { config } from './config';
import { AccountScreen } from './screens/AccountScreen';
import { AssistantScreen } from './screens/AssistantScreen';
import { AttractScreen } from './screens/AttractScreen';
import { DocumentsScreen } from './screens/DocumentsScreen';

const SCREENS: Record<Screen, ComponentType> = {
  attract: AttractScreen,
  assistant: AssistantScreen,
  documents: DocumentsScreen,
  account: AccountScreen,
};

function Screens() {
  const { state } = useKiosk();
  const Current = SCREENS[state.screen];

  // Демо: ?crash=1 имитирует сбой интерфейса, чтобы показать автоперезапуск (только на моках).
  if (config.useMocks && hasDemoFlag('crash', '1')) throw new Error('demo crash');

  useEffect(() => {
    document.documentElement.lang = state.lang;
  }, [state.lang]);

  return (
    <AnimatePresence initial={false}>
      <motion.div
        // sessionId в ключе: после сброса сессии экран монтируется заново с чистым состоянием
        key={`${state.screen}-${state.sessionId}`}
        style={{ position: 'absolute', inset: 0 }}
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.18 } }}
        transition={{ duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Current />
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <KioskProvider>
      <KioskFrame>
        <Screens />
        <IdleGuard />
      </KioskFrame>
      <PrintArea />
    </KioskProvider>
  );
}

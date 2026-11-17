import { useLayoutEffect, useState, type ReactNode } from 'react';
import './KioskFrame.css';

const W = 1080;
const H = 1920;

/**
 * Сцена 1080×1920. На экране киоска масштаб = 1; на ноутбуке разработчика
 * сцена вписывается в окно целиком с сохранением пропорций.
 */
export function KioskFrame({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div className="kiosk-viewport">
      <div className="kiosk-box" style={{ width: W * scale, height: H * scale }}>
        <div className="kiosk-stage" style={{ transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

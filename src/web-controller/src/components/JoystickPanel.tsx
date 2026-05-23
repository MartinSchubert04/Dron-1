import { useEffect, useRef } from 'react';
import nipplejs from 'nipplejs';

interface Props {
  onLeftMove:  (t: number, y: number) => void;
  onRightMove: (p: number, r: number) => void;
}

export function JoystickPanel({ onLeftMove, onRightMove }: Props) {
  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  // Usamos refs para los callbacks para evitar re-inicializar nipplejs en cada render
  const leftCb  = useRef(onLeftMove);
  const rightCb = useRef(onRightMove);
  useEffect(() => { leftCb.current  = onLeftMove; }, [onLeftMove]);
  useEffect(() => { rightCb.current = onRightMove; }, [onRightMove]);

  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return;

    const left = nipplejs.create({
      zone:        leftRef.current,
      mode:        'static',
      position:    { left: '50%', top: '50%' },
      color:       '#4fc3f7',
      size:        120,
      restOpacity: 0.35,
    });

    const right = nipplejs.create({
      zone:        rightRef.current,
      mode:        'static',
      position:    { left: '50%', top: '50%' },
      color:       '#4fc3f7',
      size:        120,
      restOpacity: 0.35,
    });

    // Izquierdo: throttle (arriba=255) + yaw (izq/der ±127)
    left.on('move', (_, d) => {
      const t = Math.round(((d.vector.y + 1) / 2) * 255);
      const y = Math.round(d.vector.x * 127);
      leftCb.current(t, y);
    });
    left.on('end', () => leftCb.current(0, 0));

    // Derecho: pitch (arr/aba ±127) + roll (izq/der ±127)
    right.on('move', (_, d) => {
      const p = Math.round(d.vector.y * 127);
      const r = Math.round(d.vector.x * 127);
      rightCb.current(p, r);
    });
    right.on('end', () => rightCb.current(0, 0));

    return () => { left.destroy(); right.destroy(); };
  }, []); // solo una vez al montar

  return (
    <div className="flex flex-1 gap-2 min-h-0">

      {/* Joystick izquierdo — Throttle / Yaw */}
      <div className="flex flex-1 flex-col items-center gap-1 bg-surface border border-frame rounded-md p-2 min-h-0">
        <span className="text-accent text-[0.62rem] tracking-[3px] flex-shrink-0">THR / YAW</span>
        <div ref={leftRef} className="joy-zone flex-1 w-full relative min-h-0" />
        <span className="text-muted text-[0.48rem] flex-shrink-0">▲ Subir · ◀▶ Girar</span>
      </div>

      {/* Joystick derecho — Pitch / Roll */}
      <div className="flex flex-1 flex-col items-center gap-1 bg-surface border border-frame rounded-md p-2 min-h-0">
        <span className="text-accent text-[0.62rem] tracking-[3px] flex-shrink-0">PITCH / ROLL</span>
        <div ref={rightRef} className="joy-zone flex-1 w-full relative min-h-0" />
        <span className="text-muted text-[0.48rem] flex-shrink-0">▲▼ Adelante / Atrás · ◀▶ Ladear</span>
      </div>

    </div>
  );
}

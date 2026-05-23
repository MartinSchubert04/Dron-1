import { useState, useCallback } from 'react';
import { useDrone } from './hooks/useDrone';
import { Header } from './components/Header';
import { JoystickPanel } from './components/JoystickPanel';
import { MotorPanel } from './components/MotorPanel';

type Panel = 'joysticks' | 'motors';

export default function App() {
  const drone = useDrone();
  const [panel, setPanel] = useState<Panel>('joysticks');

  const switchPanel = useCallback((next: Panel) => {
    if (next === 'motors') drone.resetJoysticks();
    setPanel(next);
  }, [drone]);

  const handleLeftMove  = useCallback((t: number, y: number) => drone.setLeftJoy(t, y),  [drone]);
  const handleRightMove = useCallback((p: number, r: number) => drone.setRightJoy(p, r), [drone]);

  return (
    <div className="flex flex-col h-dvh bg-bg text-white font-mono text-sm p-2 gap-2 overflow-hidden select-none">

      <Header drone={drone} />

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-shrink-0">
        {(['joysticks', 'motors'] as Panel[]).map(p => (
          <button
            key={p}
            onClick={() => switchPanel(p)}
            className={`flex-1 py-1 text-[0.65rem] tracking-widest rounded border font-mono transition-all
              ${panel === p
                ? 'border-accent text-accent bg-accent/10'
                : 'border-frame text-muted bg-surface hover:text-white hover:border-frame'}`}
          >
            {p === 'joysticks' ? 'JOYSTICKS' : 'MOTORES'}
          </button>
        ))}
      </div>

      {/* ── Panel activo ─────────────────────────────────────────── */}
      {panel === 'joysticks' && (
        <JoystickPanel
          onLeftMove={handleLeftMove}
          onRightMove={handleRightMove}
        />
      )}

      {panel === 'motors' && (
        <MotorPanel
          armed={drone.armed}
          onSendRaw={drone.sendRaw}
          onSetThrottle={(t) => { drone.setLeftJoy(t, 0); drone.setRightJoy(0, 0); }}
        />
      )}

      {/* ── Hint teclado (solo joysticks) ────────────────────────── */}
      {panel === 'joysticks' && (
        <p className="text-[0.48rem] text-muted text-center tracking-wide flex-shrink-0">
          W/S = Throttle · A/D = Yaw · ↑↓ = Pitch · ←→ = Roll · Espacio = ARM/DISARM
        </p>
      )}

    </div>
  );
}

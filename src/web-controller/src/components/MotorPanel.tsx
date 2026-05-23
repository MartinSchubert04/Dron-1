import { useState, useCallback } from 'react';

interface Props {
  armed:         boolean;
  onSendRaw:     (fl: number, fr: number, bl: number, br: number) => void;
  onSetThrottle: (t: number) => void;  // ALL estabilizado → actualiza setpoint del PID
}

type MotorKey = 'fl' | 'fr' | 'bl' | 'br';
const MOTOR_LABELS: MotorKey[] = ['fl', 'fr', 'bl', 'br'];

export function MotorPanel({ armed, onSendRaw, onSetThrottle }: Props) {
  const [stabilized, setStabilized] = useState(false);
  const [vals, setVals] = useState<Record<MotorKey, number>>({ fl: 0, fr: 0, bl: 0, br: 0 });
  const [all, setAll]   = useState(0);

  const updateMotor = useCallback((key: MotorKey, v: number) => {
    setVals(prev => {
      const next = { ...prev, [key]: v };
      if (armed) onSendRaw(next.fl, next.fr, next.bl, next.br);
      return next;
    });
  }, [armed, onSendRaw]);

  const updateAll = useCallback((v: number) => {
    setAll(v);
    if (stabilized) {
      // Manda throttle al PID — el firmware aplica correcciones IMU encima
      onSetThrottle(v);
    } else {
      // Control directo de los 4 motores sin PID
      const next = { fl: v, fr: v, bl: v, br: v };
      setVals(next);
      if (armed) onSendRaw(v, v, v, v);
    }
  }, [armed, stabilized, onSendRaw, onSetThrottle]);

  const allZero = useCallback(() => {
    setAll(0);
    setVals({ fl: 0, fr: 0, bl: 0, br: 0 });
    onSendRaw(0, 0, 0, 0);
    onSetThrottle(0);
  }, [onSendRaw, onSetThrottle]);

  const toggleStabilized = useCallback(() => {
    setStabilized(s => {
      if (s) {
        // Apagando estabilización → parar todo para no quedar volando
        onSetThrottle(0);
        setAll(0);
        setVals({ fl: 0, fr: 0, bl: 0, br: 0 });
      }
      return !s;
    });
  }, [onSetThrottle]);

  return (
    <div className="flex flex-1 flex-col gap-3 bg-surface border border-frame rounded-md p-4 min-h-0 overflow-y-auto">

      {/* ── Toggle de estabilización ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.65rem] text-white tracking-widest font-bold">
            ESTABILIZACIÓN
          </span>
          <span className="text-[0.55rem] text-muted">
            {stabilized
              ? 'ALL = throttle PID · IMU corrige inclinación'
              : 'ALL e individuales = PWM directo · sin corrección'}
          </span>
        </div>
        <button
          onClick={toggleStabilized}
          className={`px-4 py-1.5 text-[0.68rem] font-mono tracking-widest rounded border transition-all flex-shrink-0
            ${stabilized
              ? 'border-success text-success bg-success/10 hover:bg-success/20'
              : 'border-frame  text-muted  bg-surface   hover:border-accent hover:text-accent'}`}
        >
          {stabilized ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="h-px bg-frame" />

      {!armed && (
        <p className="text-center text-warn text-[0.62rem] tracking-widest">
          Activá STBY + ARM para enviar comandos
        </p>
      )}

      {/* ── Slider ALL ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className={`text-[0.65rem] w-7 flex-shrink-0 tracking-widest font-bold
          ${stabilized ? 'text-success' : 'text-warn'}`}>
          ALL
        </span>
        <input
          type="range" min={0} max={255} value={all}
          onChange={e => updateAll(Number(e.target.value))}
          className="flex-1 master-slider"
        />
        <span className={`text-[0.65rem] w-8 text-right flex-shrink-0
          ${stabilized ? 'text-success' : 'text-warn'}`}>
          {all}
        </span>
      </div>

      <div className="h-px bg-frame" />

      {/* ── Sliders individuales (siempre raw) ─────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {MOTOR_LABELS.map(key => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-muted text-[0.65rem] w-7 flex-shrink-0 tracking-widest uppercase">
              {key}
            </span>
            <input
              type="range" min={0} max={255}
              value={stabilized ? 0 : vals[key]}
              disabled={stabilized}
              onChange={e => updateMotor(key, Number(e.target.value))}
              className={`flex-1 ${stabilized ? 'opacity-25 cursor-not-allowed' : ''}`}
            />
            <span className={`text-[0.65rem] w-8 text-right flex-shrink-0
              ${stabilized ? 'text-muted' : 'text-white'}`}>
              {stabilized ? '—' : vals[key]}
            </span>
          </div>
        ))}
      </div>

      {stabilized && (
        <p className="text-center text-[0.55rem] text-muted italic">
          Sliders individuales deshabilitados en modo estabilizado
        </p>
      )}

      {/* ── Todo a cero ────────────────────────────────────────────────────── */}
      <button
        onClick={allZero}
        className="self-center mt-1 px-6 py-1.5 border border-danger text-danger text-[0.68rem]
                   tracking-widest rounded font-mono hover:bg-danger/15 transition-colors"
      >
        TODO A CERO
      </button>

    </div>
  );
}

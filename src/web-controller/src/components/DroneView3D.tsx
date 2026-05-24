import { useEffect, useRef, useState } from 'react';
import { init3D, updateAngles, updateMotors, resize3D, dispose3D } from '../drone3d';
import type { DroneConfig } from '../hooks/useDrone';

interface Props {
  roll:        number;
  pitch:       number;
  imuOk:       boolean;
  motors:      number[];
  signRoll:    number;
  signPitch:   number;
  armed:       boolean;
  applyConfig: (c: Partial<DroneConfig>) => void;
}

export function DroneView3D({ roll, pitch, imuOk, motors, signRoll, signPitch, armed, applyConfig }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inited       = useRef(false);

  // Local sign state — updated immediately on click for instant visual feedback
  const [localSignRoll,  setLocalSignRoll]  = useState(signRoll);
  const [localSignPitch, setLocalSignPitch] = useState(signPitch);

  // Sync local state when drone.config changes (e.g., on connect or config apply)
  useEffect(() => { setLocalSignRoll(signRoll);  }, [signRoll]);
  useEffect(() => { setLocalSignPitch(signPitch); }, [signPitch]);

  useEffect(() => {
    if (!canvasRef.current) return;
    init3D(canvasRef.current);
    inited.current = true;

    const obs = new ResizeObserver(() => {
      if (canvasRef.current) resize3D(canvasRef.current);
    });
    if (containerRef.current) obs.observe(containerRef.current);

    return () => {
      obs.disconnect();
      dispose3D();
      inited.current = false;
    };
  }, []);

  useEffect(() => {
    if (inited.current) updateAngles(roll, pitch, localSignRoll, localSignPitch);
  }, [roll, pitch, localSignRoll, localSignPitch]);

  useEffect(() => {
    if (inited.current) updateMotors(motors);
  }, [motors]);

  const toggleSignRoll = () => {
    const next = localSignRoll > 0 ? -1 : 1;
    setLocalSignRoll(next);
    if (!armed) applyConfig({ signRoll: next });
  };

  const toggleSignPitch = () => {
    const next = localSignPitch > 0 ? -1 : 1;
    setLocalSignPitch(next);
    if (!armed) applyConfig({ signPitch: next });
  };

  const imuColor = imuOk ? 'text-success' : 'text-danger';

  return (
    <div ref={containerRef} className="flex flex-1 flex-col relative bg-bg border border-frame rounded-md overflow-hidden min-h-0">

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* HUD izquierdo — ángulos + IMU */}
      <div className="absolute top-2.5 left-3 flex flex-col gap-1.5 pointer-events-none select-none">
        <HudRow label="ROLL"  value={`${roll.toFixed(1)}°`} />
        <HudRow label="PITCH" value={`${pitch.toFixed(1)}°`} />
        <HudRow label="IMU" value={imuOk ? 'OK' : 'FALLO'} valueClass={imuColor} />
      </div>

      {/* Toggles de signo — esquina superior derecha */}
      <div className="absolute top-2.5 right-3 flex flex-col gap-1.5 items-end select-none">
        <SignBtn label="ROLL"  value={localSignRoll}  onClick={toggleSignRoll}  armed={armed} />
        <SignBtn label="PITCH" value={localSignPitch} onClick={toggleSignPitch} armed={armed} />
        {armed && (
          <span className="text-warn text-[0.44rem] tracking-widest mt-0.5">
            Desarmá para guardar
          </span>
        )}
      </div>

      {/* Leyenda de orientación */}
      <div className="absolute bottom-2.5 right-3 flex items-center gap-2 pointer-events-none select-none
                      text-muted text-[0.48rem] tracking-widest">
        <span className="inline-block w-2 h-2 rounded-sm bg-danger flex-shrink-0" />
        FRENTE
        <span className="mx-1 text-frame">|</span>
        <span className="inline-block w-2 h-2 rounded-sm bg-accent flex-shrink-0" />
        ATRÁS
      </div>

    </div>
  );
}

function SignBtn({
  label, value, onClick, armed,
}: {
  label: string; value: number; onClick: () => void; armed: boolean;
}) {
  const isPos = value > 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted text-[0.44rem] tracking-widest">{label}</span>
      <button
        onClick={onClick}
        className={`px-2 py-0.5 text-[0.55rem] rounded border font-mono transition-all
          ${isPos
            ? 'border-success text-success bg-success/10 hover:bg-success/20'
            : 'border-warn   text-warn   bg-warn/10   hover:bg-warn/20'}
          ${armed ? 'opacity-60' : ''}`}
      >
        {isPos ? '+1' : '−1'}
      </button>
    </div>
  );
}

function HudRow({
  label, value, valueClass = 'text-accent',
}: {
  label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted text-[0.52rem] tracking-widest w-9 flex-shrink-0">{label}</span>
      <span className={`text-[0.68rem] font-mono ${valueClass}`}>{value}</span>
    </div>
  );
}

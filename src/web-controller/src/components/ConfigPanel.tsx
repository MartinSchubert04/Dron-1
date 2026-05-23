import { useEffect, useMemo, useState } from 'react';
import type { DroneConfig } from '../hooks/useDrone';

interface Props {
  config:      DroneConfig | null;
  armed:       boolean;
  configMsg:   string;
  onApply:     (c: Partial<DroneConfig>) => void;
  onReset:     () => void;
  onFetch:     () => void;
}

// ── Presets (localStorage) ────────────────────────────────────────────────────

type Preset = { name: string; config: DroneConfig; savedAt: number };
const PRESETS_KEY = 'dronePresets';

function loadPresets(): Preset[] {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); }
  catch { return []; }
}
function savePresets(p: Preset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(p));
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function ParamRow({
  label, value, min, max, step, onChange, help, unit, danger,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; help: string; unit?: string; danger?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <label className={`text-[0.62rem] tracking-widest w-20 flex-shrink-0
          ${danger ? 'text-warn' : 'text-white'}`}>
          {label}
        </label>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1"
        />
        <input
          type="number" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-16 px-1 py-0.5 bg-bg border border-frame rounded text-[0.62rem]
                     text-white text-right outline-none focus:border-accent"
        />
        {unit && <span className="text-muted text-[0.55rem] w-4">{unit}</span>}
      </div>
      <span className="text-muted text-[0.5rem] ml-22 leading-tight pl-22" style={{ paddingLeft: '5.5rem' }}>
        {help}
      </span>
    </div>
  );
}

function SignToggle({
  label, value, onChange, help,
}: {
  label: string; value: number; onChange: (v: number) => void; help: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-[0.62rem] tracking-widest w-16 text-white flex-shrink-0">{label}</label>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(+1)}
          className={`px-3 py-0.5 text-[0.62rem] rounded border font-mono transition-all
            ${value > 0 ? 'border-success text-success bg-success/10' : 'border-frame text-muted hover:border-accent'}`}
        >+1</button>
        <button
          onClick={() => onChange(-1)}
          className={`px-3 py-0.5 text-[0.62rem] rounded border font-mono transition-all
            ${value < 0 ? 'border-warn text-warn bg-warn/10' : 'border-frame text-muted hover:border-accent'}`}
        >−1</button>
      </div>
      <span className="text-muted text-[0.5rem] flex-1">{help}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border border-frame rounded p-3 bg-bg/40">
      <div className="text-accent text-[0.6rem] tracking-[3px] border-b border-frame pb-1.5">
        {title}
      </div>
      {children}
    </div>
  );
}

// ── ConfigPanel ───────────────────────────────────────────────────────────────

export function ConfigPanel({ config, armed, configMsg, onApply, onReset, onFetch }: Props) {
  const [local, setLocal] = useState<DroneConfig | null>(config);
  const [presets, setPresets] = useState<Preset[]>(loadPresets);
  const [presetName, setPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');

  useEffect(() => { if (config) setLocal(config); }, [config]);

  const dirty = useMemo(() => {
    if (!config || !local) return false;
    return JSON.stringify(config) !== JSON.stringify(local);
  }, [config, local]);

  const update = <K extends keyof DroneConfig>(key: K, value: DroneConfig[K]) =>
    setLocal(prev => prev ? { ...prev, [key]: value } : prev);

  const doApply = () => {
    if (!local) return;
    onApply(local);
  };

  const doSavePreset = () => {
    if (!local || !presetName.trim()) return;
    const name = presetName.trim();
    const next = presets.filter(p => p.name !== name);
    next.push({ name, config: { ...local }, savedAt: Date.now() });
    savePresets(next);
    setPresets(next);
    setPresetName('');
  };

  const doLoadPreset = () => {
    const p = presets.find(p => p.name === selectedPreset);
    if (p) setLocal(p.config);
  };

  const doDeletePreset = () => {
    if (!selectedPreset) return;
    const next = presets.filter(p => p.name !== selectedPreset);
    savePresets(next);
    setPresets(next);
    setSelectedPreset('');
  };

  if (!local) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface border border-frame rounded-md min-h-0">
        <button
          onClick={onFetch}
          className="px-4 py-2 border border-accent text-accent text-xs tracking-widest rounded hover:bg-accent/10"
        >
          CARGAR CONFIG DEL DRON
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 bg-surface border border-frame rounded-md p-3 min-h-0 overflow-y-auto">

      {armed && (
        <div className="text-center text-danger text-[0.62rem] tracking-widest border border-danger rounded p-2 bg-danger/5">
          ⚠ DESARMA antes de cambiar config (el firmware rechaza cambios armado)
        </div>
      )}

      {/* ── Filtro ────────────────────────────────────────────────────────── */}
      <Section title="FILTRO COMPLEMENTARIO">
        <ParamRow
          label="α gyro/accel" value={local.compAlpha} min={0.85} max={0.999} step={0.005}
          onChange={v => update('compAlpha', v)}
          help="Peso del gyro vs accel. ↑ = más reactivo y con drift · ↓ = más estable pero lento"
        />
      </Section>

      {/* ── Límites ───────────────────────────────────────────────────────── */}
      <Section title="LÍMITES DE CONTROL">
        <ParamRow
          label="Ángulo máx" value={local.maxAngle} min={5} max={60} step={1} unit="°"
          onChange={v => update('maxAngle', v)}
          help="Inclinación máx del joystick. ↑ = más maniobrable · ↓ = más estable"
        />
        <ParamRow
          label="Yaw máx" value={local.maxYawRate} min={10} max={360} step={5} unit="°/s"
          onChange={v => update('maxYawRate', v)}
          help="Velocidad máx de giro horizontal"
        />
        <ParamRow
          label="Límite PID" value={local.pidLimit} min={10} max={200} step={5}
          onChange={v => update('pidLimit', v)}
          help="Corrección máx del PID. ↑ = corrige más fuerte · ↓ = menos agresivo y seguro"
        />
        <ParamRow
          label="Thr mín PID" value={local.thrPidMin} min={0} max={100} step={1}
          onChange={v => update('thrPidMin', v)}
          help="Throttle mínimo para que se activen motores (debajo de esto = todo apagado)"
        />
      </Section>

      {/* ── Signos ────────────────────────────────────────────────────────── */}
      <Section title="SIGNOS DE EJES">
        <p className="text-muted text-[0.5rem] -mt-1">
          Si el dron corrige al revés en un eje, cambiá ese signo a −1
        </p>
        <SignToggle label="Roll"  value={local.signRoll}  onChange={v => update('signRoll', v)}
          help="Inclinación lateral" />
        <SignToggle label="Pitch" value={local.signPitch} onChange={v => update('signPitch', v)}
          help="Inclinación adelante/atrás" />
        <SignToggle label="Yaw"   value={local.signYaw}   onChange={v => update('signYaw', v)}
          help="Rotación horizontal" />
      </Section>

      {/* ── PID Roll ──────────────────────────────────────────────────────── */}
      <Section title="PID ROLL (lateral)">
        <ParamRow
          label="Kp" value={local.rollKp} min={0} max={5} step={0.05}
          onChange={v => update('rollKp', v)}
          help="Fuerza por grado de error. ↑ corrige más fuerte · si oscila → ↓"
        />
        <ParamRow
          label="Ki" value={local.rollKi} min={0} max={0.5} step={0.005}
          onChange={v => update('rollKi', v)}
          help="Corrige drift lento. Subir si va lentamente para un lado"
        />
        <ParamRow
          label="Kd" value={local.rollKd} min={0} max={1} step={0.01}
          onChange={v => update('rollKd', v)}
          help="Amortigua oscilaciones. ↑ si vibra · ↓ si motores chillan"
        />
      </Section>

      {/* ── PID Pitch ─────────────────────────────────────────────────────── */}
      <Section title="PID PITCH (adelante/atrás)">
        <ParamRow
          label="Kp" value={local.pitchKp} min={0} max={5} step={0.05}
          onChange={v => update('pitchKp', v)}
          help="Igual que roll, suele tener el mismo valor"
        />
        <ParamRow
          label="Ki" value={local.pitchKi} min={0} max={0.5} step={0.005}
          onChange={v => update('pitchKi', v)} help="Drift adelante/atrás"
        />
        <ParamRow
          label="Kd" value={local.pitchKd} min={0} max={1} step={0.01}
          onChange={v => update('pitchKd', v)} help="Amortiguar oscilación adelante/atrás"
        />
      </Section>

      {/* ── PID Yaw ───────────────────────────────────────────────────────── */}
      <Section title="PID YAW (giro horizontal)">
        <p className="text-muted text-[0.5rem] -mt-1">
          Yaw controla tasa angular (no ángulo). Ki normalmente queda en 0.
        </p>
        <ParamRow
          label="Kp" value={local.yawKp} min={0} max={5} step={0.05}
          onChange={v => update('yawKp', v)}
          help="Velocidad de respuesta del giro"
        />
        <ParamRow
          label="Ki" value={local.yawKi} min={0} max={0.5} step={0.005}
          onChange={v => update('yawKi', v)} help="Normalmente 0"
        />
        <ParamRow
          label="Kd" value={local.yawKd} min={0} max={1} step={0.01}
          onChange={v => update('yawKd', v)} help="Normalmente 0"
        />
      </Section>

      {/* ── Presets ───────────────────────────────────────────────────────── */}
      <Section title="PRESETS (localStorage)">
        <div className="flex gap-2 items-center flex-wrap">
          <input
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            placeholder="nombre"
            className="flex-1 min-w-[80px] px-2 py-1 bg-bg border border-frame rounded text-[0.62rem]
                       text-white outline-none focus:border-accent"
          />
          <button
            onClick={doSavePreset}
            disabled={!presetName.trim()}
            className="px-3 py-1 text-[0.6rem] border border-accent text-accent rounded
                       hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed tracking-widest"
          >
            GUARDAR ACTUAL
          </button>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={selectedPreset}
            onChange={e => setSelectedPreset(e.target.value)}
            className="flex-1 min-w-[80px] px-2 py-1 bg-bg border border-frame rounded text-[0.62rem]
                       text-white outline-none focus:border-accent"
          >
            <option value="">— elegí preset —</option>
            {presets.map(p => (
              <option key={p.name} value={p.name}>
                {p.name} ({new Date(p.savedAt).toLocaleDateString()})
              </option>
            ))}
          </select>
          <button
            onClick={doLoadPreset}
            disabled={!selectedPreset}
            className="px-3 py-1 text-[0.6rem] border border-accent text-accent rounded
                       hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed tracking-widest"
          >
            CARGAR
          </button>
          <button
            onClick={doDeletePreset}
            disabled={!selectedPreset}
            className="px-3 py-1 text-[0.6rem] border border-danger text-danger rounded
                       hover:bg-danger/10 disabled:opacity-30 disabled:cursor-not-allowed tracking-widest"
          >
            BORRAR
          </button>
        </div>
        <p className="text-muted text-[0.5rem]">
          {presets.length} preset(s) guardados localmente. "Cargar" actualiza los sliders pero NO los manda al dron — usá "APLICAR" después.
        </p>
      </Section>

      {/* ── Acciones globales ─────────────────────────────────────────────── */}
      <div className="flex gap-2 items-center justify-between pt-2 border-t border-frame flex-shrink-0">
        <button
          onClick={onReset}
          disabled={armed}
          className="px-3 py-1.5 text-[0.6rem] border border-warn text-warn rounded
                     hover:bg-warn/10 disabled:opacity-30 disabled:cursor-not-allowed tracking-widest"
        >
          DEFAULTS
        </button>
        <span className={`text-[0.55rem] tracking-widest flex-1 text-center
          ${configMsg.startsWith('Error') ? 'text-danger' : 'text-success'}`}>
          {configMsg || (dirty ? '● cambios sin aplicar' : '')}
        </span>
        <button
          onClick={doApply}
          disabled={armed || !dirty}
          className={`px-4 py-1.5 text-[0.62rem] rounded border font-mono tracking-widest transition-all
            ${dirty && !armed
              ? 'border-success text-success bg-success/10 hover:bg-success/20'
              : 'border-frame text-muted'}
            disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          APLICAR AL DRON
        </button>
      </div>

    </div>
  );
}

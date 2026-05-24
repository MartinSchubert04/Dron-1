import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
const PRESETS_KEY = 'dronePresets';
function loadPresets() {
    try {
        return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]');
    }
    catch {
        return [];
    }
}
function savePresets(p) {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(p));
}
// ── Componentes auxiliares ────────────────────────────────────────────────────
function ParamRow({ label, value, min, max, step, onChange, help, unit, danger, }) {
    return (_jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: `text-[0.62rem] tracking-widest w-20 flex-shrink-0
          ${danger ? 'text-warn' : 'text-white'}`, children: label }), _jsx("input", { type: "range", min: min, max: max, step: step, value: value, onChange: e => onChange(Number(e.target.value)), className: "flex-1" }), _jsx("input", { type: "number", min: min, max: max, step: step, value: value, onChange: e => onChange(Number(e.target.value)), className: "w-16 px-1 py-0.5 bg-bg border border-frame rounded text-[0.62rem]\r\n                     text-white text-right outline-none focus:border-accent" }), unit && _jsx("span", { className: "text-muted text-[0.55rem] w-4", children: unit })] }), _jsx("span", { className: "text-muted text-[0.5rem] ml-22 leading-tight pl-22", style: { paddingLeft: '5.5rem' }, children: help })] }));
}
function SignToggle({ label, value, onChange, help, }) {
    return (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("label", { className: "text-[0.62rem] tracking-widest w-16 text-white flex-shrink-0", children: label }), _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: () => onChange(+1), className: `px-3 py-0.5 text-[0.62rem] rounded border font-mono transition-all
            ${value > 0 ? 'border-success text-success bg-success/10' : 'border-frame text-muted hover:border-accent'}`, children: "+1" }), _jsx("button", { onClick: () => onChange(-1), className: `px-3 py-0.5 text-[0.62rem] rounded border font-mono transition-all
            ${value < 0 ? 'border-warn text-warn bg-warn/10' : 'border-frame text-muted hover:border-accent'}`, children: "\u22121" })] }), _jsx("span", { className: "text-muted text-[0.5rem] flex-1", children: help })] }));
}
function Section({ title, children }) {
    return (_jsxs("div", { className: "flex flex-col gap-2 border border-frame rounded p-3 bg-bg/40", children: [_jsx("div", { className: "text-accent text-[0.6rem] tracking-[3px] border-b border-frame pb-1.5", children: title }), children] }));
}
// ── ConfigPanel ───────────────────────────────────────────────────────────────
export function ConfigPanel({ config, armed, configMsg, onApply, onReset, onFetch }) {
    const [local, setLocal] = useState(config);
    const [presets, setPresets] = useState(loadPresets);
    const [presetName, setPresetName] = useState('');
    const [selectedPreset, setSelectedPreset] = useState('');
    useEffect(() => { if (config)
        setLocal(config); }, [config]);
    const dirty = useMemo(() => {
        if (!config || !local)
            return false;
        return JSON.stringify(config) !== JSON.stringify(local);
    }, [config, local]);
    const update = (key, value) => setLocal(prev => prev ? { ...prev, [key]: value } : prev);
    const doApply = () => {
        if (!local)
            return;
        onApply(local);
    };
    const doSavePreset = () => {
        if (!local || !presetName.trim())
            return;
        const name = presetName.trim();
        const next = presets.filter(p => p.name !== name);
        next.push({ name, config: { ...local }, savedAt: Date.now() });
        savePresets(next);
        setPresets(next);
        setPresetName('');
    };
    const doLoadPreset = () => {
        const p = presets.find(p => p.name === selectedPreset);
        if (p)
            setLocal(p.config);
    };
    const doDeletePreset = () => {
        if (!selectedPreset)
            return;
        const next = presets.filter(p => p.name !== selectedPreset);
        savePresets(next);
        setPresets(next);
        setSelectedPreset('');
    };
    if (!local) {
        return (_jsx("div", { className: "flex flex-1 items-center justify-center bg-surface border border-frame rounded-md min-h-0", children: _jsx("button", { onClick: onFetch, className: "px-4 py-2 border border-accent text-accent text-xs tracking-widest rounded hover:bg-accent/10", children: "CARGAR CONFIG DEL DRON" }) }));
    }
    return (_jsxs("div", { className: "flex flex-1 flex-col gap-3 bg-surface border border-frame rounded-md p-3 min-h-0 overflow-y-auto", children: [armed && (_jsx("div", { className: "text-center text-danger text-[0.62rem] tracking-widest border border-danger rounded p-2 bg-danger/5", children: "\u26A0 DESARMA antes de cambiar config (el firmware rechaza cambios armado)" })), _jsx(Section, { title: "FILTRO COMPLEMENTARIO", children: _jsx(ParamRow, { label: "\u03B1 gyro/accel", value: local.compAlpha, min: 0.85, max: 0.999, step: 0.005, onChange: v => update('compAlpha', v), help: "Peso del gyro vs accel. \u2191 = m\u00E1s reactivo y con drift \u00B7 \u2193 = m\u00E1s estable pero lento" }) }), _jsxs(Section, { title: "L\u00CDMITES DE CONTROL", children: [_jsx(ParamRow, { label: "\u00C1ngulo m\u00E1x", value: local.maxAngle, min: 5, max: 60, step: 1, unit: "\u00B0", onChange: v => update('maxAngle', v), help: "Inclinaci\u00F3n m\u00E1x del joystick. \u2191 = m\u00E1s maniobrable \u00B7 \u2193 = m\u00E1s estable" }), _jsx(ParamRow, { label: "Yaw m\u00E1x", value: local.maxYawRate, min: 10, max: 360, step: 5, unit: "\u00B0/s", onChange: v => update('maxYawRate', v), help: "Velocidad m\u00E1x de giro horizontal" }), _jsx(ParamRow, { label: "L\u00EDmite PID", value: local.pidLimit, min: 10, max: 200, step: 5, onChange: v => update('pidLimit', v), help: "Correcci\u00F3n m\u00E1x del PID. \u2191 = corrige m\u00E1s fuerte \u00B7 \u2193 = menos agresivo y seguro" }), _jsx(ParamRow, { label: "Thr m\u00EDn PID", value: local.thrPidMin, min: 0, max: 100, step: 1, onChange: v => update('thrPidMin', v), help: "Throttle m\u00EDnimo para que se activen motores (debajo de esto = todo apagado)" })] }), _jsxs(Section, { title: "SIGNOS DE EJES", children: [_jsx("p", { className: "text-muted text-[0.5rem] -mt-1", children: "Si el dron corrige al rev\u00E9s en un eje, cambi\u00E1 ese signo a \u22121" }), _jsx(SignToggle, { label: "Roll", value: local.signRoll, onChange: v => update('signRoll', v), help: "Inclinaci\u00F3n lateral" }), _jsx(SignToggle, { label: "Pitch", value: local.signPitch, onChange: v => update('signPitch', v), help: "Inclinaci\u00F3n adelante/atr\u00E1s" }), _jsx(SignToggle, { label: "Yaw", value: local.signYaw, onChange: v => update('signYaw', v), help: "Rotaci\u00F3n horizontal" })] }), _jsxs(Section, { title: "PID ROLL (lateral)", children: [_jsx(ParamRow, { label: "Kp", value: local.rollKp, min: 0, max: 5, step: 0.05, onChange: v => update('rollKp', v), help: "Fuerza por grado de error. \u2191 corrige m\u00E1s fuerte \u00B7 si oscila \u2192 \u2193" }), _jsx(ParamRow, { label: "Ki", value: local.rollKi, min: 0, max: 0.5, step: 0.005, onChange: v => update('rollKi', v), help: "Corrige drift lento. Subir si va lentamente para un lado" }), _jsx(ParamRow, { label: "Kd", value: local.rollKd, min: 0, max: 1, step: 0.01, onChange: v => update('rollKd', v), help: "Amortigua oscilaciones. \u2191 si vibra \u00B7 \u2193 si motores chillan" })] }), _jsxs(Section, { title: "PID PITCH (adelante/atr\u00E1s)", children: [_jsx(ParamRow, { label: "Kp", value: local.pitchKp, min: 0, max: 5, step: 0.05, onChange: v => update('pitchKp', v), help: "Igual que roll, suele tener el mismo valor" }), _jsx(ParamRow, { label: "Ki", value: local.pitchKi, min: 0, max: 0.5, step: 0.005, onChange: v => update('pitchKi', v), help: "Drift adelante/atr\u00E1s" }), _jsx(ParamRow, { label: "Kd", value: local.pitchKd, min: 0, max: 1, step: 0.01, onChange: v => update('pitchKd', v), help: "Amortiguar oscilaci\u00F3n adelante/atr\u00E1s" })] }), _jsxs(Section, { title: "PID YAW (giro horizontal)", children: [_jsx("p", { className: "text-muted text-[0.5rem] -mt-1", children: "Yaw controla tasa angular (no \u00E1ngulo). Ki normalmente queda en 0." }), _jsx(ParamRow, { label: "Kp", value: local.yawKp, min: 0, max: 5, step: 0.05, onChange: v => update('yawKp', v), help: "Velocidad de respuesta del giro" }), _jsx(ParamRow, { label: "Ki", value: local.yawKi, min: 0, max: 0.5, step: 0.005, onChange: v => update('yawKi', v), help: "Normalmente 0" }), _jsx(ParamRow, { label: "Kd", value: local.yawKd, min: 0, max: 1, step: 0.01, onChange: v => update('yawKd', v), help: "Normalmente 0" })] }), _jsxs(Section, { title: "PRESETS (localStorage)", children: [_jsxs("div", { className: "flex gap-2 items-center flex-wrap", children: [_jsx("input", { value: presetName, onChange: e => setPresetName(e.target.value), placeholder: "nombre", className: "flex-1 min-w-[80px] px-2 py-1 bg-bg border border-frame rounded text-[0.62rem]\r\n                       text-white outline-none focus:border-accent" }), _jsx("button", { onClick: doSavePreset, disabled: !presetName.trim(), className: "px-3 py-1 text-[0.6rem] border border-accent text-accent rounded\r\n                       hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed tracking-widest", children: "GUARDAR ACTUAL" })] }), _jsxs("div", { className: "flex gap-2 items-center flex-wrap", children: [_jsxs("select", { value: selectedPreset, onChange: e => setSelectedPreset(e.target.value), className: "flex-1 min-w-[80px] px-2 py-1 bg-bg border border-frame rounded text-[0.62rem]\r\n                       text-white outline-none focus:border-accent", children: [_jsx("option", { value: "", children: "\u2014 eleg\u00ED preset \u2014" }), presets.map(p => (_jsxs("option", { value: p.name, children: [p.name, " (", new Date(p.savedAt).toLocaleDateString(), ")"] }, p.name)))] }), _jsx("button", { onClick: doLoadPreset, disabled: !selectedPreset, className: "px-3 py-1 text-[0.6rem] border border-accent text-accent rounded\r\n                       hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed tracking-widest", children: "CARGAR" }), _jsx("button", { onClick: doDeletePreset, disabled: !selectedPreset, className: "px-3 py-1 text-[0.6rem] border border-danger text-danger rounded\r\n                       hover:bg-danger/10 disabled:opacity-30 disabled:cursor-not-allowed tracking-widest", children: "BORRAR" })] }), _jsxs("p", { className: "text-muted text-[0.5rem]", children: [presets.length, " preset(s) guardados localmente. \"Cargar\" actualiza los sliders pero NO los manda al dron \u2014 us\u00E1 \"APLICAR\" despu\u00E9s."] })] }), _jsxs("div", { className: "flex gap-2 items-center justify-between pt-2 border-t border-frame flex-shrink-0", children: [_jsx("button", { onClick: onReset, disabled: armed, className: "px-3 py-1.5 text-[0.6rem] border border-warn text-warn rounded\r\n                     hover:bg-warn/10 disabled:opacity-30 disabled:cursor-not-allowed tracking-widest", children: "DEFAULTS" }), _jsx("span", { className: `text-[0.55rem] tracking-widest flex-1 text-center
          ${configMsg.startsWith('Error') ? 'text-danger' : 'text-success'}`, children: configMsg || (dirty ? '● cambios sin aplicar' : '') }), _jsx("button", { onClick: doApply, disabled: armed || !dirty, className: `px-4 py-1.5 text-[0.62rem] rounded border font-mono tracking-widest transition-all
            ${dirty && !armed
                            ? 'border-success text-success bg-success/10 hover:bg-success/20'
                            : 'border-frame text-muted'}
            disabled:opacity-30 disabled:cursor-not-allowed`, children: "APLICAR AL DRON" })] })] }));
}

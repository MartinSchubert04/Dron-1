import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
const MOTOR_LABELS = ['fl', 'fr', 'bl', 'br'];
export function MotorPanel({ armed, onSendRaw, onSetThrottle }) {
    const [stabilized, setStabilized] = useState(false);
    const [vals, setVals] = useState({ fl: 0, fr: 0, bl: 0, br: 0 });
    const [all, setAll] = useState(0);
    const updateMotor = useCallback((key, v) => {
        setVals(prev => {
            const next = { ...prev, [key]: v };
            if (armed)
                onSendRaw(next.fl, next.fr, next.bl, next.br);
            return next;
        });
    }, [armed, onSendRaw]);
    const updateAll = useCallback((v) => {
        setAll(v);
        if (stabilized) {
            // Manda throttle al PID — el firmware aplica correcciones IMU encima
            onSetThrottle(v);
        }
        else {
            // Control directo de los 4 motores sin PID
            const next = { fl: v, fr: v, bl: v, br: v };
            setVals(next);
            if (armed)
                onSendRaw(v, v, v, v);
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
    return (_jsxs("div", { className: "flex flex-1 flex-col gap-3 bg-surface border border-frame rounded-md p-4 min-h-0 overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsx("span", { className: "text-[0.65rem] text-white tracking-widest font-bold", children: "ESTABILIZACI\u00D3N" }), _jsx("span", { className: "text-[0.55rem] text-muted", children: stabilized
                                    ? 'ALL = throttle PID · IMU corrige inclinación'
                                    : 'ALL e individuales = PWM directo · sin corrección' })] }), _jsx("button", { onClick: toggleStabilized, className: `px-4 py-1.5 text-[0.68rem] font-mono tracking-widest rounded border transition-all flex-shrink-0
            ${stabilized
                            ? 'border-success text-success bg-success/10 hover:bg-success/20'
                            : 'border-frame  text-muted  bg-surface   hover:border-accent hover:text-accent'}`, children: stabilized ? 'ON' : 'OFF' })] }), _jsx("div", { className: "h-px bg-frame" }), !armed && (_jsx("p", { className: "text-center text-warn text-[0.62rem] tracking-widest", children: "Activ\u00E1 STBY + ARM para enviar comandos" })), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: `text-[0.65rem] w-7 flex-shrink-0 tracking-widest font-bold
          ${stabilized ? 'text-success' : 'text-warn'}`, children: "ALL" }), _jsx("input", { type: "range", min: 0, max: 255, value: all, onChange: e => updateAll(Number(e.target.value)), className: "flex-1 master-slider" }), _jsx("span", { className: `text-[0.65rem] w-8 text-right flex-shrink-0
          ${stabilized ? 'text-success' : 'text-warn'}`, children: all })] }), _jsx("div", { className: "h-px bg-frame" }), _jsx("div", { className: "flex flex-col gap-3", children: MOTOR_LABELS.map(key => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-muted text-[0.65rem] w-7 flex-shrink-0 tracking-widest uppercase", children: key }), _jsx("input", { type: "range", min: 0, max: 255, value: stabilized ? 0 : vals[key], disabled: stabilized, onChange: e => updateMotor(key, Number(e.target.value)), className: `flex-1 ${stabilized ? 'opacity-25 cursor-not-allowed' : ''}` }), _jsx("span", { className: `text-[0.65rem] w-8 text-right flex-shrink-0
              ${stabilized ? 'text-muted' : 'text-white'}`, children: stabilized ? '—' : vals[key] })] }, key))) }), stabilized && (_jsx("p", { className: "text-center text-[0.55rem] text-muted italic", children: "Sliders individuales deshabilitados en modo estabilizado" })), _jsx("button", { onClick: allZero, className: "self-center mt-1 px-6 py-1.5 border border-danger text-danger text-[0.68rem]\r\n                   tracking-widest rounded font-mono hover:bg-danger/15 transition-colors", children: "TODO A CERO" })] }));
}

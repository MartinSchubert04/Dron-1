import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import nipplejs from 'nipplejs';
export function JoystickPanel({ onLeftMove, onRightMove }) {
    const leftRef = useRef(null);
    const rightRef = useRef(null);
    // Usamos refs para los callbacks para evitar re-inicializar nipplejs en cada render
    const leftCb = useRef(onLeftMove);
    const rightCb = useRef(onRightMove);
    useEffect(() => { leftCb.current = onLeftMove; }, [onLeftMove]);
    useEffect(() => { rightCb.current = onRightMove; }, [onRightMove]);
    useEffect(() => {
        if (!leftRef.current || !rightRef.current)
            return;
        const left = nipplejs.create({
            zone: leftRef.current,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: '#4fc3f7',
            size: 120,
            restOpacity: 0.35,
        });
        const right = nipplejs.create({
            zone: rightRef.current,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: '#4fc3f7',
            size: 120,
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
    return (_jsxs("div", { className: "flex flex-1 gap-2 min-h-0", children: [_jsxs("div", { className: "flex flex-1 flex-col items-center gap-1 bg-surface border border-frame rounded-md p-2 min-h-0", children: [_jsx("span", { className: "text-accent text-[0.62rem] tracking-[3px] flex-shrink-0", children: "THR / YAW" }), _jsx("div", { ref: leftRef, className: "joy-zone flex-1 w-full relative min-h-0" }), _jsx("span", { className: "text-muted text-[0.48rem] flex-shrink-0", children: "\u25B2 Subir \u00B7 \u25C0\u25B6 Girar" })] }), _jsxs("div", { className: "flex flex-1 flex-col items-center gap-1 bg-surface border border-frame rounded-md p-2 min-h-0", children: [_jsx("span", { className: "text-accent text-[0.62rem] tracking-[3px] flex-shrink-0", children: "PITCH / ROLL" }), _jsx("div", { ref: rightRef, className: "joy-zone flex-1 w-full relative min-h-0" }), _jsx("span", { className: "text-muted text-[0.48rem] flex-shrink-0", children: "\u25B2\u25BC Adelante / Atr\u00E1s \u00B7 \u25C0\u25B6 Ladear" })] })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { init3D, updateAngles, updateMotors, resize3D, dispose3D } from '../drone3d';
export function DroneView3D({ roll, pitch, imuOk, motors }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const inited = useRef(false);
    // Inicializar Three.js una vez al montar
    useEffect(() => {
        if (!canvasRef.current)
            return;
        init3D(canvasRef.current);
        inited.current = true;
        const obs = new ResizeObserver(() => {
            if (canvasRef.current)
                resize3D(canvasRef.current);
        });
        if (containerRef.current)
            obs.observe(containerRef.current);
        return () => {
            obs.disconnect();
            dispose3D();
            inited.current = false;
        };
    }, []);
    // Actualizar rotación cuando llegan datos del MPU
    useEffect(() => {
        if (inited.current)
            updateAngles(roll, pitch);
    }, [roll, pitch]);
    // Actualizar velocidad de propelas según telemetría de motores
    useEffect(() => {
        if (inited.current)
            updateMotors(motors);
    }, [motors]);
    const imuColor = imuOk ? 'text-success' : 'text-danger';
    return (_jsxs("div", { ref: containerRef, className: "flex flex-1 flex-col relative bg-bg border border-frame rounded-md overflow-hidden min-h-0", children: [_jsx("canvas", { ref: canvasRef, className: "absolute inset-0 w-full h-full" }), _jsxs("div", { className: "absolute top-2.5 left-3 flex flex-col gap-1.5 pointer-events-none select-none", children: [_jsx(HudRow, { label: "ROLL", value: `${roll.toFixed(1)}°` }), _jsx(HudRow, { label: "PITCH", value: `${pitch.toFixed(1)}°` }), _jsx(HudRow, { label: "IMU", value: imuOk ? 'OK' : 'FALLO', valueClass: imuColor })] }), _jsxs("div", { className: "absolute bottom-2.5 right-3 flex items-center gap-2 pointer-events-none select-none\n                      text-muted text-[0.48rem] tracking-widest", children: [_jsx("span", { className: "inline-block w-2 h-2 rounded-sm bg-danger flex-shrink-0" }), "FRENTE", _jsx("span", { className: "mx-1 text-frame", children: "|" }), _jsx("span", { className: "inline-block w-2 h-2 rounded-sm bg-accent flex-shrink-0" }), "ATR\u00C1S"] })] }));
}
function HudRow({ label, value, valueClass = 'text-accent', }) {
    return (_jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("span", { className: "text-muted text-[0.52rem] tracking-widest w-9 flex-shrink-0", children: label }), _jsx("span", { className: `text-[0.68rem] font-mono ${valueClass}`, children: value })] }));
}

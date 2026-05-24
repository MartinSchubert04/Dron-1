import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { useDrone } from './hooks/useDrone';
import { Header } from './components/Header';
import { JoystickPanel } from './components/JoystickPanel';
import { MotorPanel } from './components/MotorPanel';
import { ConfigPanel } from './components/ConfigPanel';
import { DroneView3D } from './components/DroneView3D';
const TABS = [
    { id: 'joysticks', label: 'JOYSTICKS' },
    { id: 'motors', label: 'MOTORES' },
    { id: '3d', label: '3D' },
    { id: 'config', label: 'CONFIG' },
];
export default function App() {
    const drone = useDrone();
    const [panel, setPanel] = useState('joysticks');
    const switchPanel = useCallback((next) => {
        if (next !== 'joysticks')
            drone.resetJoysticks();
        setPanel(next);
    }, [drone]);
    const handleLeftMove = useCallback((t, y) => drone.setLeftJoy(t, y), [drone]);
    const handleRightMove = useCallback((p, r) => drone.setRightJoy(p, r), [drone]);
    return (_jsxs("div", { className: "flex flex-col h-dvh bg-bg text-white font-mono text-sm p-2 gap-2 overflow-hidden select-none", children: [_jsx(Header, { drone: drone }), _jsx("div", { className: "flex gap-2 flex-shrink-0", children: TABS.map(t => (_jsx("button", { onClick: () => switchPanel(t.id), className: `flex-1 py-1 text-[0.65rem] tracking-widest rounded border font-mono transition-all
              ${panel === t.id
                        ? 'border-accent text-accent bg-accent/10'
                        : 'border-frame text-muted bg-surface hover:text-white'}`, children: t.label }, t.id))) }), panel === 'joysticks' && (_jsx(JoystickPanel, { onLeftMove: handleLeftMove, onRightMove: handleRightMove })), panel === 'motors' && (_jsx(MotorPanel, { armed: drone.armed, onSendRaw: drone.sendRaw, onSetThrottle: (t) => { drone.setLeftJoy(t, 0); drone.setRightJoy(0, 0); } })), panel === 'config' && (_jsx(ConfigPanel, { config: drone.config, armed: drone.armed, configMsg: drone.configMsg, onApply: drone.applyConfig, onReset: drone.resetConfig, onFetch: drone.fetchConfig })), panel === '3d' && (_jsx(DroneView3D, { roll: drone.roll, pitch: drone.pitch, imuOk: drone.imuOk, motors: drone.motors })), panel === 'joysticks' && (_jsx("p", { className: "text-[0.48rem] text-muted text-center tracking-wide flex-shrink-0", children: "W/S = Throttle \u00B7 A/D = Yaw \u00B7 \u2191\u2193 = Pitch \u00B7 \u2190\u2192 = Roll \u00B7 Espacio = ARM/DISARM" }))] }));
}

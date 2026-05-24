import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Header({ drone }) {
    const { url, setUrl, connState, armed, stbyOn, motors, roll, pitch, imuOk, calibState, calibrate, connect, disconnect, toggleArm, toggleStby } = drone;
    const calibLabel = {
        idle: 'CAL',
        running: 'CAL…',
        done: 'CAL ✓',
        error: 'CAL ✗',
    };
    const calibColor = {
        idle: 'border-frame text-muted hover:border-accent hover:text-accent',
        running: 'border-warn text-warn animate-pulse cursor-wait',
        done: 'border-success text-success',
        error: 'border-danger text-danger',
    };
    const connected = connState === 'connected';
    const connecting = connState === 'connecting';
    // Color de cada barra de motor según intensidad
    const barColor = (v) => v > 180 ? '#ef5350' : v > 100 ? '#ffa726' : '#4fc3f7';
    return (_jsxs("header", { className: "flex-shrink-0 bg-surface border border-frame rounded-md p-2 flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "text-accent text-xs tracking-[4px] whitespace-nowrap font-bold", children: "DRONE CTRL" }), _jsx("input", { className: "flex-1 min-w-[160px] bg-transparent border border-frame rounded px-2 py-1\r\n                     text-muted text-[0.68rem] font-mono outline-none\r\n                     focus:border-accent focus:text-white transition-colors", value: url, onChange: e => setUrl(e.target.value), onKeyDown: e => e.key === 'Enter' && !connected && connect(), disabled: connected, spellCheck: false }), _jsx("button", { onClick: connected ? disconnect : connect, disabled: connecting, className: `px-3 py-1 text-[0.68rem] rounded border font-mono tracking-widest transition-all
            ${connected ? 'border-danger  text-danger  hover:bg-danger/10'
                            : connecting ? 'border-frame   text-muted   cursor-not-allowed opacity-50'
                                : 'border-accent  text-accent  hover:bg-accent/10'}`, children: connected ? 'DESCONECTAR' : connecting ? 'CONECTANDO…' : 'CONECTAR' }), _jsx("span", { className: `inline-block w-2 h-2 rounded-full flex-shrink-0 transition-all
          ${connected ? 'bg-success shadow-[0_0_6px_#66bb6a]' : 'bg-danger'}` }), _jsx("span", { className: "text-[0.68rem] text-muted whitespace-nowrap", children: connected ? 'Online' : connecting ? 'Conectando…' : 'Offline' })] }), _jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsx("button", { onClick: toggleStby, disabled: !connected, className: `px-3 py-1 text-[0.68rem] rounded border font-mono tracking-widest transition-all flex-shrink-0
            ${stbyOn ? 'border-warn text-warn bg-warn/10'
                            : 'border-frame text-muted hover:border-frame hover:text-white'}
            disabled:opacity-30 disabled:cursor-not-allowed`, children: stbyOn ? 'STBY ON' : 'STBY OFF' }), _jsx("div", { className: "flex-1 grid grid-cols-4 gap-x-3 gap-y-0.5 min-w-[160px]", children: ['FL', 'FR', 'BL', 'BR'].map((lbl, i) => (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-[0.55rem] text-muted w-4 flex-shrink-0", children: lbl }), _jsx("div", { className: "flex-1 h-1.5 bg-frame rounded-full overflow-hidden", children: _jsx("div", { className: "h-full rounded-full motor-bar", style: { width: `${(motors[i] / 255) * 100}%`, backgroundColor: barColor(motors[i]) } }) }), _jsx("span", { className: "text-[0.52rem] text-muted w-5 text-right flex-shrink-0", children: motors[i] })] }, lbl))) }), imuOk && (_jsxs("div", { className: "flex items-center gap-2 flex-shrink-0", children: [_jsxs("span", { className: "text-[0.55rem] text-muted", children: ["R:", _jsxs("span", { className: `ml-0.5 ${Math.abs(roll) > 5 ? 'text-warn' : 'text-white'}`, children: [roll.toFixed(1), "\u00B0"] })] }), _jsxs("span", { className: "text-[0.55rem] text-muted", children: ["P:", _jsxs("span", { className: `ml-0.5 ${Math.abs(pitch) > 5 ? 'text-warn' : 'text-white'}`, children: [pitch.toFixed(1), "\u00B0"] })] }), _jsx("button", { onClick: calibrate, disabled: !connected || calibState === 'running' || armed, title: armed
                                    ? 'Desarma antes de calibrar'
                                    : 'Poné el dron a nivel y presioná para calibrar el IMU', className: `px-2 py-0.5 text-[0.55rem] font-mono tracking-widest rounded border transition-all
                ${calibColor[calibState]}
                disabled:opacity-30 disabled:cursor-not-allowed`, children: calibLabel[calibState] })] })), _jsx("span", { className: `text-[0.58rem] tracking-widest font-bold flex-shrink-0 ${armed ? 'text-danger' : 'text-muted'}`, children: armed ? 'ARMADO' : 'DESARMADO' }), _jsx("button", { onClick: toggleArm, disabled: !stbyOn || !connected, className: `px-3 py-1 text-[0.68rem] rounded border font-mono tracking-widest transition-all flex-shrink-0
            ${armed ? 'border-danger text-danger bg-danger/10 hover:bg-danger/20'
                            : 'border-success text-success hover:bg-success/10'}
            disabled:opacity-30 disabled:cursor-not-allowed`, children: armed ? 'DISARM' : 'ARM' })] })] }));
}

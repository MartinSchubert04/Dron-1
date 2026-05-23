import type { DroneHook, CalibState } from '../hooks/useDrone';

interface Props {
  drone: DroneHook;
}

export function Header({ drone }: Props) {
  const { url, setUrl, connState, armed, stbyOn, motors, roll, pitch, imuOk,
          calibState, calibrate,
          connect, disconnect, toggleArm, toggleStby } = drone;

  const calibLabel: Record<CalibState, string> = {
    idle:    'CAL',
    running: 'CAL…',
    done:    'CAL ✓',
    error:   'CAL ✗',
  };
  const calibColor: Record<CalibState, string> = {
    idle:    'border-frame text-muted hover:border-accent hover:text-accent',
    running: 'border-warn text-warn animate-pulse cursor-wait',
    done:    'border-success text-success',
    error:   'border-danger text-danger',
  };

  const connected  = connState === 'connected';
  const connecting = connState === 'connecting';

  // Color de cada barra de motor según intensidad
  const barColor = (v: number) =>
    v > 180 ? '#ef5350' : v > 100 ? '#ffa726' : '#4fc3f7';

  return (
    <header className="flex-shrink-0 bg-surface border border-frame rounded-md p-2 flex flex-col gap-2">

      {/* Fila 1: título + conexión */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-accent text-xs tracking-[4px] whitespace-nowrap font-bold">
          DRONE CTRL
        </span>

        <input
          className="flex-1 min-w-[160px] bg-transparent border border-frame rounded px-2 py-1
                     text-muted text-[0.68rem] font-mono outline-none
                     focus:border-accent focus:text-white transition-colors"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !connected && connect()}
          disabled={connected}
          spellCheck={false}
        />

        <button
          onClick={connected ? disconnect : connect}
          disabled={connecting}
          className={`px-3 py-1 text-[0.68rem] rounded border font-mono tracking-widest transition-all
            ${connected   ? 'border-danger  text-danger  hover:bg-danger/10'
            : connecting  ? 'border-frame   text-muted   cursor-not-allowed opacity-50'
                          : 'border-accent  text-accent  hover:bg-accent/10'}`}
        >
          {connected ? 'DESCONECTAR' : connecting ? 'CONECTANDO…' : 'CONECTAR'}
        </button>

        {/* Status dot */}
        <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 transition-all
          ${connected ? 'bg-success shadow-[0_0_6px_#66bb6a]' : 'bg-danger'}`} />
        <span className="text-[0.68rem] text-muted whitespace-nowrap">
          {connected ? 'Online' : connecting ? 'Conectando…' : 'Offline'}
        </span>
      </div>

      {/* Fila 2: STBY + barras de motor + IMU + estado + ARM */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* STBY */}
        <button
          onClick={toggleStby}
          disabled={!connected}
          className={`px-3 py-1 text-[0.68rem] rounded border font-mono tracking-widest transition-all flex-shrink-0
            ${stbyOn  ? 'border-warn text-warn bg-warn/10'
                      : 'border-frame text-muted hover:border-frame hover:text-white'}
            disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          {stbyOn ? 'STBY ON' : 'STBY OFF'}
        </button>

        {/* Barras de telemetría */}
        <div className="flex-1 grid grid-cols-4 gap-x-3 gap-y-0.5 min-w-[160px]">
          {(['FL', 'FR', 'BL', 'BR'] as const).map((lbl, i) => (
            <div key={lbl} className="flex items-center gap-1.5">
              <span className="text-[0.55rem] text-muted w-4 flex-shrink-0">{lbl}</span>
              <div className="flex-1 h-1.5 bg-frame rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full motor-bar"
                  style={{ width: `${(motors[i] / 255) * 100}%`, backgroundColor: barColor(motors[i]) }}
                />
              </div>
              <span className="text-[0.52rem] text-muted w-5 text-right flex-shrink-0">{motors[i]}</span>
            </div>
          ))}
        </div>

        {/* IMU + botón de calibración */}
        {imuOk && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[0.55rem] text-muted">
              R:<span className={`ml-0.5 ${Math.abs(roll)  > 5 ? 'text-warn' : 'text-white'}`}>{roll.toFixed(1)}°</span>
            </span>
            <span className="text-[0.55rem] text-muted">
              P:<span className={`ml-0.5 ${Math.abs(pitch) > 5 ? 'text-warn' : 'text-white'}`}>{pitch.toFixed(1)}°</span>
            </span>
            <button
              onClick={calibrate}
              disabled={!connected || calibState === 'running' || armed}
              title={armed
                ? 'Desarma antes de calibrar'
                : 'Poné el dron a nivel y presioná para calibrar el IMU'}
              className={`px-2 py-0.5 text-[0.55rem] font-mono tracking-widest rounded border transition-all
                ${calibColor[calibState]}
                disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {calibLabel[calibState]}
            </button>
          </div>
        )}

        {/* Estado armado */}
        <span className={`text-[0.58rem] tracking-widest font-bold flex-shrink-0 ${armed ? 'text-danger' : 'text-muted'}`}>
          {armed ? 'ARMADO' : 'DESARMADO'}
        </span>

        {/* ARM / DISARM */}
        <button
          onClick={toggleArm}
          disabled={!stbyOn || !connected}
          className={`px-3 py-1 text-[0.68rem] rounded border font-mono tracking-widest transition-all flex-shrink-0
            ${armed  ? 'border-danger text-danger bg-danger/10 hover:bg-danger/20'
                     : 'border-success text-success hover:bg-success/10'}
            disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          {armed ? 'DISARM' : 'ARM'}
        </button>

      </div>
    </header>
  );
}

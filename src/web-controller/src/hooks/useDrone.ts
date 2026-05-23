import { useState, useRef, useCallback, useEffect } from 'react';

export type ConnState = 'disconnected' | 'connecting' | 'connected';

export type CalibState = 'idle' | 'running' | 'done' | 'error';

export interface DroneHook {
  url: string;
  setUrl: (url: string) => void;
  connState: ConnState;
  armed: boolean;
  stbyOn: boolean;
  motors: number[];
  roll: number;
  pitch: number;
  imuOk: boolean;
  calibState: CalibState;
  calibrate: () => void;
  connect: () => void;
  disconnect: () => void;
  toggleArm: () => void;
  toggleStby: () => void;
  setLeftJoy: (t: number, y: number) => void;
  setRightJoy: (p: number, r: number) => void;
  resetJoysticks: () => void;
  sendRaw: (fl: number, fr: number, bl: number, br: number) => void;
}

const DEFAULT_URL = 'ws://drone.local:81';
const SEND_MS = 50;
const TRACKED_KEYS = new Set([
  'w', 'W', 's', 'S', 'a', 'A', 'd', 'D',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

export function useDrone(): DroneHook {
  const [url, setUrl]         = useState(DEFAULT_URL);
  const [connState, setConn]  = useState<ConnState>('disconnected');
  const [armed, setArmed]     = useState(false);
  const [stbyOn, setStbyOn]   = useState(false);
  const [motors, setMotors]   = useState([0, 0, 0, 0]);
  const [roll, setRoll]             = useState(0);
  const [pitch, setPitch]           = useState(0);
  const [imuOk, setImuOk]           = useState(false);
  const [calibState, setCalibState] = useState<CalibState>('idle');
  const calibTimer                  = useRef<number | null>(null);

  const wsRef         = useRef<WebSocket | null>(null);
  const armedRef      = useRef(false);
  const stbyRef       = useRef(false);
  const sendTimer     = useRef<number | null>(null);
  const reconnTimer   = useRef<number | null>(null);
  const leftJoy       = useRef({ t: 0, y: 0 });
  const rightJoy      = useRef({ p: 0, r: 0 });
  const keysHeld      = useRef(new Set<string>());
  const urlRef        = useRef(url);
  const shouldReconn  = useRef(true);

  useEffect(() => { urlRef.current = url; }, [url]);

  const send = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const stopLoop = useCallback(() => {
    if (sendTimer.current !== null) {
      clearInterval(sendTimer.current);
      sendTimer.current = null;
    }
  }, []);

  const startLoop = useCallback(() => {
    if (sendTimer.current !== null) return;
    sendTimer.current = window.setInterval(() => {
      if (!armedRef.current) return;
      const keys = keysHeld.current;
      const hasKey = (k: string) => keys.has(k);

      const t = hasKey('w') || hasKey('W') ? 180
              : hasKey('s') || hasKey('S') ? 0
              : leftJoy.current.t;

      const y = (hasKey('d') || hasKey('D') ? 100 : 0)
              - (hasKey('a') || hasKey('A') ? 100 : 0)
              || leftJoy.current.y;

      const p = (hasKey('ArrowUp') ? 100 : 0)
              - (hasKey('ArrowDown') ? 100 : 0)
              || rightJoy.current.p;

      const r = (hasKey('ArrowRight') ? 100 : 0)
              - (hasKey('ArrowLeft') ? 100 : 0)
              || rightJoy.current.r;

      send({ cmd: 'move', t, y, p, r });
    }, SEND_MS);
  }, [send]);

  const connect = useCallback(() => {
    if (reconnTimer.current !== null) {
      clearTimeout(reconnTimer.current);
      reconnTimer.current = null;
    }
    // Cierra socket previo sin disparar auto-reconexión
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    shouldReconn.current = true;
    setConn('connecting');

    const ws = new WebSocket(urlRef.current.trim() || DEFAULT_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConn('connected');
      startLoop();
    };

    ws.onclose = () => {
      setConn('disconnected');
      armedRef.current = false; stbyRef.current = false;
      setArmed(false); setStbyOn(false);
      stopLoop();
      if (shouldReconn.current) {
        reconnTimer.current = window.setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => ws.close();

    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data as string);
        if (Array.isArray(msg.motors))        setMotors(msg.motors);
        if (typeof msg.armed   === 'boolean') { armedRef.current = msg.armed; setArmed(msg.armed); }
        if (typeof msg.stby    === 'boolean') { stbyRef.current  = msg.stby;  setStbyOn(msg.stby); }
        if (typeof msg.roll    === 'number')  setRoll(msg.roll);
        if (typeof msg.pitch   === 'number')  setPitch(msg.pitch);
        if (typeof msg.imu     === 'boolean') setImuOk(msg.imu);
        if (msg.calibStatus === 'running') {
          setCalibState('running');
        } else if (msg.calibStatus === 'done') {
          setCalibState('done');
          if (calibTimer.current) clearTimeout(calibTimer.current);
          calibTimer.current = window.setTimeout(() => setCalibState('idle'), 4000);
        } else if (msg.calibStatus === 'error') {
          setCalibState('error');
          if (calibTimer.current) clearTimeout(calibTimer.current);
          calibTimer.current = window.setTimeout(() => setCalibState('idle'), 3000);
        }
      } catch { /* ignore */ }
    };
  }, [startLoop, stopLoop]);

  const disconnect = useCallback(() => {
    shouldReconn.current = false;
    if (reconnTimer.current !== null) { clearTimeout(reconnTimer.current); reconnTimer.current = null; }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    armedRef.current = false; stbyRef.current = false;
    setConn('disconnected'); setArmed(false); setStbyOn(false);
    stopLoop();
  }, [stopLoop]);

  const toggleArm = useCallback(() => {
    if (!stbyRef.current) return;
    send({ cmd: armedRef.current ? 'disarm' : 'arm' });
  }, [send]);

  const toggleStby = useCallback(() => {
    const next = !stbyRef.current;
    send({ cmd: 'stby', val: next });
  }, [send]);

  const calibrate = useCallback(() => {
    send({ cmd: 'calibrate' });
    setCalibState('running');
  }, [send]);

  const setLeftJoy  = useCallback((t: number, y: number) => { leftJoy.current  = { t, y }; }, []);
  const setRightJoy = useCallback((p: number, r: number) => { rightJoy.current = { p, r }; }, []);

  const resetJoysticks = useCallback(() => {
    leftJoy.current  = { t: 0, y: 0 };
    rightJoy.current = { p: 0, r: 0 };
  }, []);

  const sendRaw = useCallback((fl: number, fr: number, bl: number, br: number) => {
    send({ cmd: 'raw', fl, fr, bl, br });
  }, [send]);

  // Teclado
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (stbyRef.current) send({ cmd: armedRef.current ? 'disarm' : 'arm' });
        return;
      }
      if (TRACKED_KEYS.has(e.key)) { e.preventDefault(); keysHeld.current.add(e.key); }
    };
    const up = (e: KeyboardEvent) => keysHeld.current.delete(e.key);
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    return () => { document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); };
  }, [send]);

  // Auto-connect al montar
  useEffect(() => {
    connect();
    return () => {
      shouldReconn.current = false;
      stopLoop();
      if (reconnTimer.current !== null) clearTimeout(reconnTimer.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    url, setUrl, connState, armed, stbyOn, motors, roll, pitch, imuOk,
    calibState, calibrate,
    connect, disconnect, toggleArm, toggleStby,
    setLeftJoy, setRightJoy, resetJoysticks, sendRaw,
  };
}

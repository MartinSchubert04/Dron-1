import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  Animated,
  PanResponder,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DEBUG, DEBUG_IP } from './config';

// ── Theme ─────────────────────────────────────────────────────────────────────

const C = {
  bg:     '#0d0d0d',
  panel:  '#1a1a1a',
  border: '#2a2a2a',
  text:   '#ffffff',
  muted:  '#666',
  armed:  '#e74c3c',
  safe:   '#2ecc71',
  accent: '#3498db',
};

// ── Toast ─────────────────────────────────────────────────────────────────────

function useToast() {
  const opacity  = useRef(new Animated.Value(0)).current;
  const [msg, setMsg] = useState('');

  const show = useCallback((text: string) => {
    setMsg(text);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [opacity]);

  const element = (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.toastText}>{msg}</Text>
    </Animated.View>
  );

  return { show, element };
}

// ── Joystick ──────────────────────────────────────────────────────────────────

interface JoystickProps {
  label: string;
  onMove: (x: number, y: number) => void;
}

function Joystick({ label, onMove }: JoystickProps) {
  const BASE = 150;
  const KNOB = 52;
  const MAX  = (BASE - KNOB) / 2;

  const pos = useRef(new Animated.ValueXY()).current;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderMove: (_, g) => {
        const x = Math.max(-MAX, Math.min(MAX, g.dx));
        const y = Math.max(-MAX, Math.min(MAX, g.dy));
        pos.setValue({ x, y });
        onMove(x / MAX, -(y / MAX));
      },
      onPanResponderRelease: () => {
        Animated.spring(pos, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          friction: 5,
          tension: 80,
        }).start();
        onMove(0, 0);
      },
    })
  ).current;

  return (
    <View style={styles.joystickWrap}>
      <View style={[styles.joystickBase, { width: BASE, height: BASE, borderRadius: BASE / 2 }]}>
        <View style={[styles.crossH, { width: BASE - 20 }]} />
        <View style={[styles.crossV, { height: BASE - 20 }]} />
        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.joystickKnob,
            { width: KNOB, height: KNOB, borderRadius: KNOB / 2 },
            { transform: [{ translateX: pos.x }, { translateY: pos.y }] },
          ]}
        />
      </View>
      <Text style={styles.joystickLabel}>{label}</Text>
    </View>
  );
}

// ── Motor bar ─────────────────────────────────────────────────────────────────

function MotorBar({ label, value }: { label: string; value: number }) {
  const pct   = value / 255;
  const color = pct > 0.7 ? C.armed : pct > 0.3 ? '#f39c12' : C.accent;
  return (
    <View style={styles.motorBox}>
      <Text style={styles.motorLabel}>{label}</Text>
      <View style={styles.motorTrack}>
        <View style={[styles.motorFill, { height: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.motorVal}>{value}</Text>
    </View>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

type ConnState = 'disconnected' | 'connecting' | 'connected';

export default function App() {
  const [ip,        setIp]       = useState(DEBUG ? DEBUG_IP : 'drone.local');
  const [connState, setConnState]= useState<ConnState>('disconnected');
  const [armed,     setArmed]    = useState(false);
  const [motors,    setMotors]   = useState([0, 0, 0, 0]);

  const wsRef    = useRef<WebSocket | null>(null);
  const leftJoy  = useRef({ x: 0, y: 0 });
  const rightJoy = useRef({ x: 0, y: 0 });
  const armedRef = useRef(false);
  const cmdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const toast = useToast();

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const send = useCallback((obj: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }, []);

  const stopLoop = useCallback(() => {
    if (cmdTimer.current) { clearInterval(cmdTimer.current); cmdTimer.current = null; }
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    cmdTimer.current = setInterval(() => {
      if (!armedRef.current) return;
      send({
        cmd: 'move',
        t: Math.round(Math.max(0, leftJoy.current.y)  * 255),
        y: Math.round(leftJoy.current.x  * 127),
        p: Math.round(rightJoy.current.y * 127),
        r: Math.round(rightJoy.current.x * 127),
      });
    }, 50);
  }, [send, stopLoop]);

  // ── Connect / Disconnect ────────────────────────────────────────────────────

  const connect = useCallback(() => {
    const addr = ip.trim();
    if (!addr) return;
    setConnState('connecting');

    const socket = new WebSocket(`ws://${addr}:81`);
    wsRef.current = socket;

    socket.onopen = () => {
      setConnState('connected');
      startLoop();
    };
    socket.onclose = () => {
      setConnState('disconnected');
      setArmed(false);
      armedRef.current = false;
      stopLoop();
      toast.show(`Desconectado de ${addr}`);
    };
    socket.onerror = () => {
      setConnState('disconnected');
      toast.show(`No se pudo conectar a ${addr}`);
    };
    socket.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data as string);
        if (Array.isArray(d.motors)) setMotors(d.motors);
      } catch { /* ignore */ }
    };
  }, [ip, startLoop, stopLoop, toast]);

  const disconnect = useCallback(() => {
    send({ cmd: 'disarm' });
    wsRef.current?.close();
  }, [send]);

  const toggleArm = useCallback(() => {
    if (!armedRef.current) {
      armedRef.current = true;
      setArmed(true);
      send({ cmd: 'arm' });
    } else {
      armedRef.current = false;
      setArmed(false);
      send({ cmd: 'disarm' });
    }
  }, [send]);

  useEffect(() => () => { stopLoop(); wsRef.current?.close(); }, [stopLoop]);
  useEffect(() => { if (DEBUG) connect(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ─────────────────────────────────────────────────────────────────

  const connected   = connState === 'connected';
  const connecting  = connState === 'connecting';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>

        {/* IP + connect */}
        <View style={styles.connectionRow}>
          <TextInput
            style={[styles.ipInput, connected && styles.ipInputConnected]}
            value={ip}
            onChangeText={setIp}
            placeholder="192.168.1.100"
            placeholderTextColor={C.muted}
            keyboardType="numeric"
            autoCapitalize="none"
            editable={!connected}
            returnKeyType="done"
            onSubmitEditing={!connected ? connect : undefined}
          />
          <TouchableOpacity
            style={[styles.connBtn, connected ? styles.connBtnDisconn : connecting && styles.connBtnConnecting]}
            onPress={connected ? disconnect : connect}
            disabled={connecting}
            activeOpacity={0.8}
          >
            <Text style={styles.connBtnText}>
              {connected ? 'Desconectar' : connecting ? 'Conectando…' : 'Conectar'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status badges */}
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: connected ? '#1a4a1a' : '#2a1a1a' }]}>
            <View style={[styles.dot, { backgroundColor: connected ? C.safe : '#555' }]} />
            <Text style={styles.badgeText}>{connected ? 'Online' : 'Offline'}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: armed ? '#3a1010' : '#1e1e1e' }]}>
            <Text style={[styles.badgeText, { color: armed ? C.armed : C.muted, fontWeight: 'bold' }]}>
              {armed ? 'ARMADO' : 'DESARMADO'}
            </Text>
          </View>
        </View>

      </View>

      {/* ── Motor bars ── */}
      <View style={styles.motorRow}>
        <MotorBar label="FL" value={motors[0]} />
        <MotorBar label="FR" value={motors[1]} />
        <MotorBar label="BL" value={motors[2]} />
        <MotorBar label="BR" value={motors[3]} />
      </View>

      {/* ── Controls ── */}
      <View style={styles.controls}>
        <Joystick label="Throttle / Yaw"  onMove={(x, y) => { leftJoy.current  = { x, y }; }} />

        <TouchableOpacity
          style={[styles.armBtn, armed && styles.armBtnArmed, !connected && styles.armBtnDisabled]}
          onPress={connected ? toggleArm : undefined}
          activeOpacity={connected ? 0.85 : 1}
        >
          <Text style={styles.armBtnText}>{armed ? 'DISARM' : 'ARM'}</Text>
        </TouchableOpacity>

        <Joystick label="Pitch / Roll" onMove={(x, y) => { rightJoy.current = { x, y }; }} />
      </View>

      {/* ── Toast ── */}
      {toast.element}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 12,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  ipInput: {
    flex: 1,
    backgroundColor: '#111',
    color: C.text,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  ipInputConnected: {
    color: C.muted,
    borderColor: '#1a3a1a',
  },
  connBtn: {
    backgroundColor: C.accent,
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  connBtnDisconn: {
    backgroundColor: '#5a1a1a',
  },
  connBtnConnecting: {
    backgroundColor: '#2a2a2a',
  },
  connBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  badgeText: {
    color: C.text,
    fontSize: 11,
  },

  // Motors
  motorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  motorBox: {
    alignItems: 'center',
    gap: 3,
  },
  motorLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: 'bold',
  },
  motorTrack: {
    width: 16,
    height: 48,
    backgroundColor: '#1e1e1e',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: C.border,
  },
  motorFill: {
    width: '100%',
    borderRadius: 3,
  },
  motorVal: {
    color: C.text,
    fontSize: 9,
  },

  // Controls
  controls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },

  // Joystick
  joystickWrap: {
    alignItems: 'center',
    gap: 6,
  },
  joystickLabel: {
    color: C.muted,
    fontSize: 11,
  },
  joystickBase: {
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossH: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#252525',
  },
  crossV: {
    position: 'absolute',
    width: 1,
    backgroundColor: '#252525',
  },
  joystickKnob: {
    position: 'absolute',
    backgroundColor: C.accent,
    borderWidth: 2,
    borderColor: '#5dade2',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },

  // Arm button
  armBtn: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: C.safe,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#27ae60',
    shadowColor: C.safe,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 5,
  },
  armBtnArmed: {
    backgroundColor: C.armed,
    borderColor: '#c0392b',
    shadowColor: C.armed,
  },
  armBtnDisabled: {
    backgroundColor: '#2a2a2a',
    borderColor: '#333',
    shadowOpacity: 0,
    elevation: 0,
  },
  armBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#222',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  toastText: {
    color: C.text,
    fontSize: 13,
  },
});

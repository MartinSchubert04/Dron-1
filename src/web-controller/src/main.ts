import nipplejs from 'nipplejs';

const DEFAULT_URL = 'ws://drone.local:81';
const SEND_MS = 50;

// ── State ──────────────────────────────────────────────────────────────────────

let ws: WebSocket | null = null;
let armed = false;
let stbyOn = false;
let mode: 'joystick' | 'manual' = 'joystick';
let sendInterval: number | null = null;

// Joystick axes
let throttle = 0; // 0..255
let yaw      = 0; // -127..127
let pitch    = 0; // -127..127
let roll     = 0; // -127..127

// Raw motor values (manual mode)
const raw = { fl: 0, fr: 0, bl: 0, br: 0 };

// Keyboard state
const keysHeld = new Set<string>();

// ── DOM ────────────────────────────────────────────────────────────────────────

const $dot      = document.getElementById('status-dot')!;
const $statusTx = document.getElementById('status-text')!;
const $armBtn   = document.getElementById('arm-btn')   as HTMLButtonElement;
const $stbyBtn  = document.getElementById('stby-btn')  as HTMLButtonElement;
const $stbyLbl  = document.getElementById('stby-lbl')!;
const $armedLbl = document.getElementById('armed-lbl')!;
const $urlInput = document.getElementById('ws-url')    as HTMLInputElement;
const $panelJoy = document.getElementById('panel-joy')!;
const $panelRaw = document.getElementById('panel-raw')!;
const $tabJoy   = document.getElementById('tab-joy')   as HTMLButtonElement;
const $tabRaw   = document.getElementById('tab-raw')   as HTMLButtonElement;
const $kbHint   = document.querySelector('.kb-hint')!;

// Telemetry bars
const motorEls = (['fl', 'fr', 'bl', 'br'] as const).map(id => ({
  bar: document.getElementById(`bar-${id}`)!,
  val: document.getElementById(`val-${id}`)!,
}));

// Raw sliders
const sliders = (['fl', 'fr', 'bl', 'br'] as const).map(id => ({
  input: document.getElementById(`sl-${id}`) as HTMLInputElement,
  label: document.getElementById(`sv-${id}`)!,
  key: id,
}));
const $slAll = document.getElementById('sl-all') as HTMLInputElement;
const $svAll = document.getElementById('sv-all')!;

// ── WebSocket ──────────────────────────────────────────────────────────────────

function send(msg: object) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function startLoop() {
  if (sendInterval !== null) return;
  sendInterval = window.setInterval(() => {
    if (!armed) return;
    if (mode === 'joystick') {
      send({ cmd: 'move', t: getThrottle(), y: getYaw(), p: getPitch(), r: getRoll() });
    } else {
      send({ cmd: 'raw', fl: raw.fl, fr: raw.fr, bl: raw.bl, br: raw.br });
    }
  }, SEND_MS);
}

function stopLoop() {
  if (sendInterval !== null) { clearInterval(sendInterval); sendInterval = null; }
}

function connect() {
  const url = $urlInput.value.trim() || DEFAULT_URL;
  ws = new WebSocket(url);

  ws.onopen = () => {
    $dot.classList.add('connected');
    $statusTx.textContent = 'Conectado';
    startLoop();
  };

  ws.onclose = () => {
    $dot.classList.remove('connected');
    $statusTx.textContent = 'Reconectando...';
    armed = false; stbyOn = false;
    stopLoop();
    renderUI();
    setTimeout(connect, 2000);
  };

  ws.onerror = () => ws?.close();

  ws.onmessage = ({ data }) => {
    try {
      const msg = JSON.parse(data as string);
      if (typeof msg.armed === 'boolean') {
        const wasArmed = armed;
        armed = msg.armed;
        if (typeof msg.stby === 'boolean') stbyOn = msg.stby;
        renderMotors(msg.motors ?? [0, 0, 0, 0]);
        if (wasArmed && !armed) resetRaw(); // servidor desarmó → limpiar sliders
        renderUI();
      }
    } catch { /* ignore */ }
  };
}

// ── Axes: keyboard overrides joystick when keys are held ──────────────────────

function getThrottle() {
  return keysHeld.size > 0
    ? ((keysHeld.has('w') || keysHeld.has('W')) ? 180 : 0)
    : throttle;
}
function getYaw() {
  return keysHeld.size > 0
    ? (keysHeld.has('d') || keysHeld.has('D') ? 100 : 0) - (keysHeld.has('a') || keysHeld.has('A') ? 100 : 0)
    : yaw;
}
function getPitch() {
  return keysHeld.size > 0
    ? (keysHeld.has('ArrowUp') ? 100 : 0) - (keysHeld.has('ArrowDown') ? 100 : 0)
    : pitch;
}
function getRoll() {
  return keysHeld.size > 0
    ? (keysHeld.has('ArrowRight') ? 100 : 0) - (keysHeld.has('ArrowLeft') ? 100 : 0)
    : roll;
}

// ── UI rendering ───────────────────────────────────────────────────────────────

function renderUI() {
  $armBtn.textContent     = armed ? 'DISARM' : 'ARM';
  $armBtn.dataset.armed   = String(armed);
  $armBtn.disabled        = !stbyOn;
  $armedLbl.textContent   = armed ? 'ARMADO' : 'DESARMADO';
  $armedLbl.dataset.armed = String(armed);
  $stbyBtn.textContent    = stbyOn ? 'STBY ON' : 'STBY OFF';
  $stbyBtn.dataset.on     = String(stbyOn);
  $stbyLbl.textContent    = stbyOn ? 'Motores: ACTIVOS' : 'Motores: STANDBY';
}

function renderMotors(vals: number[]) {
  motorEls.forEach(({ bar, val }, i) => {
    bar.style.width   = `${Math.round((vals[i] / 255) * 100)}%`;
    val.textContent   = String(vals[i]);
  });
}

// ── Mode switching ─────────────────────────────────────────────────────────────

function setMode(newMode: 'joystick' | 'manual') {
  mode = newMode;
  const isJoy = mode === 'joystick';

  $panelJoy.hidden  = !isJoy;
  $panelRaw.hidden  = isJoy;
  $kbHint.classList.toggle('hidden', !isJoy);
  $tabJoy.dataset.active = String(isJoy);
  $tabRaw.dataset.active = String(!isJoy);

  // Safety: zero out the mode we're leaving
  if (isJoy) {
    resetRaw();
    send({ cmd: 'move', t: 0, y: 0, p: 0, r: 0 });
  } else {
    throttle = yaw = pitch = roll = 0;
    keysHeld.clear();
    send({ cmd: 'raw', fl: 0, fr: 0, bl: 0, br: 0 });
  }
}

$tabJoy.addEventListener('click', () => setMode('joystick'));
$tabRaw.addEventListener('click', () => setMode('manual'));

// ── Button handlers ────────────────────────────────────────────────────────────

$armBtn.addEventListener('click', () => {
  if (!stbyOn) return;
  send({ cmd: armed ? 'disarm' : 'arm' });
});

$stbyBtn.addEventListener('click', () => {
  const next = !stbyOn;
  send({ cmd: 'stby', val: next });
  stbyOn = next;
  if (!next && armed) { send({ cmd: 'disarm' }); armed = false; }
  renderUI();
});

document.getElementById('connect-btn')!.addEventListener('click', () => ws?.close());

// ── Raw motor sliders ──────────────────────────────────────────────────────────

function resetRaw() {
  raw.fl = raw.fr = raw.bl = raw.br = 0;
  sliders.forEach(({ input, label }) => { input.value = '0'; label.textContent = '0'; });
  $slAll.value = '0'; $svAll.textContent = '0';
}

// Master slider: sets all 4 at once
$slAll.addEventListener('input', () => {
  const v = Number($slAll.value);
  $svAll.textContent = String(v);
  raw.fl = raw.fr = raw.bl = raw.br = v;
  sliders.forEach(({ input, label }) => { input.value = String(v); label.textContent = String(v); });
});

// Individual sliders
sliders.forEach(({ input, label, key }) => {
  input.addEventListener('input', () => {
    const v = Number(input.value);
    label.textContent = String(v);
    raw[key] = v;
  });
});

document.getElementById('all-off-btn')!.addEventListener('click', () => {
  resetRaw();
  if (armed) send({ cmd: 'raw', fl: 0, fr: 0, bl: 0, br: 0 });
});

// ── Joysticks ──────────────────────────────────────────────────────────────────

const leftJoy = nipplejs.create({
  zone:        document.getElementById('joy-left')!,
  mode:        'static',
  position:    { left: '50%', top: '50%' },
  color:       '#4fc3f7',
  size:        110,
  restOpacity: 0.4,
});

const rightJoy = nipplejs.create({
  zone:        document.getElementById('joy-right')!,
  mode:        'static',
  position:    { left: '50%', top: '50%' },
  color:       '#4fc3f7',
  size:        110,
  restOpacity: 0.4,
});

// Left: throttle (Y↑=255, center=127, Y↓=0) + yaw (X: ±127)
leftJoy.on('move', (_, d) => {
  throttle = Math.round(((d.vector.y + 1) / 2) * 255);
  yaw      = Math.round(d.vector.x * 127);
});
leftJoy.on('end', () => { throttle = 0; yaw = 0; });

// Right: pitch (Y: ±127) + roll (X: ±127)
rightJoy.on('move', (_, d) => {
  pitch = Math.round(d.vector.y * 127);
  roll  = Math.round(d.vector.x * 127);
});
rightJoy.on('end', () => { pitch = 0; roll = 0; });

// ── Keyboard ───────────────────────────────────────────────────────────────────

const TRACKED = new Set([
  'w', 'W', 's', 'S', 'a', 'A', 'd', 'D',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (stbyOn) send({ cmd: armed ? 'disarm' : 'arm' });
    return;
  }
  if (TRACKED.has(e.key) && mode === 'joystick') {
    e.preventDefault();
    keysHeld.add(e.key);
  }
});

document.addEventListener('keyup', (e) => { keysHeld.delete(e.key); });

// ── Init ───────────────────────────────────────────────────────────────────────

connect();
renderUI();

import * as THREE from 'three';

// ── Scene state ───────────────────────────────────────────────────────────────

let scene:      THREE.Scene;
let camera:     THREE.PerspectiveCamera;
let renderer:   THREE.WebGLRenderer;
let droneGroup: THREE.Group;
let propGroups: THREE.Object3D[] = [];
let animId = -1;
let motorSpeeds = [0, 0, 0, 0];

// ── Drone geometry ────────────────────────────────────────────────────────────

function buildDrone(): THREE.Group {
  const group = new THREE.Group();

  // ── Materials ───────────────────────────────────────────────────────────────
  const matCarbon = new THREE.MeshPhongMaterial({
    color: 0x0c0c1e, emissive: 0x040410, shininess: 130,
  });
  const matArm = new THREE.MeshPhongMaterial({
    color: 0x131325, emissive: 0x060612, shininess: 70,
  });
  const matMotorBase = new THREE.MeshPhongMaterial({
    color: 0x18182e, shininess: 50,
  });
  const matMotorBell = new THREE.MeshPhongMaterial({
    color: 0x202045, emissive: 0x080820, shininess: 110,
  });
  const matShaft = new THREE.MeshPhongMaterial({
    color: 0xb8b8d0, shininess: 220,
  });
  const matStandoff = new THREE.MeshPhongMaterial({
    color: 0x808090, shininess: 180,
  });
  const matFC = new THREE.MeshPhongMaterial({
    color: 0x163016, emissive: 0x050d05, shininess: 50,
  });
  const matBattery = new THREE.MeshPhongMaterial({
    color: 0x1a3a1a, emissive: 0x050f05, shininess: 20,
  });

  // ── Frame plates ─────────────────────────────────────────────────────────────
  // Bottom plate (main structural plate)
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.022, 0.40), matCarbon));

  // Top plate (raised, smaller)
  const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.018, 0.26), matCarbon);
  topPlate.position.y = 0.085;
  group.add(topPlate);

  // 4 aluminum standoffs connecting plates
  for (const [sx, sz] of [[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.085, 8), matStandoff);
    s.position.set(sx, 0.043, sz);
    group.add(s);
  }

  // FC/ESC stack (electronics)
  const fc = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.038, 0.15), matFC);
  fc.position.y = 0.058;
  group.add(fc);

  // Status LEDs on FC (green=armed, red=error)
  const ledGreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.009, 0.005, 0.009),
    new THREE.MeshPhongMaterial({ color: 0x00ff55, emissive: 0x00cc44, emissiveIntensity: 1 }),
  );
  ledGreen.position.set(0.055, 0.078, -0.035);
  group.add(ledGreen);

  const ledRed = new THREE.Mesh(
    new THREE.BoxGeometry(0.009, 0.005, 0.009),
    new THREE.MeshPhongMaterial({ color: 0xff3300, emissive: 0xcc2200, emissiveIntensity: 1 }),
  );
  ledRed.position.set(0.040, 0.078, -0.035);
  group.add(ledRed);

  // Battery (on bottom, Lipo pack shape)
  const battery = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.038, 0.080), matBattery);
  battery.position.y = -0.032;
  group.add(battery);

  // Battery connector bump
  const connector = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.018, 0.015),
    new THREE.MeshPhongMaterial({ color: 0x222222 }),
  );
  connector.position.set(0.148, -0.022, 0);
  group.add(connector);

  // ── Arms + motors + props (X-config) ─────────────────────────────────────────
  // front=-Z, right=+X
  // FL=135°, FR=45°, BL=-135°(225°), BR=-45°(315°)
  const armLen   = 0.84;
  const armAngles = [135, 45, -135, -45];
  const spinDirs  = [1, -1, -1, 1];   // FL/BR=CW, FR/BL=CCW
  propGroups = [];

  armAngles.forEach((deg, i) => {
    const rad  = deg * (Math.PI / 180);
    const tipX = Math.cos(rad) * armLen / 2;
    const tipZ = -Math.sin(rad) * armLen / 2;

    // Carbon fiber arm (flat, thin)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.020, 0.036), matArm);
    arm.rotation.y = rad;
    group.add(arm);

    // Motor mount plate
    const mount = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.018, 12),
      matMotorBase,
    );
    mount.position.set(tipX, -0.001, tipZ);
    group.add(mount);

    // Motor bell (stator visible below, rotor bell on top)
    const stator = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.028, 12),
      matMotorBase,
    );
    stator.position.set(tipX, 0.022, tipZ);
    group.add(stator);

    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.033, 0.044, 14),
      matMotorBell,
    );
    bell.position.set(tipX, 0.036, tipZ);
    group.add(bell);

    // Motor shaft
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.022, 6),
      matShaft,
    );
    shaft.position.set(tipX, 0.068, tipZ);
    group.add(shaft);

    // ── Propeller group (spins) ──────────────────────────────────────────────
    const propGroup = new THREE.Group();
    propGroup.position.set(tipX, 0.080, tipZ);
    propGroup.userData['spinDir'] = spinDirs[i];

    // Prop hub
    propGroup.add(new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12),
      new THREE.MeshPhongMaterial({ color: 0x282840 }),
    ));

    // 2 blades — CW props slightly darker blue, CCW slightly darker (visual cue)
    const bladeColor = spinDirs[i] > 0 ? 0x18182e : 0x281818;
    const bladeEmit  = spinDirs[i] > 0 ? 0x07071a : 0x1a0707;
    const bladeMat = new THREE.MeshPhongMaterial({
      color: bladeColor, emissive: bladeEmit, shininess: 60,
      transparent: true, opacity: 0.82,
    });

    for (let b = 0; b < 2; b++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.40, 0.007, 0.048),
        bladeMat,
      );
      blade.rotation.y  = b * Math.PI;
      blade.rotation.z  = spinDirs[i] * 0.10;  // prop pitch
      propGroup.add(blade);
    }

    group.add(propGroup);
    propGroups.push(propGroup);
  });

  // ── FPV camera (front center, -Z) ────────────────────────────────────────────
  const camBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.044, 0.038, 0.028),
    new THREE.MeshPhongMaterial({ color: 0x0e0e1e, shininess: 50 }),
  );
  camBody.position.set(0, 0.074, -0.148);
  group.add(camBody);

  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 0.010, 12),
    new THREE.MeshPhongMaterial({ color: 0x060618, emissive: 0x040410, shininess: 250 }),
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.074, -0.164);
  group.add(lens);

  // ── Navigation lights ─────────────────────────────────────────────────────────
  // Left = red (port), Right = green (starboard) — standard aviation convention
  const navLeft = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 8, 6),
    new THREE.MeshPhongMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1.0 }),
  );
  navLeft.position.set(-0.19, 0.013, 0);
  group.add(navLeft);

  const navRight = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 8, 6),
    new THREE.MeshPhongMaterial({ color: 0x22ff22, emissive: 0x00ff00, emissiveIntensity: 1.0 }),
  );
  navRight.position.set(0.19, 0.013, 0);
  group.add(navRight);

  // Tail strobe (back, white)
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.007, 8, 6),
    new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xaaaacc, emissiveIntensity: 0.8 }),
  );
  strobe.position.set(0, 0.013, 0.20);
  group.add(strobe);

  return group;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function init3D(canvas: HTMLCanvasElement) {
  const w = canvas.clientWidth  || 400;
  const h = canvas.clientHeight || 300;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a12);
  scene.fog = new THREE.FogExp2(0x0a0a12, 0.12);

  camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 50);
  camera.position.set(1.8, 1.4, 2.2);
  camera.lookAt(0, 0.05, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);

  // ── Lighting ────────────────────────────────────────────────────────────────
  // Soft ambient
  scene.add(new THREE.AmbientLight(0xffffff, 0.30));

  // Main key light (top-right-front, warm-white)
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(2.5, 5, 3);
  scene.add(key);

  // Fill light (blue-ish, left side)
  const fill = new THREE.DirectionalLight(0x8899ff, 0.45);
  fill.position.set(-3, 1, -1);
  scene.add(fill);

  // Rim light (from below-back for drama)
  const rim = new THREE.DirectionalLight(0x4fc3f7, 0.35);
  rim.position.set(0, -3, -4);
  scene.add(rim);

  // ── Grid floor ───────────────────────────────────────────────────────────────
  const grid = new THREE.GridHelper(6, 24, 0x1e1e36, 0x13131e);
  grid.position.y = -0.65;
  scene.add(grid);

  // Thin horizon line (accent color)
  const horizGeo = new THREE.PlaneGeometry(6, 6);
  const horizMat = new THREE.MeshBasicMaterial({
    color: 0x0c0c18, transparent: true, opacity: 0.7,
  });
  const horizon = new THREE.Mesh(horizGeo, horizMat);
  horizon.rotation.x = -Math.PI / 2;
  horizon.position.y = -0.651;
  scene.add(horizon);

  // Small axis helper at corner
  const axes = new THREE.AxesHelper(0.40);
  axes.position.set(-1.9, -0.64, -1.9);
  scene.add(axes);

  // ── Drone ────────────────────────────────────────────────────────────────────
  droneGroup = buildDrone();
  scene.add(droneGroup);

  // Restart animation loop
  if (animId !== -1) cancelAnimationFrame(animId);

  let last = performance.now();
  function animate(now: number) {
    animId = requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    // Spin each propeller group proportional to its motor speed
    propGroups.forEach((pg, i) => {
      const rpm = (motorSpeeds[i] / 255) * 60;  // rad/s at full throttle
      pg.rotation.y += rpm * dt * (pg.userData['spinDir'] as number);
    });

    renderer.render(scene, camera);
  }
  animate(performance.now());
}

// signRoll / signPitch vienen de cfg.signRoll / cfg.signPitch en el firmware.
// Cuando el IMU está montado invertido en un eje, el sign es -1 y el modelo
// debe reflejar el ángulo físico real, no el raw del sensor.
export function updateAngles(roll: number, pitch: number, signRoll = 1, signPitch = 1) {
  if (!droneGroup) return;
  droneGroup.rotation.z = -(roll  * signRoll)  * (Math.PI / 180);
  droneGroup.rotation.x =  (pitch * signPitch) * (Math.PI / 180);
}

export function updateMotors(vals: number[]) {
  motorSpeeds = vals.slice(0, 4);
}

export function resize3D(canvas: HTMLCanvasElement) {
  if (!renderer || !camera) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

export function dispose3D() {
  if (animId !== -1) { cancelAnimationFrame(animId); animId = -1; }
}

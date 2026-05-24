import * as THREE from 'three';
// ── Scene state ───────────────────────────────────────────────────────────────
let scene;
let camera;
let renderer;
let droneGroup;
let propMeshes = [];
let animId = -1;
let motorSpeeds = [0, 0, 0, 0];
// ── Drone geometry ────────────────────────────────────────────────────────────
function buildDrone() {
    const group = new THREE.Group();
    // Main body
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), new THREE.MeshPhongMaterial({ color: 0x1e1e3a, emissive: 0x080820, shininess: 90 })));
    // Electronics stack
    const stack = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.06, 0.20), new THREE.MeshPhongMaterial({ color: 0x252550, emissive: 0x050518 }));
    stack.position.y = 0.07;
    group.add(stack);
    const armMat = new THREE.MeshPhongMaterial({ color: 0x141428 });
    const motorMat = new THREE.MeshPhongMaterial({ color: 0x2a2a50 });
    const propMat = new THREE.MeshPhongMaterial({
        color: 0x4fc3f7,
        emissive: 0x1a5a6a,
        transparent: true,
        opacity: 0.55,
    });
    // X-config: FL=135°, FR=45°, BL=-135°, BR=-45° (rotation around Y)
    // front = -Z, right = +X
    const armAngles = [135, 45, -135, -45];
    const spinDirs = [1, -1, -1, 1]; // CW / CCW alternating
    const armLen = 0.80;
    propMeshes = [];
    armAngles.forEach((deg, i) => {
        const rad = deg * (Math.PI / 180);
        const tipX = Math.cos(rad) * armLen / 2;
        const tipZ = -Math.sin(rad) * armLen / 2;
        // Arm
        const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.03, 0.05), armMat);
        arm.rotation.y = rad;
        group.add(arm);
        // Motor cylinder
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 10), motorMat);
        motor.position.set(tipX, 0, tipZ);
        group.add(motor);
        // Propeller disc
        const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.010, 24), propMat.clone());
        prop.position.set(tipX, 0.065, tipZ);
        prop.userData['spinDir'] = spinDirs[i];
        group.add(prop);
        propMeshes.push(prop);
    });
    // Front indicator (red) — front = -Z
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.10), new THREE.MeshPhongMaterial({ color: 0xef5350, emissive: 0x3a0000 }));
    nose.position.set(0, 0.045, -0.23);
    group.add(nose);
    // Back indicator (blue)
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.05), new THREE.MeshPhongMaterial({ color: 0x4fc3f7, emissive: 0x1a5a7a }));
    tail.position.set(0, 0.045, 0.21);
    group.add(tail);
    return group;
}
// ── Public API ────────────────────────────────────────────────────────────────
export function init3D(canvas) {
    const w = canvas.clientWidth || 400;
    const h = canvas.clientHeight || 300;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0c14);
    scene.fog = new THREE.Fog(0x0c0c14, 10, 22);
    camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 50);
    camera.position.set(1.9, 1.5, 2.3);
    camera.lookAt(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.50));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x4fc3f7, 0.30);
    fill.position.set(-3, 2, -2);
    scene.add(fill);
    // Grid floor
    const grid = new THREE.GridHelper(6, 20, 0x252545, 0x16162a);
    grid.position.y = -0.70;
    scene.add(grid);
    // Small axis helper (bottom-left corner)
    const axes = new THREE.AxesHelper(0.45);
    axes.position.set(-2.0, -0.68, -2.0);
    scene.add(axes);
    droneGroup = buildDrone();
    scene.add(droneGroup);
    if (animId !== -1)
        cancelAnimationFrame(animId);
    let last = performance.now();
    function animate(now) {
        animId = requestAnimationFrame(animate);
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        // Spin propellers proportional to motor speed
        propMeshes.forEach((p, i) => {
            const speed = (motorSpeeds[i] / 255) * 55; // rad/s at full throttle
            p.rotation.y += speed * dt * p.userData['spinDir'];
        });
        renderer.render(scene, camera);
    }
    animate(performance.now());
}
export function updateAngles(roll, pitch) {
    if (!droneGroup)
        return;
    droneGroup.rotation.z = -roll * (Math.PI / 180);
    droneGroup.rotation.x = pitch * (Math.PI / 180);
}
export function updateMotors(vals) {
    motorSpeeds = vals.slice(0, 4);
}
export function resize3D(canvas) {
    if (!renderer || !camera)
        return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0)
        return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
}
export function dispose3D() {
    if (animId !== -1) {
        cancelAnimationFrame(animId);
        animId = -1;
    }
}

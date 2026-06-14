// ── Three.js water current background ──
import * as THREE from "three";

const canvas = document.getElementById("particles");
if (!canvas) throw new Error("Particle canvas missing");

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 100);
camera.position.set(0, 40, 0);
camera.lookAt(0, 0, 0);

const turquoise = 0x2dbca0;
const lightTeal = 0x5eddc8;
const deepTeal = 0x1a6e6a;
const white = 0xf0ede6;
const pink = 0xe85d88;

// ── Create a flowing current line ──
function createCurrentLine(numPoints, length, zCenter, y, color, opacity, speed, ampX) {
  const positions = new Float32Array(numPoints * 3);
  const baseData = [];
  const phase = Math.random() * Math.PI * 2;
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const z = zCenter + (t - 0.5) * length;
    const x = Math.sin(t * 12 + phase) * ampX;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    baseData.push({ y, baseZ: z });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color, transparent: true, opacity,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(geo, mat);
  line.userData = { baseData, numPoints, speed, ampX, phase };
  return line;
}

// ── Layers: each line spread across Z ──
const currents = [];
const LINE_LEN = 26;

function addLayer(count, startZ, stepZ, y, color, opacity, speedRange, ampRange) {
  for (let i = 0; i < count; i++) {
    const z = startZ + i * stepZ;
    const speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
    const amp = ampRange[0] + Math.random() * (ampRange[1] - ampRange[0]);
    const line = createCurrentLine(100, LINE_LEN, z, y, color, opacity, speed, amp);
    scene.add(line);
    currents.push(line);
  }
}

addLayer(10, -27, 6,    -4, deepTeal,  0.18, [0.2, 0.5], [2, 4.5]);
addLayer(16, -28.5, 3.8, -1, turquoise, 0.25, [0.4, 0.8], [1.5, 3]);
addLayer(12, -27.5, 5,    2, lightTeal, 0.3,  [0.6, 1.0], [0.8, 2]);
addLayer(5,  -25, 12.5,   3, white,     0.1,  [0.8, 1.2], [0.4, 1]);
addLayer(3,  -20, 20,     1, pink,      0.1,  [0.5, 0.8], [1, 2]);

const SPARKLE = 350;
const spPositions = new Float32Array(SPARKLE * 3);
const spData = [];
for (let i = 0; i < SPARKLE; i++) {
  spPositions[i * 3] = (Math.random() - 0.5) * 55;
  spPositions[i * 3 + 1] = Math.random() * 6;
  spPositions[i * 3 + 2] = (Math.random() - 0.5) * 55;
  spData.push({
    dx: (Math.random() - 0.5) * 0.025,
    dz: (Math.random() - 0.5) * 0.025,
    baseY: spPositions[i * 3 + 1],
  });
}
const spGeo = new THREE.BufferGeometry();
spGeo.setAttribute("position", new THREE.BufferAttribute(spPositions, 3));
const spMat = new THREE.PointsMaterial({ size: 0.1, color: white, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75 });
const sparkles = new THREE.Points(spGeo, spMat);
scene.add(sparkles);

// ── Fog ──
scene.fog = new THREE.FogExp2(0x0d1116, 0.00015);

// ── Input ──
const mouse = { x: 0, y: 0 };
const target = { x: 0, y: 0 };
document.addEventListener("mousemove", e => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = -(e.clientY / innerHeight) * 2 + 1; });
document.addEventListener("touchmove", e => { const t = e.touches[0]; mouse.x = (t.clientX / innerWidth) * 2 - 1; mouse.y = -(t.clientY / innerHeight) * 2 + 1; }, { passive: true });
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  target.x += (mouse.x - target.x) * 2 * dt;
  target.y += (mouse.y - target.y) * 2 * dt;

  // Current lines
  for (const line of currents) {
    const pos = line.geometry.attributes.position.array;
    const { baseData, numPoints, speed, ampX, phase } = line.userData;
    for (let i = 0; i < numPoints; i++) {
      const bd = baseData[i];
      const n = i / numPoints;
      pos[i * 3] = Math.sin(t * speed + n * 12 + phase) * ampX;
      pos[i * 3 + 1] = bd.y;
      pos[i * 3 + 2] = bd.baseZ;
    }
    line.geometry.attributes.position.needsUpdate = true;
  }

  // Sparkles — gentle continuous drift, wrap at edges
  for (let i = 0; i < SPARKLE; i++) {
    const d = spData[i];
    spPositions[i * 3] += d.dx;
    spPositions[i * 3 + 2] += d.dz;
    if (spPositions[i * 3] > 28) spPositions[i * 3] = -28;
    if (spPositions[i * 3] < -28) spPositions[i * 3] = 28;
    if (spPositions[i * 3 + 2] > 28) spPositions[i * 3 + 2] = -28;
    if (spPositions[i * 3 + 2] < -28) spPositions[i * 3 + 2] = 28;
  }
  sparkles.geometry.attributes.position.needsUpdate = true;
  // Camera: subtle horizontal pan, fixed center
  camera.position.x += (target.x * 1.5 - camera.position.x) * 0.1 * dt;
  camera.position.z = 0;
  camera.position.y = 40;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

// Canvas hidden by CSS; reveal after first frame renders
renderer.render(scene, camera);
requestAnimationFrame(() => { canvas.style.opacity = "1"; });
animate();

// ── UI ──
document.querySelectorAll(".install-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const tgt = tab.dataset.tab;
    document.querySelectorAll(".install-tab").forEach(t => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    document.querySelectorAll(".install-panel").forEach(p => { p.hidden = p.dataset.panel !== tgt; });
  });
});

const copyBtn = document.querySelector(".copy-btn");
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    const panel = document.querySelector(".install-panel:not([hidden])");
    const text = panel ? panel.textContent.trim() : "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.classList.add("copied");
      const l = copyBtn.querySelector("span");
      if (l) l.textContent = "Copied";
      setTimeout(() => { copyBtn.classList.remove("copied"); if (l) l.textContent = "Copy"; }, 2000);
    } catch {}
  });
}

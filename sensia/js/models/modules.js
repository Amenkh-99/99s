// Modules électroniques du système (formes simplifiées, échelle indicative).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAT, canvasTexture, cable } from '../util.js';

function labelTexture(text, { bg = '#0f1115', fg = '#d7dde6', w = 256, h = 64, font = 'bold 30px monospace' } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2);
  });
}

/** Rangée de broches (instanciée, légère). */
function pinRow(n, pitch, mat) {
  const geo = new THREE.BoxGeometry(0.0007, 0.0007, 0.006);
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    m.makeTranslation((i - (n - 1) / 2) * pitch, 0, 0);
    inst.setMatrixAt(i, m);
  }
  return inst;
}

/** Carte ESP32 DevKit. */
export function createESP32() {
  const g = new THREE.Group();
  g.name = 'ESP32';
  const pcb = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.0016, 0.028, 2, 0.0007), MAT.pcbBlack);
  const shieldMat = new THREE.MeshStandardMaterial({ map: labelTexture('ESP32', { bg: '#c9ced6', fg: '#3b4250', font: 'bold 34px sans-serif' }), metalness: 0.9, roughness: 0.3 });
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0028, 0.016), [MAT.steel, MAT.steel, shieldMat, MAT.steel, MAT.steel, MAT.steel]);
  shield.position.set(0.008, 0.0022, 0);
  const antenna = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.0004, 0.016), new THREE.MeshStandardMaterial({ color: '#c9a74a', metalness: 0.8, roughness: 0.4 }));
  antenna.position.set(0.0215, 0.001, 0);
  const usb = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.003, 0.008), MAT.steel);
  usb.position.set(-0.024, 0.0023, 0);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.0012, 0.005), MAT.chip);
  chip.position.set(-0.012, 0.0014, 0.004);
  const ledBlue = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 0.0008, 0.001), new THREE.MeshStandardMaterial({ color: '#4aa8ff', emissive: '#4aa8ff', emissiveIntensity: 2 }));
  ledBlue.position.set(-0.018, 0.0012, -0.008);
  g.add(pcb, shield, antenna, usb, chip, ledBlue);
  for (const z of [-0.0125, 0.0125]) {
    const hdr = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.0025, 0.0025), MAT.plasticBlack);
    hdr.position.set(-0.001, -0.002, z);
    const pins = pinRow(19, 0.00254, MAT.gold);
    pins.rotation.x = Math.PI / 2;
    pins.position.set(-0.001, -0.005, z);
    g.add(hdr, pins);
  }
  return g;
}

/** Module DFPlayer Mini avec fente pour carte mémoire. */
export function createDFPlayer() {
  const g = new THREE.Group();
  g.name = 'DFPlayer Mini';
  const pcb = new THREE.Mesh(new RoundedBoxGeometry(0.021, 0.0016, 0.021, 2, 0.0007), new THREE.MeshStandardMaterial({ color: '#1b1f27', roughness: 0.5 }));
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.0125, 0.0018, 0.0125), MAT.steel);
  slot.position.set(0, 0.0017, -0.002);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.0055, 0.0011, 0.0055), MAT.chip);
  chip.position.set(0, -0.0013, 0.002);
  g.add(pcb, slot, chip);
  for (const x of [-0.0095, 0.0095]) {
    const pins = pinRow(8, 0.00254, MAT.gold);
    pins.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    pins.position.set(x, -0.004, 0);
    g.add(pins);
  }
  return g;
}

/** Carte mémoire micro-SD (fichiers audio). */
export function createSDCard() {
  const g = new THREE.Group();
  g.name = 'Carte mémoire';
  const tex = labelTexture('microSD', { bg: '#1e4fd1', fg: '#ffffff', w: 128, h: 128, font: 'bold 26px sans-serif' });
  const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.0008, 0.015), [MAT.plasticBlack, MAT.plasticBlack, top, MAT.plasticBlack, MAT.plasticBlack, MAT.plasticBlack]);
  g.add(body);
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.0002, 0.0025), MAT.gold);
    c.position.set(-0.0042 + i * 0.0012, -0.0005, -0.0055);
    g.add(c);
  }
  return g;
}

/** Batterie rechargeable (cellule cylindrique dans un support). */
export function createBattery() {
  const g = new THREE.Group();
  g.name = 'Batterie';
  const holder = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.012, 0.022, 3, 0.003), MAT.plasticBlack);
  const wrap = new THREE.MeshPhysicalMaterial({ color: '#e07a22', roughness: 0.35, clearcoat: 0.8 });
  const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.065, 32), wrap);
  cell.rotation.z = Math.PI / 2;
  cell.position.y = 0.007;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0092, 0.0092, 0.012, 32), new THREE.MeshStandardMaterial({ color: '#16181d', roughness: 0.5 }));
  band.rotation.z = Math.PI / 2;
  band.position.set(0.012, 0.007, 0);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.002, 20), MAT.steel);
  cap.rotation.z = Math.PI / 2;
  cap.position.set(0.0335, 0.007, 0);
  g.add(holder, cell, band, cap);
  const red = new THREE.MeshStandardMaterial({ color: '#d42a2a', roughness: 0.6 });
  const blk = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.6 });
  g.add(cable([[-0.037, 0.002, 0.004], [-0.05, 0.0, 0.006], [-0.06, -0.004, 0.01]], 0.0009, red, 12));
  g.add(cable([[-0.037, 0.002, -0.004], [-0.05, 0.0, -0.006], [-0.06, -0.004, -0.01]], 0.0009, blk, 12));
  return g;
}

/** Paire d'écouteurs (vue technique). */
export function createEarphones() {
  const g = new THREE.Group();
  g.name = 'Écouteurs';
  const mat = new THREE.MeshPhysicalMaterial({ color: '#1d222b', roughness: 0.3, clearcoat: 1 });
  const ringMat = new THREE.MeshBasicMaterial({ color: '#2ee6f0', toneMapped: false });
  const cm = new THREE.MeshStandardMaterial({ color: '#20242c', roughness: 0.6 });
  for (const sx of [-1, 1]) {
    const bud = new THREE.Group();
    bud.position.set(sx * 0.018, 0.012, 0);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 24, 16), mat);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 16, 12), new THREE.MeshStandardMaterial({ color: '#4b5361', roughness: 0.8 }));
    tip.position.x = sx * 0.007;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.001, 8, 24), ringMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = -sx * 0.006;
    const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.0026, 0.012, 4, 8), mat);
    stem.position.y = -0.011;
    bud.add(shell, tip, ring, stem);
    g.add(bud);
    g.add(cable([[sx * 0.018, -0.002, 0], [sx * 0.014, -0.018, 0.002], [sx * 0.004, -0.03, 0], [0, -0.036, 0]], 0.0008, cm, 16));
  }
  g.add(cable([[0, -0.036, 0], [0, -0.05, 0.004], [0.004, -0.065, 0]], 0.001, cm, 12));
  return g;
}

/** Boîtier porté à la ceinture : ESP32 + DFPlayer + batterie (position illustrative). */
export function createBeltBox() {
  const g = new THREE.Group();
  g.name = 'Boîtier';
  const shell = new THREE.Mesh(
    new RoundedBoxGeometry(0.06, 0.1, 0.035, 4, 0.012),
    new THREE.MeshPhysicalMaterial({ color: '#202734', roughness: 0.45, clearcoat: 0.6 })
  );
  shell.castShadow = true;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.07, 0.001), new THREE.MeshBasicMaterial({ color: '#2ee6f0', toneMapped: false }));
  strip.position.set(-0.018, 0, 0.018);
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.04, 0.01),
    new THREE.MeshBasicMaterial({ map: labelTexture('SENSIA', { bg: '#202734', fg: '#9fb3c8', font: 'bold 34px sans-serif' }) })
  );
  logo.position.set(0.006, 0.03, 0.0178);
  g.add(shell, strip, logo);
  return g;
}

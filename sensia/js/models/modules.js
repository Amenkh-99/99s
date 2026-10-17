// Modules électroniques du système (formes simplifiées, échelle indicative).
// Circuits imprimés procéduraux, blindage métallique gravé, connecteurs dorés.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAT, canvasTexture, cable, pcbTextures, pcbMaterials, wireMaterial, brushedTex } from '../util.js';

/** Texte gravé / imprimé sur une petite surface. */
function labelTexture(lines, { bg = '#0f1115', fg = '#d7dde6', w = 256, h = 64, font = 'bold 30px monospace', brushed = false } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    if (brushed) {
      for (let i = 0; i < 500; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
        g.fillRect(0, Math.random() * h, w, 1);
      }
    }
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const arr = Array.isArray(lines) ? lines : [lines];
    arr.forEach((l, i) => {
      g.font = i === 0 ? font : font.replace(/\d+px/, (m) => Math.round(parseInt(m, 10) * 0.6) + 'px');
      g.fillText(l, w / 2, h / 2 + (i - (arr.length - 1) / 2) * h * 0.32);
    });
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

/** Carte ESP32 DevKit : module blindé gravé, antenne imprimée, boutons, USB. */
export function createESP32() {
  const g = new THREE.Group();
  g.name = 'ESP32';
  const pads = [];
  for (let i = 0; i < 19; i++) {
    pads.push([0.05 + i * 0.05, 0.06, 5], [0.05 + i * 0.05, 0.94, 5]);
  }
  const tex = pcbTextures({
    w: 520, h: 280, seed: 41, mask: '#17191f', maskDark: '#0c0d11', copper: 'rgba(140,150,170,0.22)', pads,
    text: [['ESP32 DevKit', 0.27, 0.5, 20], ['EN', 0.1, 0.78, 13], ['BOOT', 0.1, 0.22, 13], ['3V3  GND  5V', 0.55, 0.82, 11]],
  });
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.0016, 0.028), pcbMaterials(tex, '#0d0e12', 2));
  const shieldTop = new THREE.MeshPhysicalMaterial({
    map: labelTexture(['ESP32-WROOM', 'Wi-Fi · Bluetooth'], { bg: '#bfc5cd', fg: '#4a515e', font: 'bold 34px sans-serif', brushed: true, w: 256, h: 220 }),
    metalness: 0.95, roughness: 0.28, roughnessMap: brushedTex, anisotropy: 0.6,
  });
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0028, 0.016), [MAT.steel, MAT.steel, shieldTop, MAT.steel, MAT.steel, MAT.steel]);
  shield.position.set(0.008, 0.0022, 0);
  const module = new THREE.Mesh(new THREE.BoxGeometry(0.0255, 0.0008, 0.018), new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.5 }));
  module.position.set(0.0115, 0.0012, 0);
  // antenne imprimée en zigzag
  const antenna = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.0005, 0.0002, 0.014), MAT.gold);
    seg.position.set(0.0195 + i * 0.0009, 0.0018, 0);
    antenna.add(seg);
  }
  const usb = new THREE.Mesh(new RoundedBoxGeometry(0.006, 0.003, 0.008, 2, 0.0007), MAT.steel);
  usb.position.set(-0.024, 0.0023, 0);
  const chip = new THREE.Mesh(new RoundedBoxGeometry(0.005, 0.0012, 0.005, 2, 0.0002), MAT.chip);
  chip.position.set(-0.012, 0.0014, 0.004);
  const ledBlue = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 0.0008, 0.001), new THREE.MeshStandardMaterial({ color: '#4aa8ff', emissive: '#4aa8ff', emissiveIntensity: 3 }));
  ledBlue.position.set(-0.018, 0.0012, -0.008);
  g.add(pcb, module, shield, antenna, usb, chip, ledBlue);
  for (const z of [-0.0065, 0.0065]) {
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.0012, 0.003), MAT.steel);
    btn.position.set(-0.0195, 0.0014, z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.0006, 12), MAT.plasticBlack);
    cap.position.set(-0.0195, 0.0022, z);
    g.add(btn, cap);
  }
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
  const pads = [];
  for (let i = 0; i < 8; i++) pads.push([0.06, 0.1 + i * 0.115, 6], [0.94, 0.1 + i * 0.115, 6]);
  const tex = pcbTextures({ w: 256, h: 256, seed: 57, mask: '#1b2a58', maskDark: '#121c3d', copper: 'rgba(140,170,255,0.3)', pads, text: [['DFPlayer Mini', 0.5, 0.9, 19]] });
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.0016, 0.021), pcbMaterials(tex, '#121c3d', 2));
  const slot = new THREE.Mesh(new RoundedBoxGeometry(0.0125, 0.0018, 0.0125, 2, 0.0003), MAT.steel);
  slot.position.set(0, 0.0017, -0.002);
  const chip = new THREE.Mesh(new RoundedBoxGeometry(0.0055, 0.0011, 0.0055, 2, 0.0002), MAT.chip);
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
  const tex = canvasTexture(128, 176, (c, w, h) => {
    const grd = c.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#2a6cf0');
    grd.addColorStop(1, '#173f9e');
    c.fillStyle = grd;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(0, h * 0.55, w, h * 0.12);
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.font = 'bold 22px sans-serif';
    c.fillText('micro', w / 2, h * 0.32);
    c.font = 'bold 34px sans-serif';
    c.fillText('SD', w / 2, h * 0.47);
    c.font = '600 14px sans-serif';
    c.fillText('AUDIO', w / 2, h * 0.8);
  });
  const top = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.35, clearcoat: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.0008, 0.015), [MAT.plasticBlack, MAT.plasticBlack, top, MAT.plasticBlack, MAT.plasticBlack, MAT.plasticBlack]);
  g.add(body);
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.0002, 0.0025), MAT.gold);
    c.position.set(-0.0042 + i * 0.0012, -0.0005, -0.0055);
    g.add(c);
  }
  return g;
}

/** Batterie rechargeable : cellule Li-ion gainée dans un support. */
export function createBattery() {
  const g = new THREE.Group();
  g.name = 'Batterie';
  const holder = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.012, 0.022, 4, 0.003), MAT.plasticBlack);
  const wrapTex = canvasTexture(512, 128, (c, w, h) => {
    const grd = c.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#f28a2b');
    grd.addColorStop(0.5, '#e06d16');
    grd.addColorStop(1, '#b8540c');
    c.fillStyle = grd;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#16181d';
    c.fillRect(w * 0.62, 0, w * 0.16, h);
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.font = 'bold 34px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('Li-ion', w * 0.3, h * 0.42);
    c.font = '600 18px sans-serif';
    c.fillText('RECHARGEABLE', w * 0.3, h * 0.72);
  });
  const wrap = new THREE.MeshPhysicalMaterial({ map: wrapTex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.065, 64, 1, true), wrap);
  cell.rotation.z = Math.PI / 2;
  cell.position.y = 0.007;
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0088, 0.0088, 0.0012, 48), MAT.steel);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(sx * 0.033, 0.007, 0);
    g.add(cap);
  }
  const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.0018, 24), MAT.steel);
  nub.rotation.z = Math.PI / 2;
  nub.position.set(0.0345, 0.007, 0);
  for (const sx of [-1, 1]) {
    const spring = new THREE.Mesh(new THREE.TorusGeometry(0.004, 0.0006, 8, 24), MAT.steel);
    spring.rotation.y = Math.PI / 2;
    spring.position.set(sx * 0.0365, 0.007, 0);
    g.add(spring);
  }
  g.add(holder, cell, nub);
  g.add(cable([[-0.037, 0.002, 0.004], [-0.05, 0.0, 0.006], [-0.06, -0.004, 0.01]], 0.0009, wireMaterial('#d42a2a'), 16));
  g.add(cable([[-0.037, 0.002, -0.004], [-0.05, 0.0, -0.006], [-0.06, -0.004, -0.01]], 0.0009, wireMaterial('#15171b'), 16));
  return g;
}

/** Paire d'écouteurs intra-auriculaires (vue technique). */
export function createEarphones() {
  const g = new THREE.Group();
  g.name = 'Écouteurs';
  const mat = new THREE.MeshPhysicalMaterial({ color: '#1b2029', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0.2 });
  const tipMat = new THREE.MeshPhysicalMaterial({ color: '#5a6372', roughness: 0.75, sheen: 1, sheenColor: '#9fb3c8' });
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#2ee6f0').multiplyScalar(1.4), toneMapped: false });
  const cm = wireMaterial('#20242c');
  for (const sx of [-1, 1]) {
    const bud = new THREE.Group();
    bud.position.set(sx * 0.018, 0.012, 0);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 40, 24), mat);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 24, 16), tipMat);
    tip.position.x = sx * 0.007;
    tip.scale.set(0.8, 1, 1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0008, 10, 40), ringMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = -sx * 0.0062;
    const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.0026, 0.012, 6, 12), mat);
    stem.position.y = -0.011;
    bud.add(shell, tip, ring, stem);
    g.add(bud);
    g.add(cable([[sx * 0.018, -0.002, 0], [sx * 0.014, -0.018, 0.002], [sx * 0.004, -0.03, 0], [0, -0.036, 0]], 0.0008, cm, 24));
  }
  g.add(cable([[0, -0.036, 0], [0, -0.05, 0.004], [0.004, -0.065, 0]], 0.001, cm, 16));
  return g;
}

/** Boîtier porté à la ceinture : ESP32 + DFPlayer + batterie (position illustrative). */
export function createBeltBox() {
  const g = new THREE.Group();
  g.name = 'Boîtier';
  const shell = new THREE.Mesh(
    new RoundedBoxGeometry(0.06, 0.1, 0.035, 5, 0.013),
    new THREE.MeshPhysicalMaterial({ color: '#2a313d', metalness: 0.7, roughness: 0.34, roughnessMap: brushedTex, clearcoat: 0.5, clearcoatRoughness: 0.2 })
  );
  shell.castShadow = true;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.07, 0.001), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2ee6f0').multiplyScalar(1.5), toneMapped: false }));
  strip.position.set(-0.018, 0, 0.018);
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.04, 0.01),
    new THREE.MeshBasicMaterial({ map: labelTexture('SENSIA', { bg: '#2a313d', fg: '#a9bdd2', font: 'bold 34px sans-serif' }) })
  );
  logo.position.set(0.006, 0.03, 0.0178);
  g.add(shell, strip, logo);
  return g;
}

// ─── Composants supplémentaires (diapositive « Étude du matériel ») ─────────

/** Résistance traversante : corps beige, anneaux de couleur, pattes en acier. */
export function createResistor(bands = ['#d42a2a', '#d42a2a', '#7a4a1e', '#d8b25a']) {
  const g = new THREE.Group();
  g.name = 'Résistance';
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.0012, 0.0045, 8, 24), new THREE.MeshPhysicalMaterial({ color: '#e3c9a0', roughness: 0.4, clearcoat: 0.6 }));
  body.rotation.z = Math.PI / 2;
  g.add(body);
  bands.forEach((c, i) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.00125, 0.00125, 0.0005, 24), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.6 }));
    b.rotation.z = Math.PI / 2;
    b.position.x = -0.0018 + i * 0.0011 + (i === 3 ? 0.0006 : 0);
    g.add(b);
  });
  for (const sx of [-1, 1]) {
    const leg = cable([[sx * 0.0032, 0, 0], [sx * 0.006, 0, 0], [sx * 0.0068, -0.0012, 0], [sx * 0.0068, -0.009, 0]], 0.00022, MAT.steel, 16);
    g.add(leg);
  }
  return g;
}

/** Faisceau de fils de prototypage (jumpers) avec connecteurs Dupont. */
export function createJumperWires() {
  const g = new THREE.Group();
  g.name = 'Fils électriques';
  const cols = ['#e8871e', '#1aa58a', '#d42a2a', '#3d7bff', '#e3c21b', '#15171b'];
  cols.forEach((c, i) => {
    const a = (i / cols.length) * Math.PI * 2;
    const r = 0.012 + (i % 2) * 0.004;
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      pts.push([Math.cos(a + t * 2.6) * r * (0.6 + t * 0.5), Math.sin(t * Math.PI) * 0.006 + i * 0.0007, Math.sin(a + t * 2.6) * r * (0.6 + t * 0.5)]);
    }
    g.add(cable(pts, 0.00045, wireMaterial(c), 64));
    for (const end of [pts[0], pts[pts.length - 1]]) {
      const plug = new THREE.Mesh(new RoundedBoxGeometry(0.0026, 0.0026, 0.007, 2, 0.0004), MAT.plasticBlack);
      plug.position.set(...end);
      plug.lookAt(0, end[1], 0);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.00025, 0.00025, 0.004, 8), MAT.gold);
      pin.rotation.x = Math.PI / 2;
      pin.position.z = 0.005;
      plug.add(pin);
      g.add(plug);
    }
  });
  return g;
}

/** Module LDR (carte bleue, photorésistance, potentiomètre de réglage, comparateur). */
export function createLDRModule() {
  const g = new THREE.Group();
  g.name = 'Module LDR';
  const tex = pcbTextures({
    w: 512, h: 220, seed: 71, mask: '#1f55c9', maskDark: '#163f9c', copper: 'rgba(120,170,255,0.35)',
    pads: [[0.9, 0.3, 7], [0.9, 0.5, 7], [0.9, 0.7, 7]],
    text: [['VCC GND DO AO', 0.62, 0.86, 15], ['LM393', 0.55, 0.25, 15]],
  });
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.0016, 0.014), pcbMaterials(tex, '#123a8e', 2));
  g.add(pcb);
  // potentiomètre bleu avec vis
  const pot = new THREE.Mesh(new RoundedBoxGeometry(0.0065, 0.004, 0.0065, 2, 0.0008), new THREE.MeshPhysicalMaterial({ color: '#2f6fe0', roughness: 0.35, clearcoat: 0.6 }));
  pot.position.set(-0.002, 0.0028, 0);
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.0008, 24), MAT.steel);
  screw.position.set(-0.002, 0.0049, 0);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.0026, 0.0003, 0.0004), MAT.chip);
  slot.position.set(-0.002, 0.0054, 0);
  const ic = new THREE.Mesh(new RoundedBoxGeometry(0.005, 0.0012, 0.004, 2, 0.0002), MAT.chip);
  ic.position.set(0.006, 0.0014, -0.003);
  // photorésistance montée sur ses pattes, à l'avant
  const ldr = new THREE.Group();
  const side = new THREE.MeshPhysicalMaterial({ color: '#c97a2a', roughness: 0.35, clearcoat: 1 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.0016, 40), side);
  disc.rotation.z = Math.PI / 2;
  ldr.add(disc);
  ldr.position.set(-0.019, 0.003, 0);
  for (const dz of [-0.0012, 0.0012]) {
    g.add(cable([[-0.0185, 0.003, dz], [-0.017, 0.0016, dz], [-0.015, 0.0012, dz]], 0.00022, MAT.steel, 8));
  }
  for (let i = 0; i < 3; i++) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.0068, 0.0007, 0.0007), MAT.gold);
    pin.position.set(0.0185, 0.0002, -0.0025 + i * 0.0025);
    g.add(pin);
  }
  const hdr = new THREE.Mesh(new THREE.BoxGeometry(0.0026, 0.0026, 0.008), MAT.plasticBlack);
  hdr.position.set(0.0148, 0.0002, 0);
  g.add(pot, screw, slot, ic, ldr, hdr);
  return g;
}

/** Bouton poussoir tactile 12 mm (boîtier métallique, capuchon noir, 4 pattes). */
export function createTactileButton() {
  const g = new THREE.Group();
  g.name = 'Bouton poussoir';
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.0035, 0.012, 2, 0.0006), MAT.plasticBlack);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.0118, 0.0005, 0.0118), MAT.steel);
  plate.position.y = 0.002;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0036, 0.004, 40), new THREE.MeshPhysicalMaterial({ color: '#17191d', roughness: 0.55, clearcoat: 0.2 }));
  cap.position.y = 0.0042;
  g.add(base, plate, cap);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.0055, 0.0003), MAT.steel);
    leg.position.set(x * 0.0062, -0.003, z * 0.0045);
    g.add(leg);
  }
  g.userData.cap = cap;
  return g;
}

/** LED 5 mm traversante (dôme translucide, pattes longue / courte). */
export function createLED5mm(color = '#ffffff') {
  const g = new THREE.Group();
  g.name = 'LED';
  const mat = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0, roughness: 0.08, transmission: 0.6, thickness: 0.004, ior: 1.5, clearcoat: 1 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.0055, 40), mat);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  dome.position.y = 0.00275;
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.0029, 0.0029, 0.0008, 40), mat);
  flange.position.y = -0.0028;
  const die = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.0008, 0.0008), MAT.steel);
  die.position.y = 0.0008;
  g.add(body, dome, flange, die);
  for (const [x, len] of [[-0.00125, 0.016], [0.00125, 0.013]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.00025, 0.00025, len, 8), MAT.steel);
    leg.position.set(x, -0.0032 - len / 2, 0);
    g.add(leg);
  }
  g.userData.mat = mat;
  return g;
}

/** Deux cellules Li-ion 18650 (gaine bleue), comme sur la photo du matériel. */
export function createCells18650() {
  const g = new THREE.Group();
  g.name = 'Batterie';
  const wrap = canvasTexture(512, 128, (c, w, h) => {
    const grd = c.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#3f8cff');
    grd.addColorStop(0.5, '#1f63d8');
    grd.addColorStop(1, '#123f99');
    c.fillStyle = grd;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.font = 'bold 30px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('Li-ion  18650', w * 0.42, h * 0.5);
  });
  const mat = new THREE.MeshPhysicalMaterial({ map: wrap, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 });
  [[-0.0095, 0], [0.0095, 0.004]].forEach(([z, dx]) => {
    const cell = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.065, 64, 1, true), mat);
    tube.rotation.z = Math.PI / 2;
    cell.add(tube);
    for (const sx of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0088, 0.0088, 0.001, 48), MAT.steel);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = sx * 0.0326;
      cell.add(cap);
    }
    const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.0016, 24), MAT.steel);
    nub.rotation.z = Math.PI / 2;
    nub.position.x = 0.0336;
    cell.add(nub);
    cell.position.set(dx, 0.009, z);
    g.add(cell);
  });
  return g;
}

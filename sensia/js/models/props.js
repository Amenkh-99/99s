// Décor : sol "studio", éclairages, obstacles et objets colorés.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture } from '../util.js';

const floorTex = canvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = '#101a2c';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,170,230,0.10)';
  g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke();
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke();
  }
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(30, 30);

/**
 * Crée une scène avec sol, brouillard et éclairage "studio".
 * Retourne { scene, lights:{hemi, key, rim}, floor }.
 */
export function createStage({ bg = '#07101f', fog = [6, 22], env, envIntensity = 0.55 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(bg, fog[0], fog[1]);
  if (env) {
    scene.environment = env;
    scene.environmentIntensity = envIntensity;
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: '#ffffff', map: floorTex, roughness: 0.82, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const hemi = new THREE.HemisphereLight('#bcd7ff', '#0b1220', 0.9);
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3; key.shadow.camera.right = 3;
  key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1; key.shadow.camera.far = 16;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  const rim = new THREE.DirectionalLight('#38d6ff', 1.6);
  rim.position.set(-4, 3, -5);
  scene.add(hemi, key, key.target, rim);
  return { scene, lights: { hemi, key, rim }, floor };
}

/** Carton (obstacle). */
export function createCardboardBox(w = 0.55, h = 0.48, d = 0.45) {
  const g = new THREE.Group();
  g.name = 'Carton';
  const tex = canvasTexture(256, 256, (c, W, H) => {
    c.fillStyle = '#b5844f';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = `rgba(${90 + Math.random() * 40},${60 + Math.random() * 25},30,${Math.random() * 0.12})`;
      c.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    c.strokeStyle = 'rgba(60,35,15,0.55)';
    c.lineWidth = 3;
    c.strokeRect(30, 150, 80, 50);
    c.font = 'bold 22px sans-serif';
    c.fillStyle = 'rgba(60,35,15,0.6)';
    c.fillText('↑ ↑', 48, 183);
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
  const box = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.012), mat);
  box.position.y = h / 2;
  box.castShadow = box.receiveShadow = true;
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.002, d + 0.004), new THREE.MeshStandardMaterial({ color: '#d8c39a', roughness: 0.35, transparent: true, opacity: 0.85 }));
  tape.position.y = h + 0.001;
  const tape2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.002), tape.material);
  tape2.position.set(0, h - 0.06, d / 2 + 0.001);
  const seam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.003, 0.003), new THREE.MeshStandardMaterial({ color: '#7a5530' }));
  seam.position.set(0, h + 0.001, 0);
  seam.rotation.y = Math.PI / 2;
  seam.scale.x = d / w;
  g.add(box, tape, tape2, seam);
  g.userData.size = { w, h, d };
  return g;
}

/** Chaise simple. */
export function createChair() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#8b5e3c', roughness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.4, metalness: 0.8 });
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.04, 0.42, 2, 0.015), wood);
  seat.position.y = 0.46;
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.3, 0.03, 2, 0.012), wood);
  back.position.set(0, 0.74, -0.2);
  g.add(seat, back);
  for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.46, 10), metal);
    leg.position.set(x, 0.23, z);
    g.add(leg);
  }
  for (const x of [-0.19, 0.19]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 10), metal);
    post.position.set(x, 0.66, -0.2);
    g.add(post);
  }
  g.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
  return g;
}

/** Plante en pot. */
export function createPlant() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 24), new THREE.MeshStandardMaterial({ color: '#d8dde4', roughness: 0.5 }));
  pot.position.y = 0.15;
  g.add(pot);
  const leaf = new THREE.MeshStandardMaterial({ color: '#2f7d4f', roughness: 0.7 });
  for (let i = 0; i < 9; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), leaf);
    const a = i * 2.4;
    l.position.set(Math.cos(a) * 0.1, 0.42 + (i % 3) * 0.12, Math.sin(a) * 0.1);
    l.scale.set(1, 1.3, 0.6);
    g.add(l);
  }
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

/** Pomme rouge (profil de révolution). */
export function createApple(color = '#c4161c') {
  const g = new THREE.Group();
  g.name = 'Pomme';
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const a = t * Math.PI;
    let r = Math.sin(a) * (1 + 0.12 * Math.sin(a * 2 - 0.6));
    let y = -Math.cos(a) * 0.9;
    if (t > 0.9) y -= (t - 0.9) * 1.2; // creux du pédoncule
    if (t < 0.06) y += (0.06 - t) * 1.5;
    pts.push(new THREE.Vector2(Math.max(0.001, r) * 0.04, y * 0.04));
  }
  const geo = new THREE.LatheGeometry(pts, 48);
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.3 });
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = true;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.003, 0.025, 8), new THREE.MeshStandardMaterial({ color: '#5a3a1e' }));
  stem.position.y = 0.036;
  stem.rotation.z = 0.25;
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.012, 0.01, 0.03, 0);
  leafShape.quadraticCurveTo(0.012, -0.01, 0, 0);
  const leaf = new THREE.Mesh(new THREE.ShapeGeometry(leafShape), new THREE.MeshStandardMaterial({ color: '#3a8f3c', side: THREE.DoubleSide, roughness: 0.5 }));
  leaf.position.set(0.003, 0.043, 0);
  leaf.rotation.set(0.4, 0.3, 0.35);
  g.add(body, stem, leaf);
  g.userData.geometry = geo;
  g.userData.radius = 0.044;
  return g;
}

/** Petit cube coloré (second objet de démonstration). */
export function createCube(color = '#1f5fe0') {
  const g = new THREE.Group();
  g.name = 'Cube';
  const geo = new RoundedBoxGeometry(0.07, 0.07, 0.07, 4, 0.01);
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.6 }));
  m.castShadow = true;
  m.rotation.set(0.2, 0.5, 0.1);
  g.add(m);
  g.userData.geometry = geo;
  g.userData.inner = m;
  g.userData.radius = 0.05;
  return g;
}

/** Banc + lampadaire éteint (décor de la scène d'obscurité). */
export function createBench() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#7b5236', roughness: 0.7 });
  const metal = new THREE.MeshStandardMaterial({ color: '#30353d', roughness: 0.4, metalness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.03, 0.1, 2, 0.01), wood);
    slat.position.set(0, 0.45, -0.12 + i * 0.12);
    g.add(slat);
  }
  for (const x of [-0.6, 0.6]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.36), metal);
    leg.position.set(x, 0.225, 0);
    g.add(leg);
  }
  g.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
  return g;
}

export function createPillar(h = 3) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(0.4, h, 0.4, 2, 0.04), new THREE.MeshStandardMaterial({ color: '#2a3446', roughness: 0.7 }));
  m.position.y = h / 2;
  m.castShadow = m.receiveShadow = true;
  return m;
}

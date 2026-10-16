// Décor : plateau de studio (sol satiné, éclairage trois points), obstacles
// et objets colorés. Textures procédurales, aucun fichier externe.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture, rng, MAT, brushedTex } from '../util.js';

// Dalle de sol 2 m : lignes fines + ligne principale, léger grain
const floorTex = canvasTexture(1024, 1024, (g, w, h) => {
  g.fillStyle = '#0d1626';
  g.fillRect(0, 0, w, h);
  const r = rng(5);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${150 + r() * 80},${170 + r() * 60},255,${r() * 0.025})`;
    g.fillRect(r() * w, r() * h, 2, 2);
  }
  g.strokeStyle = 'rgba(120,175,240,0.07)';
  g.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, h); g.stroke();
    g.beginPath(); g.moveTo(0, i * 256); g.lineTo(w, i * 256); g.stroke();
  }
  g.strokeStyle = 'rgba(90,200,255,0.16)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, w - 3, h - 3);
}, { repeat: [30, 30] });

const floorRough = canvasTexture(256, 256, (g, w, h) => {
  const r = rng(9);
  g.fillStyle = '#d2d2d2';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) {
    const v = 185 + r() * 65;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(r() * w, r() * h, 3, 3);
  }
}, { srgb: false, repeat: [60, 60] });

/** Halo lumineux doux posé au sol sous le sujet (effet "plateau photo"). */
function floorGlow(color = '#2a4f8f', radius = 3.2) {
  const tex = canvasTexture(256, 256, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  return m;
}

/**
 * Crée une scène avec sol satiné, brouillard et éclairage trois points :
 * lumière principale douce (ombres adoucies), contre-jour cyan, débouchage bleu nuit.
 * Retourne { scene, lights:{hemi, key, rim, fill}, floor, glow }.
 */
export function createStage({ bg = '#060e1c', fog = [6, 22], env, envIntensity = 0.6 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(bg, fog[0], fog[1]);
  if (env) {
    scene.environment = env;
    scene.environmentIntensity = envIntensity;
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: '#ffffff', map: floorTex, roughness: 0.62, roughnessMap: floorRough, metalness: 0.15 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const glow = floorGlow();
  scene.add(floor, glow);

  const hemi = new THREE.HemisphereLight('#bcd7ff', '#0b1220', 0.55);
  const key = new THREE.DirectionalLight('#fff6ec', 2.6);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3; key.shadow.camera.right = 3;
  key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1; key.shadow.camera.far = 16;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5; // pénombre douce
  key.shadow.blurSamples = 16;
  const rim = new THREE.DirectionalLight('#38d6ff', 2.4);
  rim.position.set(-4, 3, -5);
  const fill = new THREE.DirectionalLight('#5b7cff', 0.7);
  fill.position.set(-5, 2, 4);
  scene.add(hemi, key, key.target, rim, fill);
  return { scene, lights: { hemi, key, rim, fill }, floor, glow };
}

/** Carton ondulé (obstacle) : texture kraft, cannelures sur les tranches, ruban adhésif brillant. */
export function createCardboardBox(w = 0.55, h = 0.48, d = 0.45) {
  const g = new THREE.Group();
  g.name = 'Carton';
  const r = rng(Math.round(w * 1000));
  const tex = canvasTexture(512, 512, (c, W, H) => {
    c.fillStyle = '#b8874f';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 14000; i++) {
      c.fillStyle = `rgba(${80 + r() * 50},${52 + r() * 30},${22 + r() * 15},${r() * 0.1})`;
      c.fillRect(r() * W, r() * H, 1 + r() * 3, 1);
    }
    // fibres et léger vieillissement sur les bords
    const grd = c.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.75);
    grd.addColorStop(0, 'rgba(255,230,190,0.06)');
    grd.addColorStop(1, 'rgba(60,35,15,0.25)');
    c.fillStyle = grd;
    c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(55,32,14,0.6)';
    c.lineWidth = 4;
    c.strokeRect(50, 300, 150, 92);
    c.font = 'bold 40px sans-serif';
    c.fillStyle = 'rgba(55,32,14,0.65)';
    c.fillText('↑ ↑', 82, 360);
    c.font = 'bold 22px sans-serif';
    c.fillText('FRAGILE', 300, 90);
  });
  const bump = canvasTexture(64, 64, (c, W, H) => {
    for (let x = 0; x < W; x += 4) {
      c.fillStyle = x % 8 ? '#606060' : '#a0a0a0';
      c.fillRect(x, 0, 4, H);
    }
  }, { srgb: false });
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.93, bumpMap: bump, bumpScale: 0.4 });
  const box = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.01), mat);
  box.position.y = h / 2;
  box.castShadow = box.receiveShadow = true;
  const tapeMat = new THREE.MeshPhysicalMaterial({ color: '#d9c7a0', roughness: 0.18, clearcoat: 1, transparent: true, opacity: 0.88 });
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.002, d + 0.004), tapeMat);
  tape.position.y = h + 0.001;
  const tape2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.002), tapeMat);
  tape2.position.set(0, h - 0.06, d / 2 + 0.001);
  const seam = new THREE.Mesh(new THREE.BoxGeometry(d, 0.003, 0.003), new THREE.MeshStandardMaterial({ color: '#6e4b28' }));
  seam.position.set(0, h + 0.0015, 0);
  seam.rotation.y = Math.PI / 2;
  g.add(box, tape, tape2, seam);
  g.userData.size = { w, h, d };
  return g;
}

/** Chaise design (assise bois, piètement acier). */
export function createChair() {
  const g = new THREE.Group();
  const wood = new THREE.MeshPhysicalMaterial({ color: '#8b5e3c', roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const metal = new THREE.MeshPhysicalMaterial({ color: '#2b2f36', roughness: 0.3, metalness: 0.9, roughnessMap: brushedTex });
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.04, 0.42, 3, 0.016), wood);
  seat.position.y = 0.46;
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.3, 0.03, 3, 0.013), wood);
  back.position.set(0, 0.74, -0.2);
  g.add(seat, back);
  for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.011, 0.46, 16), metal);
    leg.position.set(x, 0.23, z);
    g.add(leg);
  }
  for (const x of [-0.19, 0.19]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 16), metal);
    post.position.set(x, 0.66, -0.2);
    g.add(post);
  }
  g.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
  return g;
}

/** Plante en pot (pot céramique laqué, feuillage satiné). */
export function createPlant() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 40), new THREE.MeshPhysicalMaterial({ color: '#d8dde4', roughness: 0.3, clearcoat: 0.8 }));
  pot.position.y = 0.15;
  g.add(pot);
  const leaf = new THREE.MeshPhysicalMaterial({ color: '#2f7d4f', roughness: 0.55, sheen: 0.6, sheenColor: '#7fd49a' });
  for (let i = 0; i < 11; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), leaf);
    const a = i * 2.4;
    l.position.set(Math.cos(a) * 0.1, 0.42 + (i % 3) * 0.12, Math.sin(a) * 0.1);
    l.scale.set(1, 1.3, 0.55);
    l.rotation.set(a * 0.3, a, 0.2);
    g.add(l);
  }
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

/** Pomme rouge : profil de révolution, peau striée, vernis naturel. */
export function createApple(color = '#c4161c') {
  const g = new THREE.Group();
  g.name = 'Pomme';
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = t * Math.PI;
    const r = Math.sin(a) * (1 + 0.12 * Math.sin(a * 2 - 0.6));
    let y = -Math.cos(a) * 0.9;
    if (t > 0.9) y -= (t - 0.9) * 1.2; // creux du pédoncule
    if (t < 0.06) y += (0.06 - t) * 1.5;
    pts.push(new THREE.Vector2(Math.max(0.001, r) * 0.04, y * 0.04));
  }
  const geo = new THREE.LatheGeometry(pts, 72);
  const skin = canvasTexture(512, 256, (c, w, h) => {
    const r = rng(17);
    const grd = c.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#7a0c10');
    grd.addColorStop(0.35, color);
    grd.addColorStop(0.75, '#d8301f');
    grd.addColorStop(1, '#e0a23a');
    c.fillStyle = grd;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      c.strokeStyle = `rgba(${90 + r() * 60},10,12,${0.12 + r() * 0.2})`;
      c.lineWidth = 1 + r() * 3;
      const x = r() * w;
      c.beginPath();
      c.moveTo(x, 0);
      c.bezierCurveTo(x + (r() - 0.5) * 30, h * 0.3, x + (r() - 0.5) * 30, h * 0.7, x + (r() - 0.5) * 20, h);
      c.stroke();
    }
    for (let i = 0; i < 400; i++) {
      c.fillStyle = `rgba(255,220,160,${r() * 0.35})`;
      c.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
  });
  const mat = new THREE.MeshPhysicalMaterial({ map: skin, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: '#ff9a8a' });
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = true;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.003, 0.026, 10), new THREE.MeshStandardMaterial({ color: '#5a3a1e', roughness: 0.8 }));
  stem.position.y = 0.036;
  stem.rotation.z = 0.25;
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.012, 0.01, 0.03, 0);
  leafShape.quadraticCurveTo(0.012, -0.01, 0, 0);
  const leaf = new THREE.Mesh(new THREE.ShapeGeometry(leafShape, 12), new THREE.MeshPhysicalMaterial({ color: '#3a8f3c', side: THREE.DoubleSide, roughness: 0.4, sheen: 0.5 }));
  leaf.position.set(0.003, 0.043, 0);
  leaf.rotation.set(0.4, 0.3, 0.35);
  g.add(body, stem, leaf);
  g.userData.geometry = geo;
  g.userData.radius = 0.044;
  return g;
}

/** Petit cube bleu laqué (second objet de démonstration). */
export function createCube(color = '#1f5fe0') {
  const g = new THREE.Group();
  g.name = 'Cube';
  const geo = new RoundedBoxGeometry(0.07, 0.07, 0.07, 6, 0.01);
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0.05 }));
  m.castShadow = true;
  m.rotation.set(0.2, 0.5, 0.1);
  g.add(m);
  g.userData.geometry = geo;
  g.userData.inner = m;
  g.userData.radius = 0.05;
  return g;
}

/** Banc (lattes de bois verni, piètement acier brossé). */
export function createBench() {
  const g = new THREE.Group();
  const wood = new THREE.MeshPhysicalMaterial({ color: '#7b5236', roughness: 0.5, clearcoat: 0.5 });
  const metal = new THREE.MeshPhysicalMaterial({ color: '#30353d', roughness: 0.3, metalness: 0.9, roughnessMap: brushedTex });
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.03, 0.1, 3, 0.012), wood);
    slat.position.set(0, 0.45, -0.12 + i * 0.12);
    g.add(slat);
  }
  for (const x of [-0.6, 0.6]) {
    const leg = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.45, 0.36, 2, 0.01), metal);
    leg.position.set(x, 0.225, 0);
    g.add(leg);
  }
  g.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
  return g;
}

/** Colonne architecturale avec bandeau LED cyan (ambiance futuriste). */
export function createPillar(h = 3, { strips = true } = {}) {
  const g = new THREE.Group();
  const col = new THREE.Mesh(
    new RoundedBoxGeometry(0.4, h, 0.4, 3, 0.05),
    new THREE.MeshStandardMaterial({ color: '#273246', roughness: 0.5, metalness: 0.25 })
  );
  col.castShadow = col.receiveShadow = true;
  g.add(col);
  for (const sx of strips ? [-1, 1] : []) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, h * 0.86, 0.004),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#2ee6f0').multiplyScalar(0.9), toneMapped: false })
    );
    strip.position.set(sx * 0.12, 0, 0.202);
    g.add(strip);
  }
  const capMat = MAT.titanium;
  for (const y of [-h / 2 + 0.03, h / 2 - 0.03]) {
    const band = new THREE.Mesh(new RoundedBoxGeometry(0.43, 0.06, 0.43, 2, 0.01), capMat);
    band.position.y = y;
    g.add(band);
  }
  // le groupe est positionné par son centre (compatibilité : y = h/2)
  g.position.y = h / 2;
  return g;
}

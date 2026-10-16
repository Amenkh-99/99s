// Modèle 3D simplifié des lunettes SENSIA (unités : mètres).
// Repère local : x = côté gauche de la personne, y = haut, z = vers l'avant.
// Les positions des modules sont conceptuelles (modèle illustratif),
// inspirées de la photo du prototype : HC-SR04 au centre, LED aux deux extrémités.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAT, roundedPolygon, canvasTexture, cable } from '../util.js';
import { makeBeam } from './effects.js';

function lensPolygon(wTop, wBottom, h) {
  return [
    [-wTop / 2, h / 2],
    [wTop / 2, h / 2],
    [wBottom / 2, -h / 2],
    [-wBottom / 2, -h / 2],
  ];
}

const meshTexture = canvasTexture(64, 64, (g, w, h) => {
  g.fillStyle = '#3a3e45';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#16181c';
  for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < w; x += 4) g.fillRect(x, y, 2, 2);
});

const ldrTexture = canvasTexture(64, 64, (g, w, h) => {
  g.fillStyle = '#d9822b';
  g.beginPath();
  g.arc(32, 32, 32, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#4a2a10';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(10, 14);
  for (let i = 0; i < 6; i++) {
    const y = 14 + i * 7;
    g.lineTo(54, y);
    g.lineTo(54, y + 3.5);
    g.lineTo(10, y + 3.5);
    g.lineTo(10, y + 7);
  }
  g.stroke();
});

/** Module HC-SR04 (deux transducteurs sur une carte bleue). */
export function createHCSR04() {
  const g = new THREE.Group();
  g.name = 'HC-SR04';
  const board = new THREE.Mesh(new RoundedBoxGeometry(0.046, 0.021, 0.0016, 2, 0.0008), MAT.pcbBlue);
  g.add(board);
  const capMat = new THREE.MeshStandardMaterial({ map: meshTexture, roughness: 0.95, metalness: 0.2 });
  for (const x of [-0.0128, 0.0128]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.0079, 0.0079, 0.0115, 40, 1, true), MAT.steel);
    can.rotation.x = Math.PI / 2;
    can.position.set(x, 0, 0.0065);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0074, 0.0007, 8, 40), MAT.steel);
    rim.position.set(x, 0, 0.0122);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.0072, 40), capMat);
    cap.position.set(x, 0, 0.0118);
    g.add(can, rim, cap);
  }
  const xtal = new THREE.Mesh(new THREE.CapsuleGeometry(0.0016, 0.006, 4, 12), MAT.steel);
  xtal.rotation.z = Math.PI / 2;
  xtal.position.set(0, 0.0065, 0.0018);
  const header = new THREE.Mesh(new THREE.BoxGeometry(0.0105, 0.0026, 0.0028), MAT.plasticBlack);
  header.position.set(0, 0.0115, 0);
  g.add(xtal, header);
  for (let i = 0; i < 4; i++) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.005, 0.0006), MAT.gold);
    pin.position.set(-0.0038 + i * 0.00254, 0.0145, 0);
    g.add(pin);
  }
  return g;
}

/** Module TCS3200 (capteur de couleur entouré de 4 LED blanches). */
export function createTCS3200() {
  const g = new THREE.Group();
  g.name = 'TCS3200';
  g.add(new THREE.Mesh(new RoundedBoxGeometry(0.0195, 0.0195, 0.0015, 2, 0.0007), MAT.pcbBlue));
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.004, 0.0014), MAT.chip);
  chip.position.z = 0.0013;
  const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.0034, 0.0006, 8, 32), MAT.plasticBlack);
  lensRing.position.z = 0.0016;
  g.add(chip, lensRing);
  const ledMat = new THREE.MeshStandardMaterial({ color: '#f4f6ff', emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.2 });
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.0028, 0.0014), ledMat);
    led.position.set(x * 0.0065, y * 0.0065, 0.0012);
    g.add(led);
  }
  g.userData.ledMat = ledMat;
  return g;
}

/** LDR (photorésistance) : petite pastille orange à piste sinueuse. */
export function createLDR() {
  const g = new THREE.Group();
  g.name = 'LDR';
  const side = new THREE.MeshStandardMaterial({ color: '#c97a2a', roughness: 0.5 });
  const top = new THREE.MeshPhysicalMaterial({ map: ldrTexture, roughness: 0.15, clearcoat: 1 });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.0018, 32), [side, top, side]);
  head.position.y = 0.0016;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0036, 0.0012, 24), MAT.plasticBlack);
  g.add(base, head);
  return g;
}

/** LED d'éclairage (boîtier + dôme émissif + projecteur Three.js). */
export function createLED(dir) {
  const g = new THREE.Group();
  g.name = 'LED';
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0048, 0.008, 24), MAT.plasticBlack);
  housing.rotation.x = Math.PI / 2;
  const mat = new THREE.MeshPhysicalMaterial({ color: '#fff7e6', emissive: '#fff1d6', emissiveIntensity: 0, roughness: 0.25, clearcoat: 0.5, envMapIntensity: 0.35 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.0036, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  dome.rotation.x = Math.PI / 2;
  dome.position.z = 0.004;
  g.add(housing, dome);

  const spot = new THREE.SpotLight('#fff0d0', 0, 8, 0.4, 0.6, 1.2);
  spot.position.z = 0.005;
  spot.target.position.copy(dir.clone().multiplyScalar(2));
  g.add(spot, spot.target);

  const beam = makeBeam('#fff0cf', 2.2, 0.55, dir);
  beam.position.z = 0.005;
  g.add(beam);
  g.userData = { mat, spot, beam };
  return g;
}

/** Bouton poussoir (socle noir + capuchon cyan). */
export function createButton() {
  const g = new THREE.Group();
  g.name = 'Bouton';
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.0045, 0.0085, 0.0085, 2, 0.0008), MAT.plasticBlack);
  const capMat = new THREE.MeshStandardMaterial({ color: '#19c6d8', emissive: '#19c6d8', emissiveIntensity: 0.15, roughness: 0.35 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0027, 0.0027, 0.0022, 24), capMat);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = 0.0032;
  g.add(base, cap);
  g.userData = { cap, capMat };
  return g;
}

/**
 * Lunettes complètes. Retourne { group, parts, api }.
 * api.setLeds(v 0..1), api.setTcsLight(v), api.press(v 0..1), api.glowPart(name, v)
 */
export function createGlasses({ withWires = true } = {}) {
  const group = new THREE.Group();
  group.name = 'SENSIA';
  const frame = new THREE.Group();
  frame.name = 'Monture';
  group.add(frame);

  // Cerclages des verres (extrusion d'une forme trapézoïdale arrondie)
  const outer = lensPolygon(0.057, 0.049, 0.043);
  const inner = lensPolygon(0.047, 0.039, 0.033);
  const extr = { depth: 0.005, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.001, bevelSegments: 3, curveSegments: 18 };
  for (const sx of [-1, 1]) {
    const shape = roundedPolygon(outer, 0.012);
    shape.holes.push(roundedPolygon(inner, 0.008));
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, extr), MAT.acetate);
    rim.position.set(sx * 0.0345, 0, -0.0025);
    rim.castShadow = true;
    const lens = new THREE.Mesh(new THREE.ShapeGeometry(roundedPolygon(lensPolygon(0.049, 0.041, 0.035), 0.008), 12), MAT.lens);
    lens.position.set(sx * 0.0345, 0, 0.0004);
    frame.add(rim, lens);
  }
  const brow = new THREE.Mesh(new RoundedBoxGeometry(0.146, 0.010, 0.009, 3, 0.003), MAT.acetate);
  brow.position.set(0, 0.0185, 0.0002);
  const bridge = new THREE.Mesh(new RoundedBoxGeometry(0.016, 0.006, 0.006, 2, 0.002), MAT.acetate);
  bridge.position.set(0, 0.006, 0);
  frame.add(brow, bridge);

  // Tenons + branches
  const temples = {};
  for (const sx of [-1, 1]) {
    const end = new THREE.Mesh(new RoundedBoxGeometry(0.010, 0.016, 0.013, 2, 0.003), MAT.acetate);
    end.position.set(sx * 0.0685, 0.0115, -0.002);
    frame.add(end);
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.071, 0.0125, -0.008);
    pivot.rotation.y = -sx * 0.12;
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.0042, 0.0095, 0.128, 2, 0.0018), MAT.acetate);
    arm.position.z = -0.064;
    const bendPivot = new THREE.Group();
    bendPivot.position.z = -0.126;
    bendPivot.rotation.x = -0.65;
    const tip = new THREE.Mesh(new RoundedBoxGeometry(0.0042, 0.0085, 0.04, 2, 0.0018), MAT.acetate);
    tip.position.z = -0.018;
    bendPivot.add(tip);
    pivot.add(arm, bendPivot);
    frame.add(pivot);
    temples[sx] = pivot;
  }

  // Modules fixés sur la monture
  const hc = createHCSR04();
  hc.position.set(0, 0.003, 0.0105);
  const tcs = createTCS3200();
  tcs.position.set(0.062, -0.0175, 0.0085);
  tcs.rotation.x = 0.5;
  const tcsMount = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.004), MAT.plasticBlack);
  tcsMount.position.set(0.064, -0.006, 0.003);
  frame.add(tcsMount);

  const ldr = createLDR();
  ldr.position.set(-0.047, 0.0235, 0.0005);

  const ledDirL = new THREE.Vector3(0.1, -0.62, 1);
  const ledDirR = new THREE.Vector3(-0.1, -0.62, 1);
  const ledL = createLED(ledDirL);
  ledL.position.set(0.0705, 0.0125, 0.0065);
  const ledR = createLED(ledDirR);
  ledR.position.set(-0.0705, 0.0125, 0.0065);

  const button = createButton();
  // le bouton est sur la branche droite (côté -x), face extérieure
  button.position.set(-0.0045, 0, -0.03);
  button.rotation.y = Math.PI;
  temples[-1].add(button);

  group.add(hc, tcs, ldr, ledL, ledR);

  // Fils (indicatifs, d'après la photo du prototype)
  if (withWires) {
    const wireCols = ['#e8871e', '#1aa58a', '#8a5a3c', '#e3c21b'];
    wireCols.forEach((c, i) => {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
      const dx = (i - 1.5) * 0.0013;
      const w = cable(
        [[dx, 0.016, 0.009], [0.02 + dx, 0.03, 0.002], [0.06, 0.027 + i * 0.001, -0.004], [0.074 + i * 0.001, 0.02, -0.03], [0.083, 0.02, -0.08], [0.088, 0.016, -0.12]],
        0.0007, m, 48
      );
      group.add(w);
    });
    const red = new THREE.MeshStandardMaterial({ color: '#d42a2a', roughness: 0.6 });
    group.add(cable([[-0.047, 0.026, -0.001], [-0.066, 0.024, -0.01], [-0.077, 0.02, -0.05], [-0.087, 0.016, -0.12]], 0.0007, red, 32));
  }

  group.traverse((o) => {
    if (o.isMesh && !o.material.blending) o.castShadow = true;
  });

  const parts = { frame, hc, tcs, ldr, ledL, ledR, button, temples };

  const glowTargets = new Map();
  const api = {
    setLeds(v) {
      for (const led of [ledL, ledR]) {
        const { mat, spot, beam } = led.userData;
        mat.emissiveIntensity = v * 6;
        spot.intensity = v * 22;
        beam.material.uniforms.uOpacity.value = v * 0.32;
        beam.visible = v > 0.01;
      }
    },
    setTcsLight(v) {
      tcs.userData.ledMat.emissiveIntensity = v * 3;
    },
    press(v) {
      button.userData.cap.position.x = 0.0032 - v * 0.0014;
      button.userData.capMat.emissiveIntensity = 0.15 + v * 2.5;
    },
    /** Surbrillance cyan d'une pièce (vue éclatée, légende) */
    glowPart(obj, v) {
      if (!glowTargets.has(obj)) {
        // matériaux clonés pour ne pas affecter les autres pièces ; les
        // références utilisées par l'API (LED, bouton…) sont mises à jour.
        const list = [];
        const cache = new Map();
        obj.traverse((o) => {
          if (o.isMesh && o.material && o.material.emissive && !Array.isArray(o.material)) {
            if (!cache.has(o.material)) {
              const c = o.material.clone();
              cache.set(o.material, c);
              list.push({ m: c, e: c.emissive.clone(), i: c.emissiveIntensity });
            }
            o.material = cache.get(o.material);
          }
        });
        for (const holder of [ledL.userData, ledR.userData, tcs.userData, button.userData]) {
          for (const k of ['mat', 'ledMat', 'capMat']) if (cache.has(holder[k])) holder[k] = cache.get(holder[k]);
        }
        glowTargets.set(obj, list);
      }
      for (const it of glowTargets.get(obj)) {
        it.m.emissive.copy(it.e).lerp(new THREE.Color('#2ee6f0'), v);
        it.m.emissiveIntensity = it.i + v * 0.9;
      }
    },
  };
  api.setLeds(0);
  return { group, parts, api };
}

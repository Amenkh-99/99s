// Modèle 3D des lunettes SENSIA (unités : mètres). Modèle illustratif.
// Repère local : x = côté gauche de la personne, y = haut, z = vers l'avant.
// Les positions des modules sont conceptuelles, inspirées de la photo du
// prototype : HC-SR04 au centre, LED aux deux extrémités de la monture.
// Matériaux : titane graphite brossé, verres teintés à transmission
// (réfraction + reflet irisé), circuits imprimés procéduraux.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAT, roundedPolygon, canvasTexture, cable, pcbTextures, pcbMaterials, wireMaterial } from '../util.js';
import { makeBeam } from './effects.js';

function lensPolygon(wTop, wBottom, h) {
  return [
    [-wTop / 2, h / 2],
    [wTop / 2, h / 2],
    [wBottom / 2, -h / 2],
    [-wBottom / 2, -h / 2],
  ];
}

// Grille métallique des transducteurs (maille hexagonale fine)
const meshTexture = canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#4a4f57';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#0d0f12';
  for (let y = 0, row = 0; y < h + 6; y += 5.2, row++) {
    for (let x = row % 2 ? 3 : 0; x < w + 6; x += 6) {
      g.beginPath();
      g.arc(x, y, 2.1, 0, Math.PI * 2);
      g.fill();
    }
  }
  const grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,0.10)');
  grd.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
});

// Photorésistance : pastille céramique et piste sinueuse sous résine époxy
const ldrTexture = canvasTexture(128, 128, (g) => {
  const grd = g.createRadialGradient(64, 56, 4, 64, 64, 64);
  grd.addColorStop(0, '#f1a54a');
  grd.addColorStop(1, '#b8651d');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(64, 64, 64, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#3d220c';
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(22, 26);
  for (let i = 0; i < 6; i++) {
    const y = 26 + i * 13;
    g.lineTo(106, y);
    g.lineTo(106, y + 6.5);
    g.lineTo(22, y + 6.5);
    g.lineTo(22, y + 13);
  }
  g.stroke();
  g.fillStyle = '#d8d8d8';
  g.fillRect(8, 56, 10, 16);
  g.fillRect(110, 56, 10, 16);
});

/** Module HC-SR04 : carte bleue, deux transducteurs en acier brossé, quartz, connecteur. */
export function createHCSR04() {
  const g = new THREE.Group();
  g.name = 'HC-SR04';
  const tex = pcbTextures({
    w: 512, h: 234, seed: 11, mask: '#1f55c9', maskDark: '#163f9c', copper: 'rgba(120,170,255,0.35)',
    pads: [[0.43, 0.08, 6], [0.48, 0.08, 6], [0.53, 0.08, 6], [0.58, 0.08, 6]],
    draw: (c, W, H, relief) => {
      // anneaux de soudure autour des transducteurs
      for (const x of [0.22, 0.78]) {
        c.strokeStyle = relief ? '#ffffff' : '#e3bc66';
        c.lineWidth = 5;
        c.beginPath();
        c.arc(x * W, H * 0.5, H * 0.43, 0, Math.PI * 2);
        c.stroke();
      }
    },
    text: [['HC-SR04', 0.5, 0.78, 22], ['T', 0.06, 0.86, 22], ['R', 0.94, 0.86, 22], ['VCC TRIG ECHO GND', 0.505, 0.21, 11]],
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.021, 0.0016), pcbMaterials(tex, '#123a8e', 4));
  g.add(board);
  const capMat = new THREE.MeshStandardMaterial({ map: meshTexture, roughness: 0.8, metalness: 0.55, bumpMap: meshTexture, bumpScale: 2 });
  for (const x of [-0.0128, 0.0128]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.0079, 0.0079, 0.0115, 64, 1, true), MAT.steel);
    can.rotation.x = Math.PI / 2;
    can.position.set(x, 0, 0.0065);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0075, 0.0007, 12, 64), MAT.steel);
    rim.position.set(x, 0, 0.0122);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.0073, 64), capMat);
    cap.position.set(x, 0, 0.0117);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.0052, 0.0004, 8, 48), MAT.plasticBlack);
    inner.position.set(x, 0, 0.0119);
    g.add(can, rim, cap, inner);
  }
  const xtal = new THREE.Mesh(new THREE.CapsuleGeometry(0.0016, 0.006, 6, 16), MAT.steel);
  xtal.rotation.z = Math.PI / 2;
  xtal.position.set(0, 0.0062, 0.0018);
  const header = new THREE.Mesh(new RoundedBoxGeometry(0.0105, 0.0026, 0.0028, 2, 0.0004), MAT.plasticBlack);
  header.position.set(0, 0.0115, 0);
  g.add(xtal, header);
  for (let i = 0; i < 4; i++) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.005, 0.0006), MAT.gold);
    pin.position.set(-0.0038 + i * 0.00254, 0.0145, 0);
    g.add(pin);
  }
  // petits composants CMS (résistances, circuits) au dos visible par la tranche
  for (let i = 0; i < 4; i++) {
    const smd = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.0012, 0.0007), MAT.chip);
    smd.position.set(-0.004 + i * 0.0027, -0.0075, 0.0011);
    g.add(smd);
  }
  return g;
}

/** Module TCS3200 : carte verte, capteur sous lentille, 4 LED blanches CMS. */
export function createTCS3200() {
  const g = new THREE.Group();
  g.name = 'TCS3200';
  const tex = pcbTextures({
    w: 256, h: 256, seed: 23, mask: '#1e7a43', maskDark: '#145a30', copper: 'rgba(150,230,170,0.35)',
    pads: [[0.12, 0.93, 6], [0.27, 0.93, 6], [0.42, 0.93, 6], [0.58, 0.93, 6], [0.73, 0.93, 6], [0.88, 0.93, 6]],
    text: [['TCS3200', 0.5, 0.1, 22], ['S0 S1 S2 S3 OUT', 0.5, 0.82, 13]],
  });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.0195, 0.0195, 0.0015), pcbMaterials(tex, '#0f4a26', 4)));
  const chip = new THREE.Mesh(new RoundedBoxGeometry(0.005, 0.004, 0.0014, 2, 0.0003), MAT.chip);
  chip.position.z = 0.0013;
  // lentille transparente au-dessus de la matrice de photodiodes
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.0026, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, thickness: 0.002, roughness: 0.02, ior: 1.5, clearcoat: 1 })
  );
  dome.rotation.x = Math.PI / 2;
  dome.position.z = 0.002;
  const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.0034, 0.0006, 10, 40), MAT.plasticBlack);
  lensRing.position.z = 0.0018;
  g.add(chip, dome, lensRing);
  const ledMat = new THREE.MeshStandardMaterial({ color: '#f6eeb5', emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.18 });
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.0012), MAT.plasticWhite);
    body.position.set(x * 0.0065, y * 0.0065, 0.0011);
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.0011, 20), ledMat);
    led.position.set(x * 0.0065, y * 0.0065, 0.00175);
    g.add(body, led);
  }
  g.userData.ledMat = ledMat;
  return g;
}

/** LDR (photorésistance) : pastille céramique sous résine, sur un petit socle. */
export function createLDR() {
  const g = new THREE.Group();
  g.name = 'LDR';
  const side = new THREE.MeshPhysicalMaterial({ color: '#c97a2a', roughness: 0.35, clearcoat: 1 });
  const top = new THREE.MeshPhysicalMaterial({ map: ldrTexture, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02 });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.0018, 48), [side, top, side]);
  head.position.y = 0.0016;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0038, 0.0012, 32), MAT.titanium);
  g.add(base, head);
  return g;
}

/** LED d'éclairage : bague en titane, lentille diffusante, projecteur Three.js et faisceau. */
export function createLED(dir) {
  const g = new THREE.Group();
  g.name = 'LED';
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.0046, 0.0049, 0.008, 40), MAT.titanium);
  housing.rotation.x = Math.PI / 2;
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.0041, 0.0006, 10, 40), MAT.steel);
  bezel.position.z = 0.004;
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#f4f1ea', emissive: '#fff1d6', emissiveIntensity: 0, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.5,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.0036, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  dome.rotation.x = Math.PI / 2;
  dome.position.z = 0.0038;
  g.add(housing, bezel, dome);

  const spot = new THREE.SpotLight('#fff0d0', 0, 8, 0.4, 0.6, 1.2);
  spot.position.z = 0.005;
  spot.target.position.copy(dir.clone().multiplyScalar(2));
  g.add(spot, spot.target);

  const beam = makeBeam('#fff0cf', 2.2, 0.55, dir);
  beam.position.z = 0.005;
  beam.onBeforeRender = () => (beam.material.uniforms.uTime.value = performance.now() / 1000);
  g.add(beam);
  g.userData = { mat, spot, beam };
  return g;
}

/** Bouton poussoir : socle noir, bague métallique, capuchon cyan rétroéclairé. */
export function createButton() {
  const g = new THREE.Group();
  g.name = 'Bouton';
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.0045, 0.0085, 0.0085, 3, 0.0012), MAT.plasticBlack);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0031, 0.00045, 10, 32), MAT.steel);
  ring.rotation.y = Math.PI / 2;
  ring.position.x = 0.0023;
  const capMat = new THREE.MeshPhysicalMaterial({ color: '#19c6d8', emissive: '#19c6d8', emissiveIntensity: 0.25, roughness: 0.25, clearcoat: 1 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0027, 0.0027, 0.0022, 32), capMat);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = 0.0032;
  g.add(base, ring, cap);
  g.userData = { cap, capMat };
  return g;
}

/**
 * Lunettes complètes. Retourne { group, parts, api }.
 * api.setLeds(v 0..1), api.setTcsLight(v), api.press(v 0..1), api.glowPart(obj, v)
 */
export function createGlasses({ withWires = true, lens: lensQuality = 'full' } = {}) {
  const group = new THREE.Group();
  group.name = 'SENSIA';
  const frame = new THREE.Group();
  frame.name = 'Monture';
  group.add(frame);

  // Cerclages des verres (extrusion d'une forme trapézoïdale arrondie, chanfreins doux)
  const outer = lensPolygon(0.057, 0.049, 0.043);
  const inner = lensPolygon(0.047, 0.039, 0.033);
  const extr = { depth: 0.005, bevelEnabled: true, bevelThickness: 0.0013, bevelSize: 0.0011, bevelSegments: 5, curveSegments: 28 };
  for (const sx of [-1, 1]) {
    const shape = roundedPolygon(outer, 0.012);
    shape.holes.push(roundedPolygon(inner, 0.008));
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, extr), MAT.frame);
    rim.position.set(sx * 0.0345, 0, -0.0025);
    // verre : épaisseur réelle pour que la réfraction soit visible
    const lensShape = roundedPolygon(lensPolygon(0.049, 0.041, 0.035), 0.008);
    const lens = new THREE.Mesh(
      new THREE.ExtrudeGeometry(lensShape, { depth: 0.0012, bevelEnabled: true, bevelThickness: 0.0003, bevelSize: 0.0003, bevelSegments: 2, curveSegments: 28 }),
      lensQuality === 'light' ? MAT.lensLight : MAT.lens
    );
    lens.position.set(sx * 0.0345, 0, -0.0002);
    lens.userData.noShadow = true;
    frame.add(rim, lens);
  }
  const brow = new THREE.Mesh(new RoundedBoxGeometry(0.146, 0.010, 0.009, 4, 0.0032), MAT.frame);
  brow.position.set(0, 0.0185, 0.0002);
  // liseré lumineux discret sous le sourcil de la monture (signature visuelle)
  const accent = new THREE.Mesh(
    new THREE.BoxGeometry(0.118, 0.0005, 0.0004),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#2ee6f0').multiplyScalar(1.4), toneMapped: false })
  );
  accent.position.set(0, 0.0136, 0.0048);
  const bridge = new THREE.Mesh(new RoundedBoxGeometry(0.016, 0.006, 0.006, 3, 0.0022), MAT.frame);
  bridge.position.set(0, 0.006, 0);
  frame.add(brow, accent, bridge);

  // Plaquettes de nez en silicone sur tiges métalliques
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0004, 0.0004, 0.008, 8), MAT.steel);
    arm.position.set(sx * 0.0085, -0.002, -0.004);
    arm.rotation.set(0.9, 0, sx * 0.4);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 20, 12), MAT.silicone);
    pad.scale.set(0.45, 1, 0.75);
    pad.position.set(sx * 0.0105, -0.007, -0.0075);
    pad.rotation.z = sx * 0.35;
    frame.add(arm, pad);
  }

  // Tenons + charnières + branches en titane brossé
  const temples = {};
  for (const sx of [-1, 1]) {
    const end = new THREE.Mesh(new RoundedBoxGeometry(0.010, 0.016, 0.013, 3, 0.0032), MAT.frame);
    end.position.set(sx * 0.0685, 0.0115, -0.002);
    frame.add(end);
    for (const dy of [-0.004, 0.004]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.0008, 16), MAT.steel);
      screw.rotation.z = Math.PI / 2;
      screw.position.set(sx * 0.0738, 0.0115 + dy, -0.006);
      frame.add(screw);
    }
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.071, 0.0125, -0.008);
    pivot.rotation.y = -sx * 0.12;
    // branches graphite comme la face (le titane clair renvoyait trop la lumière du studio)
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.0034, 0.0088, 0.128, 3, 0.0015), MAT.frame);
    arm.position.z = -0.064;
    const bendPivot = new THREE.Group();
    bendPivot.position.z = -0.126;
    bendPivot.rotation.x = -0.65;
    const tip = new THREE.Mesh(new RoundedBoxGeometry(0.0046, 0.0086, 0.042, 3, 0.002), MAT.rubber);
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
  const tcsMount = new THREE.Mesh(new RoundedBoxGeometry(0.008, 0.012, 0.004, 2, 0.001), MAT.frame);
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

  // Fils gainés silicone (indicatifs, d'après la photo du prototype)
  if (withWires) {
    const wireCols = ['#e8871e', '#1aa58a', '#8a5a3c', '#e3c21b'];
    wireCols.forEach((c, i) => {
      const dx = (i - 1.5) * 0.0013;
      group.add(cable(
        [[dx, 0.016, 0.009], [0.02 + dx, 0.028, 0.002], [0.06, 0.026 + i * 0.001, -0.004], [0.074 + i * 0.001, 0.02, -0.03], [0.083, 0.02, -0.08], [0.088, 0.016, -0.12]],
        0.0007, wireMaterial(c), 64
      ));
    });
    group.add(cable([[-0.047, 0.026, -0.001], [-0.066, 0.024, -0.01], [-0.077, 0.02, -0.05], [-0.087, 0.016, -0.12]], 0.0007, wireMaterial('#d42a2a'), 40));
  }

  group.traverse((o) => {
    if (o.isMesh && !o.material.blending && !o.userData.noShadow) o.castShadow = true;
  });

  const parts = { frame, hc, tcs, ldr, ledL, ledR, button, temples };

  const glowTargets = new Map();
  const api = {
    setLeds(v) {
      for (const led of [ledL, ledR]) {
        const { mat, spot, beam } = led.userData;
        mat.emissiveIntensity = v * 7;
        spot.intensity = v * 22;
        beam.material.uniforms.uOpacity.value = v * 0.3;
        beam.visible = v > 0.01;
      }
    },
    setTcsLight(v) {
      tcs.userData.ledMat.emissiveIntensity = v * 4;
    },
    press(v) {
      button.userData.cap.position.x = 0.0032 - v * 0.0014;
      button.userData.capMat.emissiveIntensity = 0.25 + v * 3;
    },
    /** Surbrillance cyan d'une pièce (vue éclatée, légende) */
    glowPart(obj, v) {
      if (!glowTargets.has(obj)) {
        // matériaux clonés pour ne pas affecter les autres pièces ; les
        // références utilisées par l'API (LED, bouton…) sont mises à jour.
        const list = [];
        const cache = new Map();
        const cloneMat = (m) => {
          if (!m.emissive) return m;
          if (!cache.has(m)) {
            const c = m.clone();
            cache.set(m, c);
            list.push({ m: c, e: c.emissive.clone(), i: c.emissiveIntensity });
          }
          return cache.get(m);
        };
        obj.traverse((o) => {
          if (!o.isMesh || !o.material || o.material.blending === THREE.AdditiveBlending) return;
          o.material = Array.isArray(o.material) ? o.material.map(cloneMat) : cloneMat(o.material);
        });
        for (const holder of [ledL.userData, ledR.userData, tcs.userData, button.userData]) {
          for (const k of ['mat', 'ledMat', 'capMat']) if (cache.has(holder[k])) holder[k] = cache.get(holder[k]);
        }
        glowTargets.set(obj, list);
      }
      for (const it of glowTargets.get(obj)) {
        it.m.emissive.copy(it.e).lerp(new THREE.Color('#2ee6f0'), v);
        it.m.emissiveIntensity = it.i + v * 0.45;
      }
    },
  };
  api.setLeds(0);
  return { group, parts, api };
}

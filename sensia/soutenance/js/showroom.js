// Scène 3D unique de la soutenance : un « showroom » où les lunettes SENSIA
// et les composants sont présentés sur un socle lumineux. Chaque diapositive
// demande un cadrage (« plan ») ; la caméra y glisse en douceur.
// Les modèles sont illustratifs (formes simplifiées, positions conceptuelles).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LabelSet } from '../../js/engine.js';
import { createGlasses, createHCSR04, createTCS3200 } from '../../js/models/glasses.js';
import {
  createESP32, createDFPlayer, createSDCard, createEarphones, createCells18650,
  createResistor, createJumperWires, createLDRModule, createTactileButton, createLED5mm,
} from '../../js/models/modules.js';
import { SonarPulses, dustField, makeBeam } from '../../js/models/effects.js';
import { clamp, lerp, smooth, easeInOut } from '../../js/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** Différence d'angle la plus courte (pour interpoler l'azimut). */
function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Plan par défaut ; chaque diapositive en surcharge une partie. */
export const DEFAULT_SHOT = {
  subject: 'glasses', // 'glasses' | 'component'
  explode: 0, // 0 assemblé → 1 éclaté
  az: 0.55, el: 0.18, dist: 3.2, ty: -0.05, // caméra (sphérique autour de (0, ty, 0))
  shift: 0, // décalage horizontal de l'image (fraction de largeur, + = sujet à droite)
  drift: 0.06, // rotation lente automatique (rad/s)
  leds: 0, sonar: false, tcs: 0.35,
  interactive: false, labels: false,
};

export class Showroom {
  constructor(engine, labelLayer) {
    this.engine = engine;
    this.labels = new LabelSet(labelLayer);
    this.labels.root.hidden = false;
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.01, 60);
    this.bloom = { strength: 0.6, radius: 0.5, threshold: 1.0 };
    this.state = { ...DEFAULT_SHOT };
    this.goal = { ...DEFAULT_SHOT };
    this.focusTarget = null; // point visé lors d'un zoom sur une pièce
    this.flying = false;
    this.componentKey = null;
    this._v = new THREE.Vector3();
    this.build();
  }

  build() {
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = new THREE.Color('#050c1b');
    scene.fog = new THREE.Fog('#050c1b', 4.5, 11);
    scene.environment = this.engine.envMap;
    scene.environmentIntensity = 0.65;

    const hemi = new THREE.HemisphereLight('#cfe3ff', '#0a1220', 0.55);
    const key = new THREE.DirectionalLight('#fff6ec', 2.5);
    key.position.set(2, 3.2, 3);
    const rim = new THREE.DirectionalLight('#38d6ff', 2.6);
    rim.position.set(-3, 1.5, -2);
    const back = new THREE.DirectionalLight('#4d6dff', 1.3);
    back.position.set(2.5, 1, -3);
    scene.add(hemi, key, rim, back);

    // Socle : disque laqué, anneau lumineux, arc tournant, faisceau zénithal
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.3, 0.05, 128),
      new THREE.MeshPhysicalMaterial({ color: '#0a1528', roughness: 0.22, metalness: 0.7, clearcoat: 1, clearcoatRoughness: 0.08 })
    );
    ped.position.y = -0.95;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.006, 8, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2ee6f0').multiplyScalar(1.6), toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.922;
    this.arc = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.003, 8, 160, Math.PI * 1.4), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5aa9ff').multiplyScalar(1.3), toneMapped: false, transparent: true, opacity: 0.7 }));
    this.arc.rotation.x = Math.PI / 2;
    this.arc.position.y = -0.92;
    const top = makeBeam('#9fd0ff', 4, 1.35, V(0, -1, 0));
    top.position.y = 3.05;
    top.material.uniforms.uOpacity.value = 0.07;
    top.onBeforeRender = () => (top.material.uniforms.uTime.value = performance.now() / 1000);
    this.dust = dustField(320, [6, 3, 6]);
    this.dust.position.y = -1;
    scene.add(ped, ring, this.arc, top, this.dust);

    // ── Lunettes + électronique (modèle à l'échelle ×7 pour la lisibilité) ──
    const model = new THREE.Group();
    model.scale.setScalar(7);
    model.position.y = 0.1;
    scene.add(model);
    this.model = model;

    const gl = createGlasses({ withWires: false });
    this.glasses = gl;
    model.add(gl.group);
    const P = gl.parts;

    const esp = createESP32(), df = createDFPlayer(), sd = createSDCard(), bat = createCells18650(), ear = createEarphones();
    bat.scale.setScalar(0.85);
    model.add(esp, df, sd, bat, ear);
    // l'électronique (portée à part) n'apparaît que lorsque le modèle s'éclate
    this.electronics = [esp, df, sd, bat, ear];

    // [objet, position assemblée, position éclatée, rotation assemblée, rotation éclatée]
    const rot = (o) => V(o.rotation.x, o.rotation.y, o.rotation.z);
    this.items = [
      { obj: P.hc, a: P.hc.position.clone(), b: P.hc.position.clone().add(V(0, 0.035, 0.06)) },
      { obj: P.tcs, a: P.tcs.position.clone(), b: P.tcs.position.clone().add(V(0.03, -0.03, 0.04)) },
      { obj: P.button, a: P.button.position.clone(), b: P.button.position.clone().add(V(-0.022, 0.01, 0)) },
      { obj: P.ldr, a: P.ldr.position.clone(), b: P.ldr.position.clone().add(V(-0.01, 0.03, 0.01)) },
      { obj: P.ledL, a: P.ledL.position.clone(), b: P.ledL.position.clone().add(V(0.03, 0.02, 0.03)) },
      { obj: P.ledR, a: P.ledR.position.clone(), b: P.ledR.position.clone().add(V(-0.03, 0.02, 0.03)) },
      { obj: esp, a: V(-0.025, -0.096, -0.01), b: V(-0.085, -0.1, 0.035), rb: V(0.7, 0.25, 0) },
      { obj: df, a: V(0.038, -0.096, -0.012), b: V(-0.005, -0.112, 0.06), rb: V(0.8, 0, 0) },
      { obj: sd, a: V(0.038, -0.0935, -0.014), b: V(0.032, -0.085, 0.085), rb: V(0.9, -0.3, 0) },
      { obj: bat, a: V(0.0, -0.117, -0.01), b: V(0.085, -0.122, 0.035), rb: V(0.3, -0.25, 0) },
      { obj: ear, a: V(0.09, -0.095, -0.01), b: V(0.15, -0.055, 0.02), rb: V(0, -0.3, 0) },
    ];
    for (const it of this.items) {
      it.ra = rot(it.obj);
      it.rb = it.rb || it.ra.clone();
    }

    // Repères numérotés (diapositive « Vue 3D »)
    this.hotspots = [
      { key: 'hc', obj: P.hc, name: 'HC-SR04', off: [0, -70] },
      { key: 'tcs', obj: P.tcs, name: 'TCS3200', off: [-130, -20] },
      { key: 'button', obj: P.button, name: 'Bouton poussoir', off: [-120, 45] },
      { key: 'ldr', obj: P.ldr, name: 'LDR', off: [-150, -20] },
      { key: 'leds', obj: P.ledL, name: 'Deux LED', off: [80, -50], extra: P.ledR },
      { key: 'esp', obj: esp, name: 'ESP32', off: [-90, 60] },
      { key: 'df', obj: df, name: 'DFPlayer Mini', off: [-40, 80], extra: sd },
      { key: 'bat', obj: bat, name: 'Batterie', off: [90, 55] },
      { key: 'ear', obj: ear, name: 'Écouteurs', off: [-70, -70] },
    ];
    this.hotspots.forEach((h, i) => {
      h.label = this.labels.add(h.obj, `<i>${i + 1}</i>${h.name}`, { offset: h.off, cls: 'num' });
    });
    this.pinned = -1;

    // Ultrasons émis par le HC-SR04 (effet visuel, sans obstacle)
    this.sonar = new SonarPulses(scene, { start: 0, interval: 1.1, speed: 0.9, count: 12, echo: false });
    this.sonar.gain = 0.3;
    this.sonarT = 0;
    this._sonarTarget = new THREE.Vector3();

    // ── Composant isolé (diapositive « Étude du matériel ») ──
    this.spot = new THREE.Group();
    this.spot.position.y = 0.1;
    scene.add(this.spot);
    this.components = {};
    this.spotScale = 0;

    // ── Commandes à la souris (vues interactives) ──
    this.controls = new OrbitControls(this.camera, this.engine.canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.0;
    this.controls.maxDistance = 5;
    this.controls.enabled = false;
    this.controls.addEventListener('start', () => {
      this.flying = false; // l'utilisateur reprend la main
      this.userDrift = false;
    });
    this.applyCamera();
  }

  // ─────────────────────────── Plans de caméra ───────────────────────────

  /** Demande un nouveau plan (fusionné avec le plan par défaut). */
  setShot(shot) {
    this.goal = { ...DEFAULT_SHOT, ...shot };
    this.flying = true;
    this.userDrift = true;
    this.focusTarget = null;
    this.pinned = -1;
    this.controls.enabled = false;
    if (this.goal.subject === 'component' && !this.componentKey) this.showComponent('esp32');
  }

  /** Décalage d'image : laisse la place au panneau de texte. */
  applyShift(w, h) {
    const s = this.state.shift;
    if (Math.abs(s) > 1e-3) this.camera.setViewOffset(w, h, -s * w, 0, w, h);
    else this.camera.clearViewOffset();
  }

  /** Place la caméra à partir de l'état sphérique courant. */
  applyCamera() {
    const s = this.state;
    const tgt = this.camTarget();
    this.camera.position.set(
      tgt.x + Math.sin(s.az) * Math.cos(s.el) * s.dist,
      tgt.y + Math.sin(s.el) * s.dist,
      tgt.z + Math.cos(s.az) * Math.cos(s.el) * s.dist
    );
    this.camera.lookAt(tgt);
    this.controls.target.copy(tgt);
  }

  camTarget() {
    return this._tgt || (this._tgt = new THREE.Vector3(0, this.state.ty, 0));
  }

  /** Relit l'état sphérique depuis la caméra (après une manipulation à la souris). */
  readCamera() {
    const tgt = this.controls.target;
    const off = this.camera.position.clone().sub(tgt);
    this.state.dist = off.length();
    this.state.el = Math.asin(clamp(off.y / this.state.dist, -1, 1));
    this.state.az = Math.atan2(off.x, off.z);
    this.camTarget().copy(tgt);
  }

  // ───────────────────────── Interactions (Vue 3D) ─────────────────────────

  setExplode(v) {
    this.goal.explode = v;
  }
  setLeds(v) {
    this.goal.leds = v;
  }
  setSonar(on) {
    this.goal.sonar = on;
  }
  setAutoRotate(on) {
    this.goal.drift = on ? 0.12 : 0;
    this.userDrift = on;
  }

  /** Vol de caméra vers un repère (i ≥ 0) ou retour à la vue d'ensemble (i = −1). */
  focusHotspot(i) {
    this.pinned = i;
    this.flying = true;
    this.controls.enabled = false;
    if (i < 0) {
      this.focusTarget = null;
      this.goal.dist = this._homeDist ?? this.goal.dist;
      return;
    }
    this._homeDist ??= this.goal.dist;
    this.goal.explode = 1;
    const h = this.hotspots[i];
    const it = this.items.find((x) => x.obj === h.obj);
    const p = it.b.clone();
    this.model.updateMatrixWorld(true);
    p.applyMatrix4(h.obj.parent.matrixWorld);
    if (h.extra) {
      const it2 = this.items.find((x) => x.obj === h.extra);
      const p2 = it2.b.clone().applyMatrix4(h.extra.parent.matrixWorld);
      p.lerp(p2, 0.5);
    }
    this.focusTarget = p;
    this.goal.dist = h.key === 'leds' ? 2.3 : 1.75;
  }

  // ─────────────────────── Composant isolé (matériel) ───────────────────────

  /** Fabrique (une seule fois) le modèle d'un composant, normalisé en taille. */
  componentModel(key) {
    if (this.components[key]) return this.components[key];
    let obj;
    switch (key) {
      case 'esp32': obj = createESP32(); obj.rotation.x = 0.5; break;
      case 'hcsr04': obj = createHCSR04(); obj.rotation.x = -0.15; break;
      case 'tcs3200': obj = createTCS3200(); obj.rotation.x = -0.3; break;
      case 'ldr': obj = createLDRModule(); obj.rotation.x = 0.55; break;
      case 'led': obj = createLED5mm('#f4f7ff'); break;
      case 'bouton': obj = createTactileButton(); obj.rotation.x = 0.45; break;
      case 'resistances': {
        obj = new THREE.Group();
        const sets = [
          ['#d42a2a', '#d42a2a', '#7a4a1e', '#d8b25a'],
          ['#7a4a1e', '#15171b', '#d42a2a', '#d8b25a'],
          ['#e8871e', '#e8871e', '#7a4a1e', '#d8b25a'],
        ];
        sets.forEach((b, i) => {
          const r = createResistor(b);
          r.position.set(0, i * 0.0035 - 0.0035, i * 0.004 - 0.004);
          r.rotation.y = (i - 1) * 0.35;
          obj.add(r);
        });
        obj.rotation.x = 0.35;
        break;
      }
      case 'support': {
        const g = createGlasses({ withWires: false });
        const P = g.parts;
        // on retire les modules (et les faisceaux des LED) : il ne reste que la monture
        for (const p of [P.hc, P.tcs, P.ldr, P.ledL, P.ledR, P.button]) p.parent.remove(p);
        obj = g.group;
        obj.rotation.set(0.12, 0.65, 0);
        break;
      }
      case 'dfplayer': {
        obj = new THREE.Group();
        const d = createDFPlayer();
        const s = createSDCard();
        s.position.set(0, 0.0028, 0.006);
        obj.add(d, s);
        obj.rotation.x = 0.55;
        break;
      }
      case 'batterie': obj = createCells18650(); obj.rotation.x = 0.35; break;
      case 'fils': obj = createJumperWires(); obj.rotation.x = 0.4; break;
      case 'ecouteur': obj = createEarphones(); break;
      default: obj = new THREE.Group();
    }
    const holder = new THREE.Group();
    holder.add(obj);
    // normalisation : la plus grande dimension vaut ~0,8 unité
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const k = 0.8 / Math.max(size.x, size.y, size.z);
    obj.position.sub(c);
    holder.scale.setScalar(k);
    holder.userData.base = k;
    holder.traverse((o) => o.isMesh && !o.material.blending && (o.castShadow = true));
    holder.visible = false;
    this.spot.add(holder);
    this.components[key] = holder;
    return holder;
  }

  /** Affiche un composant sur le socle (fondu d'échelle avec l'ancien). */
  showComponent(key) {
    if (key === this.componentKey) return;
    this.prevKey = this.componentKey;
    this.componentKey = key;
    this.swapT = 0;
    this.componentModel(key);
    this.flying = true;
    this.goal.az = this.state.az; // conserve l'angle courant
  }

  // ──────────────────────────────── Image ────────────────────────────────

  update(t, dt, clock, realDt) {
    const g = this.goal, s = this.state;
    const step = realDt || 0.016;
    const k = 1 - Math.exp(-step * 3.2);

    // explosion, LED, décalage : interpolation douce
    s.explode = lerp(s.explode, g.explode, 1 - Math.exp(-step * 2.6));
    s.leds = lerp(s.leds, g.leds, 1 - Math.exp(-step * 6));
    const oldShift = s.shift;
    s.shift = lerp(s.shift, g.shift, k);
    if (Math.abs(s.shift - oldShift) > 1e-4) this.engine.fitCamera(this.camera);

    // sujet : lunettes visibles, ou composant isolé
    const showGlasses = g.subject === 'glasses';
    this.model.visible = showGlasses || this.modelFade > 0.02;
    this.modelFade = lerp(this.modelFade ?? 1, showGlasses ? 1 : 0, 1 - Math.exp(-step * 7));
    this.model.scale.setScalar(7 * (0.6 + 0.4 * this.modelFade));
    this.model.visible = this.modelFade > 0.02;
    this.spot.visible = !showGlasses || this.spotScale > 0.02;
    this.spotScale = lerp(this.spotScale, showGlasses ? 0 : 1, 1 - Math.exp(-step * 7));
    this.updateComponents(step, clock);

    // éclatement des pièces
    const e = easeInOut(clamp(s.explode));
    for (const it of this.items) {
      it.obj.position.lerpVectors(it.a, it.b, e);
      it.obj.rotation.set(lerp(it.ra.x, it.rb.x, e), lerp(it.ra.y, it.rb.y, e), lerp(it.ra.z, it.rb.z, e));
    }
    const eg = smooth(0.05, 0.6, s.explode);
    for (const o of this.electronics) {
      o.visible = eg > 0.01;
      o.scale.setScalar(Math.max(0.001, eg) * (o.userData.s0 ?? (o.userData.s0 = o.scale.x)));
    }
    this.model.position.y = 0.1 + Math.sin(clock * 0.8) * 0.015;
    this.glasses.api.setLeds(s.leds);
    this.glasses.api.setTcsLight(g.tcs * (0.6 + 0.4 * Math.sin(clock * 2)));
    this.dust.update(clock);
    this.arc.rotation.z = clock * 0.25;

    // surbrillance du repère choisi
    this.hotspots.forEach((h, i) => {
      const v = this.pinned === i ? 0.3 + 0.2 * Math.sin(clock * 5) : 0;
      this.glasses.api.glowPart(h.obj, v);
      if (h.extra) this.glasses.api.glowPart(h.extra, v);
    });

    // ultrasons
    if (g.sonar && showGlasses) this.sonarT += step;
    else this.sonarT = -10;
    const hc = this.glasses.parts.hc;
    hc.getWorldPosition(this._sonarTarget);
    // portée courte : les ondes restent autour des lunettes et ne recouvrent pas le texte
    this._sonarTarget.add(this._v.set(0, 0, 1).applyQuaternion(this.model.quaternion).multiplyScalar(0.62));
    this.sonar.update(this.sonarT, hc, this._sonarTarget);

    // caméra : vol vers le plan demandé, puis dérive lente ou contrôle à la souris
    const tgt = this.camTarget();
    const goalTgt = this.focusTarget || this._v.set(0, g.ty, 0);
    if (this.flying) {
      s.az += angleDelta(s.az, g.az) * k;
      s.el = lerp(s.el, g.el, k);
      s.dist = lerp(s.dist, g.dist, k);
      tgt.lerp(goalTgt, k);
      const done = Math.abs(angleDelta(s.az, g.az)) < 0.004 && Math.abs(s.dist - g.dist) < 0.004 && tgt.distanceTo(goalTgt) < 0.003;
      if (done) {
        this.flying = false;
        this.controls.enabled = g.interactive;
      }
      this.applyCamera();
    } else if (this.controls.enabled) {
      this.controls.autoRotate = this.userDrift && g.drift > 0;
      this.controls.autoRotateSpeed = g.drift * 10;
      this.controls.update(step);
      this.readCamera();
    } else {
      s.az += g.drift * step;
      g.az = s.az;
      this.applyCamera();
    }

    // étiquettes numérotées (seulement sur la vue 3D, quand le modèle est éclaté)
    const lv = g.labels && showGlasses ? smooth(0.45, 0.9, e) : 0;
    this.hotspots.forEach((h, i) => {
      h.label.opacity = lv * (this.pinned < 0 || this.pinned === i ? 1 : 0.3);
    });
    this.labels.update(this.engine);
  }

  /** Animation des composants isolés : fondu d'échelle, rotation, effets propres. */
  updateComponents(step, clock) {
    this.swapT = (this.swapT ?? 1) + step;
    for (const [key, h] of Object.entries(this.components)) {
      const isCur = key === this.componentKey;
      const isPrev = key === this.prevKey;
      let f = 0;
      if (isCur) f = smooth(0.15, 0.75, this.swapT);
      else if (isPrev) f = 1 - smooth(0, 0.3, this.swapT);
      f *= this.spotScale;
      h.visible = f > 0.01;
      if (!h.visible) continue;
      // léger rebond à l'apparition
      const pop = isCur ? 1 + 0.06 * Math.sin(Math.min(1, this.swapT / 0.75) * Math.PI) : 1;
      h.scale.setScalar(h.userData.base * Math.max(0.001, f) * pop);
      h.rotation.y = clock * 0.35;
      h.position.y = Math.sin(clock * 0.9) * 0.02;
      // effets propres à certains composants
      if (key === 'led') {
        const m = h.children[0].userData.mat;
        m.emissiveIntensity = 0.5 + 0.7 * (0.5 + 0.5 * Math.sin(clock * 2.4));
      }
      if (key === 'bouton') {
        const cap = h.children[0].userData.cap;
        cap.position.y = 0.0042 - 0.0012 * Math.max(0, Math.sin(clock * 2.2)) ** 8;
      }
      if (key === 'tcs3200') h.children[0].userData.ledMat.emissiveIntensity = 2 + Math.sin(clock * 3);
    }
  }
}

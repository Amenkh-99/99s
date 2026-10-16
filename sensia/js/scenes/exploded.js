// Diapositive 3 : vue éclatée technique (modèle illustratif, positions conceptuelles).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { View } from './base.js';
import { createGlasses } from '../models/glasses.js';
import { createESP32, createDFPlayer, createSDCard, createBattery, createEarphones } from '../models/modules.js';
import { dustField } from '../models/effects.js';
import { smooth, lerp, easeInOut } from '../util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class ExplodedView extends View {
  constructor(app) {
    super(app);
    this.duration = 16;
    this.loop = true;
    this.mode = 'auto'; // 'auto' | 'open' | 'closed'
    this.e = 0;
    this.focus = -1;
    this.bloom = { strength: 0.5, radius: 0.5, threshold: 0.9 };
  }

  build() {
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = new THREE.Color('#06101f');
    scene.environment = this.engine.envMap;
    scene.environmentIntensity = 0.8;
    scene.fog = new THREE.Fog('#06101f', 4, 10);
    const hemi = new THREE.HemisphereLight('#cfe3ff', '#0a1220', 0.7);
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(2, 3, 3);
    const rim = new THREE.DirectionalLight('#38d6ff', 2);
    rim.position.set(-3, 1.5, -2);
    scene.add(hemi, key, rim);

    // socle lumineux
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.3, 0.04, 96), new THREE.MeshStandardMaterial({ color: '#0d1a2e', roughness: 0.4, metalness: 0.6 }));
    ped.position.y = -0.95;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.006, 8, 128), new THREE.MeshBasicMaterial({ color: '#2ee6f0', toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.93;
    this.dust = dustField(260, [5, 3, 5]);
    this.dust.position.y = -1;
    scene.add(ped, ring, this.dust);

    // Modèle à l'échelle ×7 pour la lisibilité
    const model = new THREE.Group();
    model.scale.setScalar(7);
    model.position.y = 0.1;
    scene.add(model);
    this.model = model;

    const gl = createGlasses({ withWires: false });
    this.glasses = gl;
    model.add(gl.group);
    gl.api.setLeds(0);
    const P = gl.parts;

    // boîtier électronique (translucide quand assemblé)
    const box = new THREE.Mesh(
      new RoundedBoxGeometry(0.13, 0.045, 0.05, 4, 0.008),
      new THREE.MeshPhysicalMaterial({ color: '#7fb4ff', transparent: true, opacity: 0.25, roughness: 0.2, depthWrite: false })
    );
    box.position.set(0, -0.1, -0.01);
    model.add(box);
    this.box = box;

    const esp = createESP32(), df = createDFPlayer(), sd = createSDCard(), bat = createBattery(), ear = createEarphones();
    model.add(esp, df, sd, bat, ear);

    // [objet, position assemblée, position éclatée, rotation éclatée]
    const items = [
      { obj: P.hc, a: P.hc.position.clone(), b: P.hc.position.clone().add(V(0, 0.035, 0.06)) },
      { obj: P.tcs, a: P.tcs.position.clone(), b: P.tcs.position.clone().add(V(0.03, -0.03, 0.04)) },
      { obj: P.button, a: P.button.position.clone(), b: P.button.position.clone().add(V(-0.022, 0.01, 0)) },
      { obj: P.ldr, a: P.ldr.position.clone(), b: P.ldr.position.clone().add(V(-0.01, 0.03, 0.01)) },
      { obj: P.ledL, a: P.ledL.position.clone(), b: P.ledL.position.clone().add(V(0.03, 0.02, 0.03)) },
      { obj: P.ledR, a: P.ledR.position.clone(), b: P.ledR.position.clone().add(V(-0.03, 0.02, 0.03)) },
      { obj: esp, a: V(-0.025, -0.096, -0.01), b: V(-0.085, -0.1, 0.035), ra: V(0, 0, 0), rb: V(0.7, 0.25, 0) },
      { obj: df, a: V(0.038, -0.096, -0.012), b: V(-0.005, -0.112, 0.06), ra: V(0, 0, 0), rb: V(0.8, 0, 0) },
      { obj: sd, a: V(0.038, -0.0935, -0.014), b: V(0.032, -0.085, 0.085), ra: V(0, 0, 0), rb: V(0.9, -0.3, 0) },
      { obj: bat, a: V(0.0, -0.113, -0.01), b: V(0.085, -0.122, 0.035), ra: V(0, 0, 0), rb: V(0.3, -0.25, 0) },
      { obj: ear, a: V(0.09, -0.095, -0.01), b: V(0.15, -0.055, 0.02), ra: V(0, 0, 0), rb: V(0, -0.3, 0) },
    ];
    items.forEach((it) => {
      it.ra = it.ra || it.obj.rotation.toVector3?.() || V(it.obj.rotation.x, it.obj.rotation.y, it.obj.rotation.z);
      if (!it.rb) it.rb = it.ra.clone();
    });
    this.items = items;

    // légende : n° → objets concernés
    this.legend = [
      [P.hc], [P.tcs], [P.button], [P.ldr], [P.ledL, P.ledR], [esp], [df], [sd], [ear], [bat],
    ];
    const names = ['HC-SR04', 'TCS3200', 'Bouton poussoir', 'LDR', 'Deux LED', 'ESP32', 'DFPlayer Mini', 'Carte mémoire', 'Écouteurs', 'Batterie'];
    const offs = [[0, -70], [-130, -20], [-120, 45], [-150, -20], [80, -50], [-90, 60], [-40, 80], [60, -60], [-70, -70], [90, 55]];
    this.lbls = [];
    this.legend.forEach((objs, i) => {
      this.lbls.push(this.labels.add(objs[0], `<i>${i + 1}</i>${names[i]}`, { offset: offs[i], cls: 'num' }));
    });
    this.lbls.push(this.labels.add(P.ledR, `<i>5</i>Deux LED`, { offset: [-80, -50], cls: 'num' }));

    this.camera.position.set(0.7, 0.5, 3.3);
    this.controls = new OrbitControls(this.camera, this.engine.canvas);
    this.controls.target.set(0, -0.28, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 4;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.7;
    this.controls.enabled = false;
    this.controls.addEventListener('start', () => (this.controls.autoRotate = false));
  }

  enter() {
    super.enter();
    this.controls.enabled = true;
  }
  exit() {
    super.exit();
    this.controls.enabled = false;
  }

  setMode(m) {
    this.mode = m;
  }

  setAutoRotate(on) {
    this.controls.autoRotate = on;
  }

  /** Surbrillance d'une entrée de légende (−1 = aucune). */
  highlight(i) {
    this.focus = i;
  }

  update(t, dt, clock, realDt = dt) {
    let target;
    if (this.mode === 'auto') target = smooth(1, 4, t) * (1 - smooth(11.5, 14.5, t));
    else target = this.mode === 'open' ? 1 : 0;
    // en mode automatique l'éclatement suit la timeline ; sinon il s'anime même en pause
    this.e = this.mode === 'auto' ? target : lerp(this.e, target, 1 - Math.exp(-realDt * 3));
    const e = easeInOut(Math.min(1, Math.max(0, this.e)));

    for (const it of this.items) {
      it.obj.position.lerpVectors(it.a, it.b, e);
      it.obj.rotation.set(lerp(it.ra.x, it.rb.x, e), lerp(it.ra.y, it.rb.y, e), lerp(it.ra.z, it.rb.z, e));
    }
    this.box.material.opacity = 0.25 * (1 - e);
    this.box.visible = e < 0.98;
    this.model.position.y = 0.1 + Math.sin(clock * 0.8) * 0.015;
    this.dust.update(clock);

    // petite animation des LED pour les rendre visibles
    this.glasses.api.setTcsLight(0.3 + 0.2 * Math.sin(clock * 2));
    this.legend.forEach((objs, i) => {
      const v = this.focus === i ? 0.6 + 0.4 * Math.sin(clock * 6) : 0;
      objs.forEach((o) => this.glasses.api.glowPart(o, v));
    });

    const lv = smooth(0.45, 0.85, e);
    this.lbls.forEach((l, i) => {
      const idx = i < 10 ? i : 4;
      l.opacity = lv * (this.focus < 0 || this.focus === idx ? 1 : 0.35);
    });
    this.labels.update(this.engine);
    this.controls.update(realDt);
  }
}

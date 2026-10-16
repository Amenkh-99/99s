// Diapositive 3 : vue éclatée technique (modèle illustratif, positions conceptuelles).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { View } from './base.js';
import { createGlasses } from '../models/glasses.js';
import { createESP32, createDFPlayer, createSDCard, createBattery, createEarphones } from '../models/modules.js';
import { dustField, makeBeam } from '../models/effects.js';
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
    this.bloom = { strength: 0.55, radius: 0.5, threshold: 1.0 };
  }

  build() {
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = new THREE.Color('#06101f');
    scene.environment = this.engine.envMap;
    scene.environmentIntensity = 0.6;
    scene.fog = new THREE.Fog('#06101f', 4, 10);
    const hemi = new THREE.HemisphereLight('#cfe3ff', '#0a1220', 0.7);
    const key = new THREE.DirectionalLight('#fff6ec', 2.4);
    key.position.set(2, 3, 3);
    const rim = new THREE.DirectionalLight('#38d6ff', 2.6);
    rim.position.set(-3, 1.5, -2);
    const back = new THREE.DirectionalLight('#5b7cff', 1.2);
    back.position.set(2.5, 1, -3);
    scene.add(hemi, key, rim, back);

    // socle de présentation : disque laqué, double anneau lumineux, faisceau zénithal
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.3, 0.05, 128),
      new THREE.MeshPhysicalMaterial({ color: '#0b1628', roughness: 0.18, metalness: 0.7, clearcoat: 1, clearcoatRoughness: 0.08 })
    );
    ped.position.y = -0.95;
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#2ee6f0').multiplyScalar(1.6), toneMapped: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.006, 8, 160), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.922;
    this.ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.003, 8, 160, Math.PI * 1.4), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5aa9ff').multiplyScalar(1.3), toneMapped: false, transparent: true, opacity: 0.7 }));
    this.ring2.rotation.x = Math.PI / 2;
    this.ring2.position.y = -0.92;
    const top = makeBeam('#9fd0ff', 4, 1.35, new THREE.Vector3(0, -1, 0));
    top.position.y = 3.05;
    top.material.uniforms.uOpacity.value = 0.07;
    top.onBeforeRender = () => (top.material.uniforms.uTime.value = performance.now() / 1000);
    this.dust = dustField(260, [5, 3, 5]);
    this.dust.position.y = -1;
    scene.add(ped, ring, this.ring2, top, this.dust);

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

    this.camera.position.set(0.75, 0.55, 3.35);
    this.controls = new OrbitControls(this.camera, this.engine.canvas);
    this.controls.target.set(0, -0.28, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 4;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.7;
    this.controls.enabled = false;
    this.controls.addEventListener('start', () => {
      this.controls.autoRotate = false;
      this.fly = null; // l'utilisateur reprend la main
    });
    this.home = { target: new THREE.Vector3(0, -0.28, 0), dist: 3.4 };
    this.pinned = -1;
    this.fly = null;
  }

  /**
   * Vol de caméra fluide vers une pièce de la légende (i ≥ 0),
   * ou retour à la vue d'ensemble (i = −1).
   */
  focusOn(i) {
    this.pinned = i;
    if (i < 0) {
      this.fly = { target: this.home.target.clone(), dist: this.home.dist };
      this.controls.autoRotate = true;
      return;
    }
    if (this.mode !== 'open') this.mode = 'open';
    const objs = this.legend[i];
    const p = new THREE.Vector3();
    // position éclatée finale de la pièce (pas sa position courante)
    const it = this.items.find((x) => x.obj === objs[0]);
    if (it) p.copy(it.b).applyMatrix4(objs[0].parent.matrixWorld);
    else objs[0].getWorldPosition(p);
    if (objs.length > 1) p.set(0, p.y, p.z); // les deux LED : vue centrée
    this.fly = { target: p, dist: objs.length > 1 ? 1.9 : 1.25 };
    this.controls.autoRotate = false;
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
      const f = this.focus >= 0 ? this.focus : this.pinned;
      const v = f === i ? 0.6 + 0.4 * Math.sin(clock * 6) : 0;
      objs.forEach((o) => this.glasses.api.glowPart(o, v));
    });

    const lv = smooth(0.45, 0.85, e);
    this.lbls.forEach((l, i) => {
      const idx = i < 10 ? i : 4;
      const f = this.focus >= 0 ? this.focus : this.pinned;
      l.opacity = lv * (f < 0 || f === idx ? 1 : 0.3);
    });
    this.labels.update(this.engine);
    this.ring2.rotation.z = clock * 0.25;

    // interpolation douce (exponentielle) de la cible et de la distance de caméra
    if (this.fly) {
      const k = 1 - Math.exp(-(realDt || 0.016) * 3.2);
      const c = this.controls;
      c.target.lerp(this.fly.target, k);
      const off = this.camera.position.clone().sub(c.target);
      const d = THREE.MathUtils.lerp(off.length(), this.fly.dist, k);
      this.camera.position.copy(c.target).addScaledVector(off.normalize(), d);
      if (c.target.distanceTo(this.fly.target) < 0.002 && Math.abs(d - this.fly.dist) < 0.005) this.fly = null;
    }
    this.controls.update(realDt);
  }
}

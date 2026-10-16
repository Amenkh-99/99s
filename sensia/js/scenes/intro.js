// Diapositive 1 : une personne malvoyante porte SENSIA.
// Plan large → gros plan sur les lunettes avec étiquettes → retour.
// Un encart montre une perception floue de l'environnement (illustration).
import * as THREE from 'three';
import { View } from './base.js';
import { createStage, createChair, createCardboardBox, createPlant } from '../models/props.js';
import { createPerson } from '../models/person.js';
import { dustField, makeBeam } from '../models/effects.js';
import { smooth, lerp, easeInOut, windowed } from '../util.js';

export class IntroView extends View {
  constructor(app) {
    super(app);
    this.duration = 26;
    this.loop = true;
    this.shift = 0.17;
    this.subjective = true;
  }

  build() {
    const { scene } = createStage({ env: this.engine.envMap });
    this.scene = scene;
    const p = createPerson({ cane: true });
    this.person = p;
    scene.add(p.root);
    p.armFK(-1, -0.25, 0.08, 0.35);

    const chair = createChair();
    chair.position.set(0.75, 0, 2.3);
    chair.rotation.y = -0.6;
    const box = createCardboardBox();
    box.position.set(-0.55, 0, 2.7);
    box.rotation.y = 0.3;
    const plant = createPlant();
    plant.position.set(1.4, 0, 3.4);
    this.dust = dustField(300, [8, 3, 8]);
    // douche de lumière zénithale sur le personnage (ambiance studio)
    const top = makeBeam('#9fd0ff', 4.6, 1.05, new THREE.Vector3(0, -1, 0));
    top.position.y = 4.6;
    top.material.uniforms.uOpacity.value = 0.06;
    top.onBeforeRender = () => (top.material.uniforms.uTime.value = performance.now() / 1000);
    scene.add(chair, box, plant, this.dust, top);

    // Caméra "subjective" (œil de la personne) pour l'encart
    this.eyeCam = new THREE.PerspectiveCamera(62, 380 / 220, 0.05, 30);
    p.head.add(this.eyeCam);
    this.eyeCam.position.set(0, 0.01, 0.1);
    this.eyeCam.rotation.set(0.22, Math.PI, 0); // regarde vers l'avant, légèrement vers le bas

    const g = p.glasses.parts;
    const L = (obj, html, off, local) => this.labels.add(obj, html, { offset: off, local });
    this.partLabels = [
      L(g.hc, '<b>HC-SR04</b> capteur à ultrasons', [30, -165]),
      L(g.ldr, '<b>LDR</b> luminosité', [-170, -110]),
      L(g.ledL, '<b>LED</b> gauche', [150, -80]),
      L(g.ledR, '<b>LED</b> droite', [-190, -10]),
      L(g.tcs, '<b>TCS3200</b> couleur', [150, 70]),
      L(g.button, '<b>Bouton</b> poussoir', [-170, 90]),
      L(p.buds[1], '<b>Écouteurs</b>', [160, 10]),
    ];
    this.boxLabel = L(p.box, '<b>Boîtier</b><br>ESP32 · DFPlayer Mini · batterie<br><small>position illustrative</small>', [110, -90]);
    this.caneLabel = L(p.cane, '<b>Canne blanche</b><br><small>SENSIA la complète</small>', [-170, 40], new THREE.Vector3(0, -0.8, 0));
    this.target = new THREE.Vector3();
  }

  enter() {
    super.enter();
    this.app.subjectiveEl.hidden = !this.subjective;
  }
  exit() {
    super.exit();
    this.app.subjectiveEl.hidden = true;
  }

  setSubjective(on) {
    this.subjective = on;
    this.app.subjectiveEl.hidden = !on;
  }

  update(t, dt, clock, realDt = dt) {
    const p = this.person;
    // respiration et léger mouvement de tête
    p.body.position.y = Math.sin(clock * 1.6) * 0.003;
    p.headPivot.rotation.y = Math.sin(clock * 0.35) * 0.06;
    this.dust.update(clock);

    // trajectoire de caméra (boucle continue)
    const wide = { r: 3.5, h: 1.5, ty: 1.05, az: 0.5 };
    const close = { r: 0.6, h: 1.68, ty: 1.645, az: 0.6 };
    let s, az;
    if (t < 5) { s = 0; az = wide.az; }
    else if (t < 9) { s = easeInOut((t - 5) / 4); az = lerp(wide.az, close.az, s); }
    else if (t < 21) { s = 1; az = 0.6 * Math.cos(((t - 9) / 12) * Math.PI); }
    else { s = 1 - easeInOut((t - 21) / 5); az = lerp(wide.az, -0.6, s); }
    const r = lerp(wide.r, close.r, s);
    const h = lerp(wide.h, close.h, s);
    this.target.set(0, lerp(wide.ty, close.ty, s), lerp(0, 0.06, s));
    this.camera.position.set(Math.sin(az) * r, h, Math.cos(az) * r);
    this.camera.lookAt(this.target);
    this.applyEntrance(realDt);

    const lv = windowed(t, 9, 10, 20.3, 21);
    this.partLabels.forEach((l, i) => (l.opacity = windowed(t, 9 + i * 0.35, 10 + i * 0.35, 20.3, 21) * lv));
    this.boxLabel.opacity = windowed(t, 0.6, 1.4, 4.2, 5) + windowed(t, 24.2, 25, 27, 28);
    this.caneLabel.opacity = this.boxLabel.opacity;
    this.labels.update(this.engine);

    // l'encart de perception s'efface pendant le gros plan sur les lunettes
    this.insetLevel = 1 - s;
    this.app.subjectiveEl.style.opacity = this.insetLevel.toFixed(2);
  }

  /** Encart "perception réduite" rendu dans un coin du canvas. */
  afterRender() {
    if (!this.subjective || this.insetLevel < 0.02) return;
    const e = this.engine, r = e.renderer;
    const w = 380, h = 220, x = e.width - w - 28, y = 28; // y depuis le bas
    r.setScissorTest(true);
    r.setScissor(x, y, w, h);
    r.setViewport(x, y, w, h);
    const fog = this.scene.fog.far;
    this.scene.fog.far = 9; // visibilité réduite (brouillard + flou CSS)
    this.scene.fog.near = 0.8;
    r.render(this.scene, this.eyeCam);
    this.scene.fog.far = fog;
    this.scene.fog.near = 6;
    r.setScissorTest(false);
    r.setViewport(0, 0, e.width, e.height);
  }
}

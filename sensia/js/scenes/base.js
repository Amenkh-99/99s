// Classe de base d'une vue 3D (une scène + une caméra + des étiquettes).
import * as THREE from 'three';
import { LabelSet } from '../engine.js';

const _fwd = new THREE.Vector3();

export class View {
  /**
   * @param {object} app  { engine, labelLayer, speak }
   */
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.built = false;
    this.duration = 10;
    this.loop = false;
    this.cues = [];
    this.bloom = { strength: 0.55, radius: 0.5, threshold: 1.0 };
    this.exposure = 1;
    this.shift = 0; // décalage horizontal de l'image (fraction de largeur)
  }

  ensureBuilt() {
    if (this.built) return;
    this.camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.01, 80);
    this.labels = new LabelSet(this.app.labelLayer);
    this.build();
    this.built = true;
  }

  build() {}
  enter() {
    this.labels.root.hidden = false;
    this.enterStart = performance.now();
  }

  /**
   * Travelling d'entrée : juste après le changement de diapositive, la caméra
   * part un peu en retrait et glisse vers son cadrage (courbe douce).
   * À appeler après avoir placé la caméra et avant la mise à jour des étiquettes.
   */
  applyEntrance() {
    const elapsed = (performance.now() - (this.enterStart ?? -1e9)) / 1000;
    const k = 1 - Math.min(1, elapsed / 1.6);
    if (k > 0) {
      const e = k * k * (3 - 2 * k);
      this.camera.getWorldDirection(_fwd);
      this.camera.position.addScaledVector(_fwd, -0.55 * e);
      this.camera.position.y += 0.12 * e;
    }
    this.camera.updateMatrixWorld();
  }
  exit() {
    this.labels.root.hidden = true;
  }
  /**
   * t : temps de la timeline (s), dt : pas de la timeline (0 en pause),
   * clock : horloge d'animation (s), realDt : pas réel (interactions en pause)
   */
  update(t, dt, clock, realDt) {}
  afterRender() {}

  /** Applique le décalage d'image pour laisser la place au panneau de texte. */
  applyShift(w, h) {
    if (this.shift) this.camera.setViewOffset(w, h, -this.shift * w, 0, w, h);
    else this.camera.clearViewOffset();
  }
}

/** Positionne une bulle HTML au-dessus d'un point 3D. */
export function placeBubble(engine, el, world, show) {
  const p = engine.project(world);
  el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
  el.classList.toggle('show', !!show && p.visible);
}

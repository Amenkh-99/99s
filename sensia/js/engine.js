// Moteur 3D partagé : un seul renderer WebGL, un post-traitement (bloom),
// une carte d'environnement commune et un système d'étiquettes HTML
// projetées sur les objets 3D.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch (e) {
    return false;
  }
}

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Carte d'environnement "studio" générée localement (aucun fichier externe)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.6, 0.5, 0.85);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.width = 1;
    this.height = 1;
    this.active = null;
  }

  /** Taille en pixels "design" (la scène 16:9 est mise à l'échelle par CSS). */
  resize(w, h, scale) {
    this.width = Math.max(1, Math.round(w));
    this.height = Math.max(1, Math.round(h));
    const pr = Math.min(2, (window.devicePixelRatio || 1) * scale);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(this.width, this.height, true);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(this.width, this.height);
    if (this.active) this.fitCamera(this.active.camera);
  }

  fitCamera(camera) {
    camera.aspect = this.width / this.height;
    if (this.active && this.active.applyShift) this.active.applyShift(this.width, this.height);
    camera.updateProjectionMatrix();
  }

  setActive(view) {
    this.active = view;
    if (!view) return;
    this.renderPass.scene = view.scene;
    this.renderPass.camera = view.camera;
    const b = view.bloom || {};
    this.bloom.strength = b.strength ?? 0.6;
    this.bloom.radius = b.radius ?? 0.5;
    this.bloom.threshold = b.threshold ?? 0.85;
    this.renderer.toneMappingExposure = view.exposure ?? 1.0;
    this.fitCamera(view.camera);
  }

  render() {
    if (!this.active) return;
    this.composer.render();
  }

  /** Projette un point monde vers des coordonnées (px) du canvas. */
  project(v, camera = this.active?.camera) {
    const p = v.clone().project(camera);
    return {
      x: (p.x * 0.5 + 0.5) * this.width,
      y: (-p.y * 0.5 + 0.5) * this.height,
      visible: p.z < 1 && p.z > -1,
    };
  }
}

/**
 * Jeu d'étiquettes HTML attachées à des objets 3D.
 * Chaque vue possède son propre conteneur (affiché uniquement quand elle est active).
 */
export class LabelSet {
  constructor(layer) {
    this.root = document.createElement('div');
    this.root.className = 'labelset';
    this.root.hidden = true;
    layer.appendChild(this.root);
    this.items = [];
    this._v = new THREE.Vector3();
  }

  /**
   * @param {THREE.Object3D} target objet suivi
   * @param {string} html contenu de l'étiquette
   * @param {object} o  { offset:[dx,dy] en px, local:Vector3, cls }
   */
  add(target, html, o = {}) {
    const el = document.createElement('div');
    el.className = 'label3d ' + (o.cls || '');
    el.innerHTML = `<span class="label3d-dot"></span><span class="label3d-line"></span><span class="label3d-text">${html}</span>`;
    this.root.appendChild(el);
    const item = { el, target, local: o.local || new THREE.Vector3(), offset: o.offset || [40, -40], opacity: 0, show: true };
    this.setOffset(item, item.offset);
    this.items.push(item);
    return item;
  }

  /** Place le texte à (dx, dy) du point et trace le trait de rappel. */
  setOffset(item, [dx, dy]) {
    item.offset = [dx, dy];
    const line = item.el.querySelector('.label3d-line');
    const text = item.el.querySelector('.label3d-text');
    line.style.width = Math.hypot(dx, dy) + 'px';
    line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    text.style.left = dx + 'px';
    text.style.top = dy + 'px';
    item.el.classList.toggle('left', dx < 0);
  }

  update(engine) {
    for (const it of this.items) {
      this._v.copy(it.local);
      it.target.localToWorld(this._v);
      const p = engine.project(this._v);
      const show = it.show && p.visible;
      it.el.style.opacity = show ? it.opacity : 0;
      it.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    }
  }
}

// Moteur 3D partagé : un seul renderer WebGL, un post-traitement
// cinématographique (MSAA, bloom subtil, vignette, grain, aberration
// chromatique légère), une carte d'environnement "studio" générée
// localement, une qualité adaptative et des étiquettes HTML projetées.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch (e) {
    return false;
  }
}

/**
 * Studio photo virtuel : dôme sombre bleu nuit + boîtes à lumière.
 * Converti en carte d'environnement préfiltrée (PMREM) pour des reflets
 * spéculaires réalistes sur les verres, le titane et les circuits.
 */
function createStudioEnvironment() {
  const scene = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 top = vec3(0.10, 0.14, 0.22), mid = vec3(0.025, 0.04, 0.07), low = vec3(0.01, 0.012, 0.02);
          vec3 c = h > 0.0 ? mix(mid, top, h) : mix(mid, low, -h);
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  scene.add(dome);
  const panel = (w, h, color, k, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    scene.add(m);
  };
  panel(6, 4, '#ffffff', 3.2, [0, 7, 1], [0, 0, 0]); // boîte à lumière principale (au-dessus)
  panel(2.5, 6, '#fff4e6', 1.6, [6, 2, 3], [0, 1, 0]); // lumière d'appoint chaude
  panel(0.8, 7, '#2ee6f0', 2.4, [-6.5, 2, -2], [0, 1, 0]); // contre-jour cyan
  panel(0.6, 6, '#3d7bff', 1.8, [3, 2, -7], [0, 1, 0]); // liseré bleu arrière
  panel(10, 1.2, '#9fc4ff', 0.6, [0, -1.5, 6], [0, 0, 0]); // réflecteur bas
  return scene;
}

/** Écrêtage HDR avant le bloom : évite les halos géants dus aux reflets ponctuels. */
const ClampShader = {
  uniforms: { tDiffuse: { value: null }, uMax: { value: 7.0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uMax; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float m = max(c.r, max(c.g, c.b)); c.rgb *= m > uMax ? uMax / m : 1.0; gl_FragColor = c; }`,
};

/** Étalonnage final : vignette, grain fin et aberration chromatique sur les bords. */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.32 }, uGrain: { value: 0.028 }, uCA: { value: 0.0016 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uCA;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * uCA * (0.4 + r2 * 4.0);
      vec3 c;
      c.r = texture2D(tDiffuse, vUv + off).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv - off).b;
      c *= 1.0 - uVignette * smoothstep(0.08, 0.62, r2 * 1.6);
      c += (hash(vUv * 1024.0 + uTime) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/** Paliers de qualité : résolution interne et anticrénelage MSAA. */
export const TIERS = [
  { res: 1, msaa: 4 },
  { res: 0.8, msaa: 4 },
  { res: 0.66, msaa: 0 },
  { res: 0.52, msaa: 0 },
];

export class Engine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} o { tier: palier de départ (0 = haute qualité), adaptive: ajustement automatique }
   */
  constructor(canvas, { tier = 0, adaptive = true } = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // + shadow.radius → ombres douces
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(createStudioEnvironment(), 0.035).texture;
    pmrem.dispose();

    // Rendu HDR multi-échantillonné (MSAA ×4) pour des arêtes nettes
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.45, 0.9);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(new ShaderPass(ClampShader));
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.grade);

    this.width = 1;
    this.height = 1;
    this.scale = 1;
    this.tier = 0;
    this.quality = 1; // facteur de résolution (palier courant)
    this.adaptive = adaptive;
    this._acc = 0;
    this._n = 0;
    this._grace = 1.5;
    this.active = null;
    this.setTier(tier);
  }

  /** Taille en pixels "design" (la scène 16:9 est mise à l'échelle par CSS). */
  resize(w, h, scale = this.scale) {
    this.width = Math.max(1, Math.round(w));
    this.height = Math.max(1, Math.round(h));
    this.scale = scale;
    const pr = Math.min(2, (window.devicePixelRatio || 1) * scale) * this.quality;
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
    this.bloom.strength = b.strength ?? 0.5;
    this.bloom.radius = b.radius ?? 0.45;
    this.bloom.threshold = b.threshold ?? 0.9;
    this.renderer.toneMappingExposure = view.exposure ?? 1.0;
    this._grace = 1.5;
    this._acc = this._n = 0;
    this.fitCamera(view.camera);
  }

  /** Applique un palier de qualité (résolution + MSAA). */
  setTier(i) {
    this.tier = Math.max(0, Math.min(TIERS.length - 1, i));
    const t = TIERS[this.tier];
    this.quality = t.res;
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (rt.samples !== t.msaa) {
        rt.samples = t.msaa;
        rt.dispose(); // recréé automatiquement au prochain rendu
      }
    }
    this.resize(this.width, this.height);
  }

  /**
   * Qualité adaptative : mesure la durée moyenne des images sur ~1,2 s.
   * Au-dessous de ~30 images/s, on descend d'un palier ; si la machine est
   * très à l'aise (> ~70 images/s), on remonte. Les 1,5 s qui suivent un
   * changement de scène sont ignorées (compilation des shaders).
   */
  adapt(realDt) {
    if (!this.adaptive || !realDt) return;
    if (this._grace > 0) {
      this._grace -= realDt;
      return;
    }
    this._acc += realDt;
    this._n++;
    if (this._acc < 1.2) return;
    const avg = this._acc / this._n;
    this._acc = 0;
    this._n = 0;
    if (avg > 0.034 && this.tier < TIERS.length - 1) this.setTier(this.tier + 1);
    else if (avg < 0.014 && this.tier > 0) this.setTier(this.tier - 1);
    this._grace = 0.6;
  }

  render(time = 0) {
    if (!this.active) return;
    this.grade.uniforms.uTime.value = time % 100;
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
      const op = show ? it.opacity : 0;
      it.el.style.opacity = op.toFixed(3);
      it.el.style.setProperty('--reveal', op.toFixed(3));
      it.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    }
  }
}

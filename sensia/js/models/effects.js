// Effets visuels : faisceaux volumétriques, ondes ultrasonores sphériques,
// ondes sonores, flux lumineux, faisceau étalonné du TCS3200, particules.
// Tous sont pilotés par le temps de la timeline (déterministes) : on peut
// rejouer ou sauter à une étape sans incohérence.
import * as THREE from 'three';
import { clamp, smooth, softDot } from '../util.js';

// Bruit de valeur 3D partagé par plusieurs shaders (scintillement, poussière lumineuse).
const NOISE_GLSL = /* glsl */ `
  float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 p){
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }`;

/** Faisceau conique volumétrique (LED, TCS3200) : dégradé, bords doux, particules en suspension. */
export function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vL;
      void main(){
        vUv = uv; vL = position;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vL;
      ${NOISE_GLSL}
      void main(){
        float along = pow(vUv.y, 1.6);                                  // intense près de la source
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.8);  // bords adoucis
        float motes = 0.75 + 0.5 * vnoise(vL * 38.0 + vec3(0.0, uTime * 0.6, 0.0));
        gl_FragColor = vec4(uColor, uOpacity * along * edge * motes);
      }`,
  });
}

/** Cône dont l'apex est à l'origine et qui s'étend dans la direction `dir`. */
export function makeBeam(color, length, radius, dir) {
  const g = new THREE.ConeGeometry(radius, length, 48, 1, true);
  g.translate(0, -length / 2, 0);
  const m = new THREE.Mesh(g, beamMaterial(color));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  m.renderOrder = 10;
  m.frustumCulled = false;
  return m;
}

/** Tache de lumière au sol (là où un faisceau touche une surface). */
export function lightPool(color = '#fff0cf', radius = 0.6) {
  const tex = new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return c;
  })());
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 9;
  return m;
}

/** Calotte sphérique (front d'onde) orientée vers +Z, rayon 1. */
function capGeometry(halfAngle) {
  const g = new THREE.SphereGeometry(1, 64, 16, 0, Math.PI * 2, 0, halfAngle);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Front d'onde : liseré brillant, voile fresnel et fines ondulations concentriques. */
function waveMaterial(color, halfAngle) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uHalf: { value: halfAngle }, uR: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){
        vP = position;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uHalf; uniform float uR;
      varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){
        float a = acos(clamp(normalize(vP).z, -1.0, 1.0)) / uHalf;     // 0 centre → 1 bord
        float rim = smoothstep(0.6, 0.97, a) * (1.0 - smoothstep(0.97, 1.0, a));
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        float ripple = 0.5 + 0.5 * sin(a * 26.0 - uR * 18.0);
        float body = (0.08 + 0.22 * fres) * (0.7 + 0.3 * ripple);
        vec3 col = mix(uColor, vec3(1.0), rim * 0.35);
        gl_FragColor = vec4(col, uOpacity * (body + 1.3 * rim));
      }`,
  });
}

/**
 * Ondes ultrasonores émises par le HC-SR04 et écho renvoyé par l'obstacle.
 * update(t, emitter, targetPoint) : `emitter` = Object3D du capteur,
 * `targetPoint` = point de la face de l'obstacle (monde).
 */
export class SonarPulses {
  constructor(scene, { count = 14, start = 3, interval = 0.9, speed = 1.5, outColor = '#2ee6f0', echoColor = '#b18cff', echo = true } = {}) {
    this.start = start;
    this.withEcho = echo;
    this.interval = interval;
    this.speed = speed;
    this.gain = 1;
    this.out = [];
    this.echo = [];
    const half = 0.4;
    const geo = capGeometry(half);
    for (let i = 0; i < count; i++) {
      for (const [list, col] of [[this.out, outColor], [this.echo, echoColor]]) {
        const shells = [];
        for (let k = 0; k < 3; k++) {
          const m = new THREE.Mesh(geo, waveMaterial(col, half));
          m.visible = false;
          m.renderOrder = 12;
          m.frustumCulled = false;
          scene.add(m);
          shells.push(m);
        }
        list.push(shells);
      }
    }
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this.enabledUntil = Infinity;
  }

  /** Renvoie true si un écho est en train d'atteindre le capteur. */
  update(t, emitter, targetPoint) {
    emitter.getWorldPosition(this._a);
    const b = targetPoint;
    const dist = this._a.distanceTo(b);
    const dir = this._b.subVectors(b, this._a).normalize();
    const back = dir.clone().negate();
    let receiving = false;
    this.out.forEach((shells, i) => {
      const t0 = this.start + i * this.interval;
      const age = t - t0;
      const echoShells = this.echo[i];
      const active = age >= 0 && t0 < this.enabledUntil;
      const r = age * this.speed;
      shells.forEach((m, k) => {
        const rk = r - k * 0.06;
        const vis = active && rk > 0.02 && rk < dist;
        m.visible = vis;
        if (!vis) return;
        m.position.copy(this._a);
        m.lookAt(this._a.clone().add(dir));
        m.scale.setScalar(rk);
        m.material.uniforms.uR.value = rk;
        m.material.uniforms.uOpacity.value = this.gain * (1 - k * 0.32) * (1 - 0.5 * (rk / dist)) * smooth(0.02, 0.14, rk) * (1 - smooth(dist - 0.08, dist, rk));
      });
      const r2 = r - dist;
      echoShells.forEach((m, k) => {
        const rk = r2 - k * 0.06;
        const vis = this.withEcho && active && rk > 0.02 && rk < dist;
        m.visible = vis;
        if (!vis) return;
        if (rk > dist - 0.15) receiving = true;
        m.position.copy(b);
        m.lookAt(b.clone().add(back));
        m.scale.setScalar(rk);
        m.material.uniforms.uR.value = rk;
        m.material.uniforms.uOpacity.value = this.gain * (1 - k * 0.32) * 0.8 * (1 - 0.4 * (rk / dist)) * smooth(0.02, 0.1, rk);
      });
    });
    return receiving;
  }

  hide() {
    [...this.out, ...this.echo].flat().forEach((m) => (m.visible = false));
  }
}

/** Volume de détection translucide du capteur (cône de mesure, visuel). */
export function detectionCone(length = 2.2, radius = 0.55, color = '#2ee6f0') {
  const g = new THREE.ConeGeometry(radius, length, 64, 1, true);
  g.translate(0, -length / 2, 0);
  g.rotateX(-Math.PI / 2); // l'axe pointe vers +z
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying float vZ;
      void main(){ vZ = position.z; vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vZ;
      void main(){
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
        float scan = 0.5 + 0.5 * sin(vZ * 30.0 - uTime * 6.0);
        float fade = 1.0 - smoothstep(${(length * 0.55).toFixed(2)}, ${length.toFixed(2)}, vZ);
        gl_FragColor = vec4(uColor, uOpacity * fade * (0.03 + fres * 0.35) * (0.75 + 0.25 * scan));
      }`,
  });
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 8;
  m.frustumCulled = false;
  return m;
}

/** Anneaux sonores qui partent d'un écouteur (message vocal diffusé). */
export class SoundRings {
  constructor(parent, axis = new THREE.Vector3(1, 0, 0), color = '#ffc14d', count = 4) {
    this.rings = [];
    const geo = new THREE.TorusGeometry(1, 0.04, 10, 64);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
      m.visible = false;
      m.frustumCulled = false;
      parent.add(m);
      this.rings.push(m);
    }
  }

  /** `level` 0..1 : intensité (0 = silence). */
  update(t, level, { period = 0.55, maxR = 0.065, offset = 0.012 } = {}) {
    this.rings.forEach((m, i) => {
      const ph = ((t / period + i / this.rings.length) % 1 + 1) % 1;
      m.visible = level > 0.01;
      const r = 0.006 + ph * maxR;
      m.scale.setScalar(r);
      m.position.copy(m.userData.base || (m.userData.base = m.position.clone()));
      m.position.addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(m.quaternion), offset + ph * 0.022);
      m.material.opacity = level * Math.pow(1 - ph, 1.4) * 0.95;
    });
  }
}

/** Matériau de flux : cœur lumineux + impulsions qui défilent (mesure, lumière réfléchie). */
export function flowMaterial(color, { dash = 18, speed = 1.2 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uTime: { value: 0 }, uDash: { value: dash }, uSpeed: { value: speed } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime; uniform float uDash; uniform float uSpeed;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float d = fract(vUv.x * uDash - uTime * uSpeed);
        float pulse = smoothstep(0.0, 0.2, d) * (1.0 - smoothstep(0.35, 0.7, d));
        float core = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
        vec3 col = mix(uColor, vec3(1.0), pulse * core * 0.45);
        gl_FragColor = vec4(col * 1.4, uOpacity * (0.2 + 0.8 * pulse) * (0.35 + 0.65 * core));
      }`,
  });
}

/** Ligne (tube) entre deux points, mise à jour à chaque image. */
export class FlowLine {
  constructor(scene, color, radius = 0.004, opts) {
    this.mat = flowMaterial(color, opts);
    this.radius = radius;
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), this.mat);
    // UV : on veut uv.x le long du segment → cylindre réorienté
    const g = this.mesh.geometry;
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 1 - uv.getY(i), uv.getX(i));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    scene.add(this.mesh);
  }

  set(a, b, opacity, time) {
    const len = a.distanceTo(b);
    this.mesh.visible = opacity > 0.01 && len > 1e-4;
    if (!this.mesh.visible) return;
    this.mesh.position.copy(a).add(b).multiplyScalar(0.5);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.mesh.scale.set(this.radius, len, this.radius);
    this.mat.uniforms.uOpacity.value = opacity;
    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uDash.value = Math.max(2, len * 22);
  }
}

/**
 * Anneau de calibrage du TCS3200 : balaie l'objet d'avant en arrière
 * pendant la mesure (lumière blanche étalonnée).
 */
export function scanRing(color = '#e8fbff') {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.035, 10, 96),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  m.frustumCulled = false;
  m.renderOrder = 13;
  return m;
}

/**
 * Trois flux de particules R, V, B de l'objet vers le capteur : leur intensité
 * illustre la part de chaque composante mesurée (valeurs illustratives).
 */
export class SpectrumStreams {
  constructor(scene, count = 36) {
    this.count = count;
    this.cols = ['#ff4040', '#3dff7a', '#4d8bff'];
    this.streams = this.cols.map((c, s) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({
        color: new THREE.Color(c).multiplyScalar(1.6), size: 0.012, map: softDot, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      p.frustumCulled = false;
      p.userData.phase = s * 0.33;
      scene.add(p);
      return p;
    });
    this._d = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  /** from → to, `levels` = [r, v, b] (0..1), `time` = horloge. */
  update(from, to, levels, time, opacity) {
    this._d.subVectors(to, from);
    const len = this._d.length();
    this._s.set(-this._d.y, this._d.x, 0).normalize();
    const side2 = new THREE.Vector3().crossVectors(this._d, this._s).normalize();
    this.streams.forEach((p, s) => {
      const arr = p.geometry.attributes.position.array;
      for (let i = 0; i < this.count; i++) {
        const f = ((time * 0.55 + i / this.count + p.userData.phase) % 1);
        const swirl = f * 9 + s * 2.1;
        const rad = 0.008 * (1 - f) + 0.002;
        arr[i * 3] = from.x + this._d.x * f + (this._s.x * Math.cos(swirl) + side2.x * Math.sin(swirl)) * rad;
        arr[i * 3 + 1] = from.y + this._d.y * f + (this._s.y * Math.cos(swirl) + side2.y * Math.sin(swirl)) * rad;
        arr[i * 3 + 2] = from.z + this._d.z * f + (this._s.z * Math.cos(swirl) + side2.z * Math.sin(swirl)) * rad;
      }
      p.geometry.attributes.position.needsUpdate = true;
      p.material.opacity = opacity * (0.15 + 0.85 * levels[s]);
      p.material.size = 0.006 + 0.01 * levels[s];
      p.visible = opacity > 0.01 && len > 0;
    });
  }
}

/** Anneau au sol qui pulse sous un objet mis en évidence (double cercle + halo). */
export function groundRing(color = '#2ee6f0', radius = 0.45) {
  const g = new THREE.Group();
  const mk = (r0, r1, op) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(r0, r1, 96),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
    );
    m.userData.op = op;
    m.rotation.x = -Math.PI / 2;
    g.add(m);
    return m;
  };
  const rings = [mk(radius * 0.94, radius, 0.9), mk(radius * 1.08, radius * 1.1, 0.45), mk(0.02, radius * 0.94, 0.06)];
  g.position.y = 0.004;
  g.update = (t, level) => {
    const s = 1 + 0.04 * Math.sin(t * 3);
    g.scale.set(s, 1, s);
    rings[1].rotation.z = t * 0.3;
    rings.forEach((m) => (m.material.opacity = level * m.userData.op * (0.75 + 0.25 * Math.sin(t * 3))));
    g.visible = level > 0.01;
  };
  return g;
}

/** Contour lumineux de type fresnel (halo néon autour d'un objet). */
export function outlineShell(geometry, color = '#2ee6f0', scale = 1.08) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(uColor * 1.8, uOpacity * f); }`,
  });
  const m = new THREE.Mesh(geometry, mat);
  m.scale.setScalar(scale);
  m.renderOrder = 14;
  m.update = (level) => {
    mat.uniforms.uOpacity.value = clamp(level) * 1.4;
    m.visible = level > 0.01;
  };
  return m;
}

/** Poussière lumineuse d'ambiance : particules rondes et douces qui scintillent. */
export function dustField(count = 260, spread = [8, 3, 8], color = '#7fd8ff') {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p[i * 3] = (Math.random() - 0.5) * spread[0];
    p[i * 3 + 1] = Math.random() * spread[1];
    p[i * 3 + 2] = (Math.random() - 0.5) * spread[2];
    seed[i] = Math.random() * 6.28;
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uMap: { value: softDot }, uScale: { value: 1 } },
    vertexShader: /* glsl */ `attribute float aSeed; uniform float uTime; varying float vA;
      void main(){
        vec3 pos = position; pos.y += sin(uTime * 0.25 + aSeed) * 0.05; pos.x += cos(uTime * 0.2 + aSeed * 1.7) * 0.04;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.3 + aSeed * 3.0));
        gl_PointSize = clamp((0.6 + fract(aSeed * 7.0) * 1.6) * 6.0 / -mv.z, 1.0, 7.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform sampler2D uMap; varying float vA;
      void main(){ float a = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(uColor, a * vA * 0.55); }`,
  });
  const m = new THREE.Points(g, mat);
  m.frustumCulled = false;
  m.update = (t) => {
    mat.uniforms.uTime.value = t;
    m.rotation.y = t * 0.008;
  };
  return m;
}

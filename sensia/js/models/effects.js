// Effets visuels : faisceaux lumineux, ondes ultrasonores, ondes sonores,
// lignes de flux animées. Tous sont pilotés par le temps de la timeline
// (déterministes), ce qui permet de rejouer ou de sauter à une étape.
import * as THREE from 'three';
import { clamp, smooth } from '../util.js';

/** Faisceau conique dégradé (LED, TCS3200). */
export function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float along = pow(vUv.y, 1.8);
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.4);
        gl_FragColor = vec4(uColor, uOpacity * along * edge);
      }`,
  });
}

/** Cône dont l'apex est à l'origine et qui s'étend dans la direction `dir`. */
export function makeBeam(color, length, radius, dir) {
  const g = new THREE.ConeGeometry(radius, length, 40, 1, true);
  g.translate(0, -length / 2, 0);
  const m = new THREE.Mesh(g, beamMaterial(color));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  m.renderOrder = 10;
  m.frustumCulled = false;
  return m;
}

/** Calotte sphérique (front d'onde) orientée vers +Z, rayon 1. */
function capGeometry(halfAngle) {
  const g = new THREE.SphereGeometry(1, 48, 10, 0, Math.PI * 2, 0, halfAngle);
  g.rotateX(Math.PI / 2);
  return g;
}

function waveMaterial(color, halfAngle) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uHalf: { value: halfAngle } },
    vertexShader: /* glsl */ `
      varying vec3 vP;
      void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uHalf;
      varying vec3 vP;
      void main(){
        float a = acos(clamp(normalize(vP).z, -1.0, 1.0)) / uHalf;   // 0 centre → 1 bord
        float rim = smoothstep(0.55, 1.0, a) * (1.0 - smoothstep(0.97, 1.0, a));
        gl_FragColor = vec4(uColor, uOpacity * (0.18 + 1.2 * rim));
      }`,
  });
}

/**
 * Ondes ultrasonores émises par le HC-SR04 et écho renvoyé par l'obstacle.
 * update(t, emitter, getTarget) : `emitter` = Object3D du capteur,
 * `targetPoint` = point de la face de l'obstacle (monde).
 */
export class SonarPulses {
  constructor(scene, { count = 14, start = 3, interval = 0.9, speed = 1.5, outColor = '#2ee6f0', echoColor = '#b18cff', echo = true } = {}) {
    this.start = start;
    this.withEcho = echo;
    this.interval = interval;
    this.speed = speed;
    this.out = [];
    this.echo = [];
    const geo = capGeometry(0.42);
    this.gain = 1;
    for (let i = 0; i < count; i++) {
      for (const [list, col] of [[this.out, outColor], [this.echo, echoColor]]) {
        const shells = [];
        for (let k = 0; k < 3; k++) {
          const m = new THREE.Mesh(geo, waveMaterial(col, 0.42));
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
        const rk = r - k * 0.07;
        const vis = active && rk > 0.02 && rk < dist;
        m.visible = vis;
        if (!vis) return;
        m.position.copy(this._a);
        m.lookAt(this._a.clone().add(dir));
        m.scale.setScalar(rk);
        m.material.uniforms.uOpacity.value = this.gain * (1 - k * 0.3) * (1 - 0.55 * (rk / dist)) * smooth(0.02, 0.12, rk);
      });
      const r2 = r - dist;
      echoShells.forEach((m, k) => {
        const rk = r2 - k * 0.07;
        const vis = this.withEcho && active && rk > 0.02 && rk < dist;
        m.visible = vis;
        if (!vis) return;
        if (rk > dist - 0.15) receiving = true;
        m.position.copy(b);
        m.lookAt(b.clone().add(back));
        m.scale.setScalar(rk);
        m.material.uniforms.uOpacity.value = (1 - k * 0.3) * 0.75 * (1 - 0.4 * (rk / dist));
      });
    });
    return receiving;
  }

  hide() {
    [...this.out, ...this.echo].flat().forEach((m) => (m.visible = false));
  }
}

/** Anneaux sonores qui partent d'un écouteur (message vocal diffusé). */
export class SoundRings {
  constructor(parent, axis = new THREE.Vector3(1, 0, 0), color = '#ffc14d', count = 4) {
    this.rings = [];
    const geo = new THREE.TorusGeometry(1, 0.05, 8, 48);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
      m.visible = false;
      m.frustumCulled = false;
      parent.add(m);
      this.rings.push(m);
    }
  }

  /** `level` 0..1 : intensité (0 = silence). */
  update(t, level, { period = 0.5, maxR = 0.06, offset = 0.012 } = {}) {
    this.rings.forEach((m, i) => {
      const ph = ((t / period + i / this.rings.length) % 1 + 1) % 1;
      m.visible = level > 0.01;
      const r = 0.006 + ph * maxR;
      m.scale.setScalar(r);
      m.position.copy(m.userData.base || (m.userData.base = m.position.clone()));
      m.position.addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(m.quaternion), offset + ph * 0.02);
      m.material.opacity = level * (1 - ph) * 0.9;
    });
  }
}

/** Matériau à tirets défilants pour visualiser un flux (mesure, lumière réfléchie). */
export function flowMaterial(color, { dash = 18, speed = 1.2 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uTime: { value: 0 }, uDash: { value: dash }, uSpeed: { value: speed } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime; uniform float uDash; uniform float uSpeed;
      varying vec2 vUv;
      void main(){
        float d = fract(vUv.x * uDash - uTime * uSpeed);
        float a = smoothstep(0.0, 0.15, d) * (1.0 - smoothstep(0.5, 0.65, d));
        gl_FragColor = vec4(uColor, uOpacity * (0.25 + 0.75 * a));
      }`,
  });
}

/** Ligne (tube) entre deux points, mise à jour à chaque image. */
export class FlowLine {
  constructor(scene, color, radius = 0.004, opts) {
    this.mat = flowMaterial(color, opts);
    this.radius = radius;
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), this.mat);
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

/** Anneau au sol qui pulse sous un objet mis en évidence. */
export function groundRing(color = '#2ee6f0', radius = 0.45) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.86, radius, 64),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.update = (t, level) => {
    const s = 1 + 0.06 * Math.sin(t * 4);
    m.scale.set(s, s, s);
    m.material.opacity = level * (0.55 + 0.25 * Math.sin(t * 4));
    m.visible = level > 0.01;
  };
  return m;
}

/** Contour lumineux (coque inversée légèrement agrandie). */
export function outlineShell(geometry, color = '#2ee6f0', scale = 1.08) {
  const m = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
  );
  m.scale.setScalar(scale);
  m.update = (level) => {
    m.material.opacity = clamp(level);
    m.visible = level > 0.01;
  };
  return m;
}

/** Poussière lumineuse d'ambiance (points flottants). */
export function dustField(count = 260, spread = [8, 3, 8], color = '#7fd8ff') {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    p[i * 3] = (Math.random() - 0.5) * spread[0];
    p[i * 3 + 1] = Math.random() * spread[1];
    p[i * 3 + 2] = (Math.random() - 0.5) * spread[2];
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.012, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.update = (t) => {
    m.rotation.y = t * 0.01;
    m.position.y = Math.sin(t * 0.3) * 0.03;
  };
  return m;
}

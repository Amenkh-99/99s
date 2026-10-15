import * as THREE from 'three';
import { smoothCurve } from './geom';

/**
 * Ligne animée (conducteur, liaison de mesure, liaison de commande).
 * La gaine reste d'une couleur neutre ; la superposition lumineuse animée est
 * un code de présentation, pas une couleur d'isolant réelle.
 */

export type FlowKind = 'power' | 'signal' | 'command';

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  void main() {
    vUv = uv;
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uGlow;
  uniform float uTime;
  uniform float uFlow;
  uniform float uScale;
  uniform float uPhase;
  uniform float uDuty;
  uniform float uDashed;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormalV;
  void main() {
    float s = vUv.x * uScale;
    // tirets statiques pour les liaisons conceptuelles
    if (uDashed > 0.5 && fract(s * 0.5) > 0.62) discard;
    vec3 n = normalize(vNormalV);
    float diff = 0.32 + 0.68 * max(dot(n, normalize(vec3(0.35, 0.8, 0.55))), 0.0);
    float rim = pow(1.0 - abs(n.z), 2.0);
    float d = fract(s - uTime + uPhase);
    float pulse = smoothstep(0.0, 0.06, d) * (1.0 - smoothstep(uDuty - 0.08, uDuty, d));
    vec3 col = uBase * diff + uBase * 0.35 * rim;
    col += uGlow * (pulse * 1.5 + 0.18) * uFlow;
    gl_FragColor = vec4(col, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface FlowOptions {
  kind: FlowKind;
  radius: number;
  /** Nombre de motifs par mètre. */
  density: number;
  phase?: number;
  dashed?: boolean;
  cornerRadius?: number;
  base?: THREE.ColorRepresentation;
}

export class FlowLine {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly curve: THREE.CatmullRomCurve3;
  /** Valeur courante (lissée) de l'animation lumineuse. */
  flow = 0;
  target = 0;
  speed: number;

  constructor(points: THREE.Vector3[], opts: FlowOptions) {
    this.curve = smoothCurve(points, opts.cornerRadius ?? 0.06);
    const length = this.curve.getLength();
    const segments = Math.max(16, Math.round(length * 60));
    const geo = new THREE.TubeGeometry(this.curve, segments, opts.radius, opts.kind === 'power' ? 10 : 6, false);
    this.speed = opts.kind === 'power' ? 1.1 : opts.kind === 'signal' ? 1.6 : 1.3;
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: opts.kind !== 'power',
      toneMapped: true,
      uniforms: {
        uBase: { value: new THREE.Color(opts.base ?? (opts.kind === 'power' ? 0x5c6470 : 0x48505b)) },
        uGlow: { value: new THREE.Color(0x3cc6ee) },
        uTime: { value: 0 },
        uFlow: { value: 0 },
        uScale: { value: length * opts.density },
        uPhase: { value: opts.phase ?? 0 },
        uDuty: { value: opts.kind === 'power' ? 0.42 : 0.3 },
        uDashed: { value: opts.dashed ? 1 : 0 },
        uOpacity: { value: 1 },
      },
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.castShadow = opts.kind === 'power';
    this.mesh.receiveShadow = false;
  }

  setGlow(color: THREE.Color): void {
    (this.material.uniforms.uGlow.value as THREE.Color).lerp(color, 0.2);
  }

  setOpacity(o: number): void {
    this.material.uniforms.uOpacity.value = o;
    this.mesh.visible = o > 0.005;
  }

  update(dt: number, animate: boolean): void {
    // réponse quasi immédiate mais sans saut visuel brutal
    const k = 1 - Math.exp(-dt / 0.07);
    this.flow += (this.target - this.flow) * k;
    if (animate) this.material.uniforms.uTime.value += dt * this.speed;
    this.material.uniforms.uFlow.value = this.flow;
  }

  /** Valeur figée (navigation par saut). */
  snap(): void {
    this.flow = this.target;
    this.material.uniforms.uFlow.value = this.flow;
  }
}

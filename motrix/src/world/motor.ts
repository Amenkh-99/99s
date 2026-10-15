import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bevelProfile, cylX, latheX, ringX } from './geom';
import type { MaterialSet } from './materials';
import { COLORS } from './materials';

/**
 * Moteur asynchrone triphasé procédural — représentation visuelle générique
 * (TEFC à carcasse ailetée), et non un modèle CAO du matériel du projet.
 * Axe de rotation = X du monde. Angle α autour de X : y = sin α, z = cos α.
 */

const TAU = Math.PI * 2;
const R_FRAME_IN = 0.27;
const R_FRAME_OUT = 0.3;
const HALF_LEN = 0.4;
/** Quart retiré pour l'écorché : α ∈ (0, π/2) ↔ phi ∈ (3π/2, 2π). */
const CUT_PHI_START = 1.5 * Math.PI;
const CUT_PHI_LEN = 0.5 * Math.PI;

export interface MotorDrive {
  speed: number; // 0..1, vitesse normalisée
  explode: number;
  cutaway: number;
  field: number;
  timeScale: number;
  heat: number;
  reducedMotion: boolean;
}

/** Vitesse de rotation visuelle nominale (tr/s) — valeur d'animation, pas une donnée moteur. */
const VISUAL_REV_PER_S = 1.6;
/** Écart de vitesse champ / rotor, volontairement exagéré pour être visible. */
const VISUAL_SLIP = 0.06;

function stripeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 4;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8f99a5';
  g.fillRect(0, 0, 32, 4);
  g.fillStyle = '#3d454f';
  g.fillRect(0, 0, 4, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function placeRadial(m: THREE.Matrix4, alpha: number, radius: number, x: number, twist = 0): THREE.Matrix4 {
  // la dimension « y » locale de la pièce est orientée radialement
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - alpha, twist, 0, 'XYZ'));
  return m.compose(new THREE.Vector3(x, radius * Math.sin(alpha), radius * Math.cos(alpha)), q, new THREE.Vector3(1, 1, 1));
}

export class Motor {
  readonly group = new THREE.Group();
  readonly anchors: Record<string, THREE.Object3D> = {};
  /** Matériaux de bobinage, un par phase (émissif piloté). */
  readonly coilMaterials: THREE.MeshStandardMaterial[] = [];

  private readonly removable = new THREE.Group();
  private readonly caps = new THREE.Group();
  private readonly rotor = new THREE.Group();
  private readonly fan = new THREE.Group();
  private readonly fanCover = new THREE.Group();
  private readonly rearShield = new THREE.Group();
  private readonly frontShield = new THREE.Group();
  private readonly lid = new THREE.Group();
  private readonly fieldViz = new THREE.Group();
  private readonly fieldArrow = new THREE.Group();
  private readonly rotorMarker = new THREE.Group();
  private readonly fieldMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly paint: THREE.MeshPhysicalMaterial;

  rotorAngle = 0;
  fieldAngle = 0;

  constructor(private readonly mats: MaterialSet) {
    this.paint = mats.paint;
    this.group.position.set(1.3, 0.42, 0);
    this.buildFrame();
    this.buildStator();
    this.buildWindings();
    this.buildRotor();
    this.buildShields();
    this.buildFan();
    this.buildTerminalBox();
    this.buildFieldViz();
    this.buildAnchors();
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    // les visuels lumineux ne projettent pas d'ombre
    this.fieldViz.traverse((o) => (o.castShadow = false));
  }

  private anchor(id: string, parent: THREE.Object3D, x: number, y: number, z: number): void {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    this.anchors[id] = o;
  }

  private buildFrame(): void {
    const { paint, cut, dark } = this.mats;
    // carcasse : trois quarts fixes + quart amovible
    this.group.add(new THREE.Mesh(ringX(R_FRAME_IN, R_FRAME_OUT, -HALF_LEN, HALF_LEN, 54, 0, CUT_PHI_START), paint));
    this.removable.add(new THREE.Mesh(ringX(R_FRAME_IN, R_FRAME_OUT, -HALF_LEN, HALF_LEN, 18, CUT_PHI_START, CUT_PHI_LEN), paint));
    this.group.add(this.removable);

    // ailettes de refroidissement (instanciées)
    const finGeo = new THREE.BoxGeometry(0.72, 0.038, 0.012);
    const fixed: number[] = [];
    const removed: number[] = [];
    for (let deg = 0; deg < 360; deg += 12) {
      const nearBottom = Math.abs(deg - 270) < 42;
      const nearTop = Math.abs(deg - 90) < 16;
      if (nearBottom || nearTop) continue;
      (deg > 0 && deg < 90 ? removed : fixed).push((deg * Math.PI) / 180);
    }
    const m = new THREE.Matrix4();
    const finsFixed = new THREE.InstancedMesh(finGeo, paint, fixed.length);
    fixed.forEach((a, i) => finsFixed.setMatrixAt(i, placeRadial(m, a, R_FRAME_OUT + 0.017, 0)));
    const finsRemoved = new THREE.InstancedMesh(finGeo, paint, removed.length);
    removed.forEach((a, i) => finsRemoved.setMatrixAt(i, placeRadial(m, a, R_FRAME_OUT + 0.017, 0)));
    this.group.add(finsFixed);
    this.removable.add(finsRemoved);

    // pattes de fixation
    const feet: THREE.BufferGeometry[] = [];
    for (const x of [-0.24, 0.24]) {
      const foot = new THREE.BoxGeometry(0.13, 0.05, 0.62);
      foot.translate(x, -0.395, 0);
      const web = new THREE.BoxGeometry(0.09, 0.14, 0.34);
      web.translate(x, -0.31, 0);
      feet.push(foot, web);
    }
    this.group.add(new THREE.Mesh(mergeGeometries(feet), paint));
    const holes: THREE.BufferGeometry[] = [];
    for (const x of [-0.24, 0.24])
      for (const z of [-0.25, 0.25]) {
        const h = new THREE.CylinderGeometry(0.018, 0.018, 0.006, 16);
        h.translate(x, -0.368, z);
        holes.push(h);
      }
    this.group.add(new THREE.Mesh(mergeGeometries(holes), dark));

    // faces de coupe de l'écorché (visibles uniquement quand le quart est retiré)
    const capA = new THREE.PlaneGeometry(2 * HALF_LEN, R_FRAME_OUT - R_FRAME_IN);
    capA.rotateX(-Math.PI / 2);
    capA.translate(0, 0, (R_FRAME_IN + R_FRAME_OUT) / 2);
    const capB = new THREE.PlaneGeometry(2 * HALF_LEN, R_FRAME_OUT - R_FRAME_IN);
    capB.translate(0, (R_FRAME_IN + R_FRAME_OUT) / 2, 0);
    this.caps.add(new THREE.Mesh(mergeGeometries([capA, capB]), cut));
    this.group.add(this.caps);
  }

  private buildStator(): void {
    const { lamination } = this.mats;
    const rIn = 0.172;
    const rOut = R_FRAME_IN;
    const fixed: THREE.BufferGeometry[] = [];
    const removed: THREE.BufferGeometry[] = [];
    const n = 25;
    const pitch = 0.5 / n;
    for (let i = 0; i < n; i++) {
      const x0 = -0.25 + i * pitch;
      const x1 = x0 + pitch * 0.86;
      fixed.push(ringX(rIn, rOut, x0, x1, 42, 0, CUT_PHI_START, 0.0012));
      removed.push(ringX(rIn, rOut, x0, x1, 14, CUT_PHI_START, CUT_PHI_LEN, 0.0012));
    }
    this.group.add(new THREE.Mesh(mergeGeometries(fixed), lamination));
    this.removable.add(new THREE.Mesh(mergeGeometries(removed), lamination));

    // faces de coupe du paquet de tôles (texture rayée = tôles empilées)
    const tex = stripeTexture();
    tex.repeat.set(n, 1);
    const capMat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.8, roughness: 0.38 });
    const a = new THREE.PlaneGeometry(0.5, rOut - rIn);
    a.rotateX(-Math.PI / 2);
    a.translate(0, 0, (rIn + rOut) / 2);
    const b = new THREE.PlaneGeometry(0.5, rOut - rIn);
    b.translate(0, (rIn + rOut) / 2, 0);
    this.caps.add(new THREE.Mesh(mergeGeometries([a, b]), capMat));
  }

  private buildWindings(): void {
    // Trois enroulements à pas diamétral, axes magnétiques décalés de 120°.
    for (let k = 0; k < 3; k++) {
      const axis = Math.PI / 2 + (k * TAU) / 3;
      const r = 0.2 + k * 0.019;
      const a1 = axis - Math.PI / 2;
      const pts: THREE.Vector3[] = [];
      const p = (x: number, a: number) => new THREE.Vector3(x, r * Math.sin(a), r * Math.cos(a));
      const end = 0.262;
      const bulge = 0.05 + k * 0.012;
      const arcN = 14;
      for (let i = 0; i <= 4; i++) pts.push(p(-end + (2 * end * i) / 4, a1));
      for (let i = 1; i < arcN; i++) {
        const t = i / arcN;
        pts.push(p(end + bulge * Math.sin(t * Math.PI), a1 + Math.PI * t));
      }
      for (let i = 0; i <= 4; i++) pts.push(p(end - (2 * end * i) / 4, a1 + Math.PI));
      for (let i = 1; i < arcN; i++) {
        const t = i / arcN;
        pts.push(p(-end - bulge * Math.sin(t * Math.PI), a1 + Math.PI * (1 - t)));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
      const mat = new THREE.MeshStandardMaterial({
        color: 0xb87333,
        metalness: 1,
        roughness: 0.32,
        emissive: new THREE.Color(COLORS.cyan),
        emissiveIntensity: 0,
      });
      this.coilMaterials.push(mat);
      this.group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.017, 8, true), mat));
    }
  }

  private buildRotor(): void {
    const { rotorCore, alu, steel } = this.mats;
    this.rotor.add(new THREE.Mesh(cylX(0.158, -0.25, 0.25, 48), rotorCore));
    // barres de la cage d'écureuil
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.014, 0.012), alu, 22);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 22; i++) bars.setMatrixAt(i, placeRadial(m, (i / 22) * TAU, 0.156, 0));
    this.rotor.add(bars);
    this.rotor.add(new THREE.Mesh(mergeGeometries([ringX(0.12, 0.165, 0.25, 0.278, 40), ringX(0.12, 0.165, -0.278, -0.25, 40)]), alu));
    // arbre, clavette, roulements
    this.rotor.add(new THREE.Mesh(cylX(0.04, -0.56, 0.74, 28), steel));
    const key = new THREE.BoxGeometry(0.08, 0.012, 0.016);
    key.translate(0.66, 0.042, 0);
    this.rotor.add(new THREE.Mesh(key, this.mats.dark));
    this.rotor.add(new THREE.Mesh(mergeGeometries([ringX(0.041, 0.07, 0.3, 0.335, 32), ringX(0.041, 0.07, -0.335, -0.3, 32)]), steel));
    this.group.add(this.rotor);
  }

  private buildShields(): void {
    const { paint } = this.mats;
    const front: [number, number][] = [
      [0.3, 0.4],
      [0.3, 0.43],
      [0.2, 0.455],
      [0.095, 0.47],
      [0.095, 0.5],
      [0.05, 0.5],
      [0.05, 0.44],
      [0.27, 0.4],
    ];
    const rear = front.map(([r, x]) => [r, -x] as [number, number]).reverse();
    const bolts = (x: number) => {
      const g: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const b = new THREE.CylinderGeometry(0.014, 0.014, 0.02, 12);
        b.rotateZ(Math.PI / 2);
        b.translate(x, 0.285 * Math.sin(a), 0.285 * Math.cos(a));
        g.push(b);
      }
      return mergeGeometries(g);
    };
    this.frontShield.add(new THREE.Mesh(latheX(bevelProfile(front, 0.003), 54), paint));
    this.frontShield.add(new THREE.Mesh(bolts(0.44), this.mats.steel));
    this.rearShield.add(new THREE.Mesh(latheX(bevelProfile(rear, 0.003), 54), paint));
    this.rearShield.add(new THREE.Mesh(bolts(-0.44), this.mats.steel));
    this.group.add(this.frontShield, this.rearShield);
  }

  private buildFan(): void {
    const { plasticDark, paint } = this.mats;
    const parts: THREE.BufferGeometry[] = [cylX(0.06, -0.555, -0.51, 24)];
    const m = new THREE.Matrix4();
    for (let i = 0; i < 9; i++) {
      const blade = new THREE.BoxGeometry(0.04, 0.2, 0.008);
      blade.applyMatrix4(placeRadial(m, (i / 9) * TAU, 0.16, -0.532, 0.5));
      parts.push(blade);
    }
    this.fan.add(new THREE.Mesh(mergeGeometries(parts), plasticDark));
    this.group.add(this.fan);

    // capot de ventilateur avec grille d'aspiration
    const cover: THREE.BufferGeometry[] = [ringX(0.306, 0.318, -0.665, -0.42, 54, 0, TAU, 0.002)];
    for (const r of [0.075, 0.125, 0.175, 0.225, 0.275]) cover.push(ringX(r, r + 0.01, -0.67, -0.66, 40, 0, TAU, 0.001));
    for (let i = 0; i < 6; i++) {
      const s = new THREE.BoxGeometry(0.012, 0.24, 0.014);
      s.applyMatrix4(placeRadial(m, (i / 6) * TAU, 0.18, -0.665));
      cover.push(s);
    }
    cover.push(cylX(0.075, -0.672, -0.66, 24));
    this.fanCover.add(new THREE.Mesh(mergeGeometries(cover), paint));
    this.group.add(this.fanCover);
  }

  private buildTerminalBox(): void {
    const { paint, brass, dark, nameplate } = this.mats;
    const base = new THREE.BoxGeometry(0.24, 0.12, 0.22);
    base.translate(0, 0.35, 0);
    const gland = new THREE.CylinderGeometry(0.032, 0.036, 0.05, 20);
    gland.rotateX(Math.PI / 2);
    gland.translate(0, 0.35, -0.135);
    this.group.add(new THREE.Mesh(mergeGeometries([base, gland]), paint));
    const plate = new THREE.PlaneGeometry(0.17, 0.085);
    plate.translate(0, 0.35, 0.1105);
    this.group.add(new THREE.Mesh(plate, nameplate));
    const studs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++)
      for (const z of [-0.045, 0.045]) {
        const s = new THREE.CylinderGeometry(0.011, 0.011, 0.03, 12);
        s.translate(-0.07 + i * 0.07, 0.42, z);
        studs.push(s);
      }
    this.group.add(new THREE.Mesh(mergeGeometries(studs), brass));
    const lid = new THREE.BoxGeometry(0.26, 0.026, 0.24);
    lid.translate(0, 0.423, 0);
    this.lid.add(new THREE.Mesh(lid, paint));
    const screws: THREE.BufferGeometry[] = [];
    for (const x of [-0.11, 0.11])
      for (const z of [-0.1, 0.1]) {
        const s = new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10);
        s.translate(x, 0.438, z);
        screws.push(s);
      }
    this.lid.add(new THREE.Mesh(mergeGeometries(screws), dark));
    this.group.add(this.lid);
  }

  private buildFieldViz(): void {
    const mk = (color: number, opacity: number) => {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false });
      this.fieldMaterials.push(m);
      return m;
    };
    const ringGeo = new THREE.TorusGeometry(0.255, 0.0035, 8, 96);
    ringGeo.rotateY(Math.PI / 2);
    this.fieldViz.add(new THREE.Mesh(ringGeo, mk(COLORS.cyan, 0.35)));
    // flèche du champ résultant (pointe initialement vers +y)
    const shaft = new THREE.BoxGeometry(0.006, 0.2, 0.012);
    shaft.translate(0, 0.13, 0);
    const head = new THREE.ConeGeometry(0.026, 0.06, 18);
    head.translate(0, 0.255, 0);
    this.fieldArrow.add(new THREE.Mesh(mergeGeometries([shaft, head]), mk(COLORS.cyan, 0.95)));
    this.fieldViz.add(this.fieldArrow);
    // repère du rotor (blanc)
    const marker = new THREE.BoxGeometry(0.005, 0.15, 0.01);
    marker.translate(0.004, 0.115, 0);
    const dot = new THREE.SphereGeometry(0.012, 12, 8);
    dot.translate(0.004, 0.19, 0);
    this.rotorMarker.add(new THREE.Mesh(mergeGeometries([marker, dot]), mk(COLORS.white, 0.9)));
    this.fieldViz.add(this.rotorMarker);
    this.fieldViz.position.x = 0.53;
    this.fieldViz.visible = false;
    this.group.add(this.fieldViz);
  }

  private buildAnchors(): void {
    this.anchor('m.frame', this.group, -0.12, 0.31, 0.16);
    this.anchor('m.stator', this.group, 0.05, 0.17, 0.2);
    this.anchor('m.rotor', this.rotor, 0.0, 0.16, 0.0);
    this.anchor('m.shaft', this.rotor, 0.66, 0.04, 0.0);
    this.anchor('m.bearing', this.rotor, -0.318, 0.07, 0.0);
    this.anchor('m.shield', this.frontShield, 0.45, 0.2, 0.12);
    this.anchor('m.fan', this.fan, -0.532, 0.24, 0.0);
    this.anchor('m.cover', this.fanCover, -0.6, 0.3, 0.06);
    this.anchor('m.box', this.lid, 0.06, 0.44, 0.0);
    this.anchor('f.field', this.fieldViz, 0.0, 0.27, 0.0);
    this.anchor('f.coils', this.group, 0.3, 0.22, 0.05);
    this.anchor('p.surcharge', this.rotor, 0.72, 0.0, 0.0);
    this.anchor('p.phase', this.group, -0.06, 0.35, -0.16);
    this.anchor('p.chauffe', this.group, -0.3, 0.02, 0.33);
    this.anchor('p.vibration', this.group, 0.24, -0.38, 0.3);
    this.anchor('p.tension', this.group, 0.1, 0.44, 0.08);
    this.anchor('b.motor', this.group, -0.3, 0.33, 0.1);
    this.anchor('s.t', this.group, -0.2, 0.237, -0.237);
    this.anchor('s.v', this.group, 0.44, 0.2, 0.0);
  }

  /** Avance l'animation. speed est la vitesse réelle (dynamique) normalisée. */
  update(dt: number, d: MotorDrive): void {
    const ts = d.timeScale * (d.reducedMotion ? 0.35 : 1);
    const omega = TAU * VISUAL_REV_PER_S * ts;
    this.rotorAngle += d.speed * omega * dt;
    // le champ tourne au synchronisme dès que le moteur est alimenté
    if (d.field > 0.001) this.fieldAngle += (d.speed > 0.05 ? omega / (1 - VISUAL_SLIP) : 0) * dt;
    else this.fieldAngle = this.rotorAngle;

    this.rotor.rotation.x = -this.rotorAngle;
    this.fan.rotation.x = -this.rotorAngle;

    // vue éclatée
    const e = d.explode;
    this.rotor.position.x = 0.75 * e;
    this.frontShield.position.x = 1.05 * e;
    this.rearShield.position.x = -0.36 * e;
    this.fan.position.x = -0.56 * e;
    this.fanCover.position.x = -0.82 * e;
    this.lid.position.y = 0.2 * e;

    // écorché
    const c = d.cutaway;
    this.removable.position.set(0, 0.9 * c * c, 0.9 * c * c);
    this.removable.visible = c < 0.995;
    this.caps.visible = c > 0.02;

    // champ tournant
    this.fieldViz.visible = d.field > 0.01;
    if (this.fieldViz.visible) {
      this.fieldArrow.rotation.x = -this.fieldAngle;
      this.rotorMarker.rotation.x = -this.rotorAngle;
      const base = [0.35, 0.95, 0.9];
      this.fieldMaterials.forEach((m, i) => (m.opacity = base[i] * d.field));
    }
    for (let k = 0; k < 3; k++) {
      const i = Math.cos(this.fieldAngle - (k * TAU) / 3);
      this.coilMaterials[k].emissiveIntensity = d.field * (0.08 + 0.9 * Math.max(0, i));
    }

    // teinte d'échauffement (illustration)
    this.paint.emissive.setRGB(0.17 * d.heat, 0.028 * d.heat, 0.004 * d.heat);
  }
}

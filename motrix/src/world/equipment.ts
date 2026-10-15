import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { LampState, PlcState, Tone } from '../core/state';
import { emissiveMaterial, TONE_COLOR, type MaterialSet } from './materials';
import { cylX } from './geom';

/**
 * Banc d'équipements : armoire ouverte (disjoncteur, contacteur, relais thermique,
 * automate, voyants, bouton d'arrêt) et capteurs. Formes génériques, sans marque,
 * sans modèle, sans repérage de bornes. Emplacements des capteurs : illustratifs.
 */

export const POWER_X = -2.1;
export const PHASE_SPACING = 0.065;
export const WIRE_Z = -1.0;

export const DEVICE_Y = {
  supplyTop: 2.5,
  q1Top: 1.93,
  q1Bottom: 1.57,
  km1Top: 1.35,
  km1Bottom: 1.01,
  rt1Top: 0.9,
  rt1Bottom: 0.72,
} as const;

export interface EquipmentDrive {
  bench: number;
  breaker: number;
  contactor: number;
  lamp: LampState;
  plc: PlcState;
  alarm: number;
  phaseBreak: number;
  signals: number;
  signalTone: Tone;
  reducedMotion: boolean;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Equipment {
  readonly cabinet = new THREE.Group();
  readonly sensorsFloor = new THREE.Group();
  readonly sensorsMotor = new THREE.Group();
  readonly anchors: Record<string, THREE.Object3D> = {};

  private readonly breakerLever = new THREE.Group();
  private readonly bridges = new THREE.Group();
  private readonly plcLeds: THREE.MeshStandardMaterial[] = [];
  private readonly channelLeds: THREE.MeshStandardMaterial;
  private readonly lamps: THREE.MeshStandardMaterial[] = [];
  private readonly sensorLeds: THREE.MeshStandardMaterial;
  private readonly alarmRings: THREE.Mesh[] = [];
  private readonly alarmMat: THREE.MeshBasicMaterial[] = [];
  private readonly breakMarker: THREE.Mesh;
  private time = 0;

  constructor(private readonly mats: MaterialSet, motorGroup: THREE.Group) {
    this.channelLeds = emissiveMaterial();
    this.sensorLeds = emissiveMaterial();
    this.buildCabinet();
    this.buildBreaker();
    this.buildContactor();
    this.buildThermalRelay();
    this.buildPlc();
    this.buildControlStation();
    this.buildSensors(motorGroup);
    this.breakMarker = this.buildBreakMarker();
    for (const g of [this.cabinet, this.sensorsFloor, this.sensorsMotor])
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    this.alarmRings.forEach((r) => (r.castShadow = false));
    this.breakMarker.castShadow = false;
  }

  private anchor(id: string, parent: THREE.Object3D, x: number, y: number, z: number): void {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    this.anchors[id] = o;
  }

  private add(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = this.cabinet): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    return m;
  }

  private boxAt(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    return g;
  }

  private buildCabinet(): void {
    const { plate, dark, duct, steel } = this.mats;
    // fond d'armoire et plaque de montage
    this.add(this.boxAt(2.56, 2.12, 0.3, -1.25, 1.2, -1.29), dark);
    this.add(this.boxAt(2.4, 1.95, 0.04, -1.25, 1.225, -1.12), plate);
    this.add(mergeGeometries([this.boxAt(0.06, 0.25, 0.06, -2.38, 0.125, -1.2), this.boxAt(0.06, 0.25, 0.06, -0.12, 0.125, -1.2)]), dark);
    // goulottes
    this.add(
      mergeGeometries([
        this.boxAt(2.3, 0.08, 0.06, -1.25, 2.06, -1.07),
        this.boxAt(2.3, 0.08, 0.06, -1.25, 0.4, -1.07),
        this.boxAt(0.08, 1.58, 0.06, -1.68, 1.23, -1.07),
      ]),
      duct,
    );
    // rails DIN
    this.add(
      mergeGeometries([
        this.boxAt(0.42, 0.035, 0.012, POWER_X, 1.75, -1.094),
        this.boxAt(0.42, 0.035, 0.012, POWER_X, 1.18, -1.094),
        this.boxAt(0.6, 0.035, 0.012, -1.15, 1.7, -1.094),
      ]),
      steel,
    );
    // presse-étoupe d'arrivée
    this.add(this.boxAt(0.3, 0.03, 0.15, POWER_X, 2.215, -1.03), dark);
    this.anchor('b.supply', this.cabinet, POWER_X - 0.04, 2.45, WIRE_Z);
    this.anchor('c.L1', this.cabinet, POWER_X - PHASE_SPACING, 2.36, WIRE_Z);
    this.anchor('c.L2', this.cabinet, POWER_X, 2.44, WIRE_Z);
    this.anchor('c.L3', this.cabinet, POWER_X + PHASE_SPACING, 2.36, WIRE_Z);
    this.anchor('c.L1b', this.cabinet, POWER_X - PHASE_SPACING, 0.56, WIRE_Z);
    this.anchor('c.L2b', this.cabinet, POWER_X, 0.5, WIRE_Z);
    this.anchor('c.L3b', this.cabinet, POWER_X + PHASE_SPACING, 0.56, WIRE_Z);
  }

  private terminals(yTop: number, yBottom: number): THREE.BufferGeometry {
    const g: THREE.BufferGeometry[] = [];
    for (const d of [-1, 0, 1])
      for (const y of [yTop, yBottom]) {
        const s = new THREE.CylinderGeometry(0.012, 0.012, 0.012, 10);
        s.translate(POWER_X + d * PHASE_SPACING, y, -0.985);
        g.push(s);
      }
    return mergeGeometries(g);
  }

  private buildBreaker(): void {
    const { plastic, plasticDark, dark } = this.mats;
    this.add(this.boxAt(0.27, 0.36, 0.15, POWER_X, 1.75, -1.025), plastic);
    this.add(this.boxAt(0.24, 0.17, 0.03, POWER_X, 1.75, -0.935), plastic);
    this.add(this.terminals(1.915, 1.585), dark);
    // manette (haut = fermé)
    const lever = new THREE.BoxGeometry(0.2, 0.03, 0.07);
    lever.translate(0, 0, 0.035);
    this.breakerLever.add(new THREE.Mesh(lever, plasticDark));
    this.breakerLever.position.set(POWER_X, 1.75, -0.92);
    this.cabinet.add(this.breakerLever);
    this.anchor('b.q1', this.cabinet, POWER_X + 0.135, 1.86, -0.95);
  }

  private buildContactor(): void {
    const { plastic, plasticDark, dark, brass, steel } = this.mats;
    this.add(this.boxAt(0.27, 0.34, 0.17, POWER_X, 1.18, -1.015), plasticDark);
    this.add(this.boxAt(0.25, 0.15, 0.012, POWER_X, 1.235, -0.925), plastic);
    this.add(this.boxAt(0.21, 0.085, 0.008, POWER_X, 1.235, -0.917), dark);
    this.add(this.terminals(1.335, 1.025), dark);
    // contacts fixes (haut) et ponts mobiles (bas) — visibles dans la fenêtre
    const fixed: THREE.BufferGeometry[] = [];
    for (const d of [-1, 0, 1])
      for (const s of [-1, 1]) fixed.push(this.boxAt(0.014, 0.012, 0.008, POWER_X + d * PHASE_SPACING + s * 0.018, 1.262, -0.91));
    this.add(mergeGeometries(fixed), brass);
    const br: THREE.BufferGeometry[] = [];
    for (const d of [-1, 0, 1]) br.push(this.boxAt(0.052, 0.012, 0.008, POWER_X + d * PHASE_SPACING, 0, -0.91));
    this.bridges.add(new THREE.Mesh(mergeGeometries(br), steel));
    this.bridges.position.y = 1.25;
    this.cabinet.add(this.bridges);
    this.anchor('b.km1', this.cabinet, POWER_X + 0.135, 1.26, -0.95);
  }

  private buildThermalRelay(): void {
    const { plasticDark, plastic, dark } = this.mats;
    this.add(this.boxAt(0.27, 0.18, 0.15, POWER_X, 0.81, -1.025), plasticDark);
    const dial = new THREE.CylinderGeometry(0.028, 0.028, 0.012, 24);
    dial.rotateX(Math.PI / 2);
    dial.translate(POWER_X - 0.06, 0.81, -0.944);
    const btn = new THREE.CylinderGeometry(0.014, 0.014, 0.014, 16);
    btn.rotateX(Math.PI / 2);
    btn.translate(POWER_X + 0.06, 0.81, -0.944);
    this.add(mergeGeometries([dial, btn]), plastic);
    this.add(this.terminals(0.89, 0.73), dark);
    this.anchor('b.rt1', this.cabinet, POWER_X + 0.135, 0.8, -0.95);
  }

  private buildPlc(): void {
    const { plasticDark, dark } = this.mats;
    const anth = new THREE.MeshStandardMaterial({ color: 0x2c3138, metalness: 0.15, roughness: 0.55 });
    const front = new THREE.MeshStandardMaterial({ color: 0x46505b, metalness: 0.1, roughness: 0.5 });
    this.add(
      mergeGeometries([
        this.boxAt(0.26, 0.4, 0.17, -1.27, 1.7, -1.015),
        this.boxAt(0.11, 0.4, 0.17, -1.077, 1.7, -1.015),
        this.boxAt(0.11, 0.4, 0.17, -0.962, 1.7, -1.015),
      ]),
      anth,
    );
    this.add(
      mergeGeometries([
        this.boxAt(0.24, 0.24, 0.01, -1.27, 1.7, -0.926),
        this.boxAt(0.095, 0.24, 0.01, -1.077, 1.7, -0.926),
        this.boxAt(0.095, 0.24, 0.01, -0.962, 1.7, -0.926),
      ]),
      front,
    );
    this.add(
      mergeGeometries([
        this.boxAt(0.25, 0.06, 0.012, -1.27, 1.86, -0.928),
        this.boxAt(0.25, 0.06, 0.012, -1.27, 1.54, -0.928),
        this.boxAt(0.1, 0.06, 0.012, -1.077, 1.86, -0.928),
        this.boxAt(0.1, 0.06, 0.012, -1.077, 1.54, -0.928),
        this.boxAt(0.1, 0.06, 0.012, -0.962, 1.86, -0.928),
        this.boxAt(0.1, 0.06, 0.012, -0.962, 1.54, -0.928),
      ]),
      plasticDark,
    );
    // voyants d'état de l'automate (génériques)
    for (let i = 0; i < 3; i++) {
      const m = emissiveMaterial();
      this.plcLeds.push(m);
      this.add(this.boxAt(0.024, 0.013, 0.006, -1.355, 1.79 - i * 0.026, -0.919), m);
    }
    // voyants de voies d'entrée des modules
    const ch: THREE.BufferGeometry[] = [];
    for (const x of [-1.077, -0.962]) for (let i = 0; i < 8; i++) ch.push(this.boxAt(0.012, 0.009, 0.005, x - 0.025, 1.8 - i * 0.024, -0.919));
    this.add(mergeGeometries(ch), this.channelLeds);
    this.add(this.boxAt(0.12, 0.05, 0.004, -1.25, 1.66, -0.92), dark);
    this.anchor('b.plc', this.cabinet, -1.15, 1.91, -0.95);
  }

  private buildControlStation(): void {
    const { plasticDark, dark, plastic } = this.mats;
    this.add(this.boxAt(0.5, 0.34, 0.12, -0.4, 1.35, -1.04), plasticDark);
    const bez: THREE.BufferGeometry[] = [];
    for (const x of [-0.54, -0.4, -0.26]) {
      const b = new THREE.CylinderGeometry(0.034, 0.034, 0.02, 24);
      b.rotateX(Math.PI / 2);
      b.translate(x, 1.42, -0.972);
      bez.push(b);
      const lens = new THREE.SphereGeometry(0.025, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      lens.rotateX(Math.PI / 2);
      lens.translate(x, 1.42, -0.962);
      const m = emissiveMaterial();
      this.lamps.push(m);
      this.add(lens, m);
    }
    const sb = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 28);
    sb.rotateX(Math.PI / 2);
    sb.translate(-0.4, 1.255, -0.972);
    bez.push(sb);
    this.add(mergeGeometries(bez), dark);
    // bouton d'arrêt : poussoir affleurant générique (pas un arrêt d'urgence)
    const btn = new THREE.CylinderGeometry(0.031, 0.031, 0.022, 28);
    btn.rotateX(Math.PI / 2);
    btn.translate(-0.4, 1.255, -0.955);
    this.add(btn, plastic);
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xe5484d, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.004, 6, 72), mat);
      ring.position.set(-0.4, 1.35, -0.95);
      this.alarmRings.push(ring);
      this.alarmMat.push(mat);
      this.cabinet.add(ring);
    }
    this.anchor('b.lamps', this.cabinet, -0.26, 1.46, -0.95);
    this.anchor('b.stop', this.cabinet, -0.37, 1.22, -0.95);
    this.anchor('alarm', this.cabinet, -0.25, 1.52, -0.95);
  }

  private buildSensors(motorGroup: THREE.Group): void {
    const { plastic, dark } = this.mats;
    // module de mesure de courant traversé par les conducteurs (représentation)
    this.add(this.boxAt(0.1, 0.12, 0.22, -1.38, 0.075, -0.45), plastic, this.sensorsFloor);
    this.add(this.boxAt(0.016, 0.016, 0.006, -1.38, 0.105, -0.337), this.sensorLeds, this.sensorsFloor);
    // module de mesure de tension avec prises sur les phases (représentation)
    this.add(this.boxAt(0.12, 0.1, 0.1, -1.22, 0.06, -0.66), plastic, this.sensorsFloor);
    this.add(this.boxAt(0.016, 0.016, 0.006, -1.22, 0.085, -0.607), this.sensorLeds, this.sensorsFloor);
    const taps: THREE.BufferGeometry[] = [];
    [-0.385, -0.45, -0.515].forEach((z, i) => {
      const x = -1.25 + i * 0.03;
      const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 0.1, -0.61), new THREE.Vector3(x, 0.16, (z - 0.61) / 2), new THREE.Vector3(x, 0.06, z));
      taps.push(new THREE.TubeGeometry(c, 12, 0.004, 5, false));
    });
    this.add(mergeGeometries(taps), dark, this.sensorsFloor);
    this.anchor('s.i', this.sensorsFloor, -1.38, 0.14, -0.34);
    this.anchor('s.u', this.sensorsFloor, -1.22, 0.11, -0.63);

    // sonde de température posée sur la carcasse (repère local du moteur)
    const probe = new THREE.CylinderGeometry(0.015, 0.015, 0.06, 14);
    probe.translate(0, 0.03, 0);
    probe.rotateX(-Math.PI / 4);
    probe.translate(-0.2, 0.237, -0.237);
    this.add(probe, plastic, this.sensorsMotor);
    // capteur de vibration sur le flasque côté entraînement
    this.add(cylX(0.03, 0.46, 0.5, 20).translate(0, 0.2, 0), plastic, this.sensorsMotor);
    this.sensorsMotor.position.copy(motorGroup.position);
  }

  private buildBreakMarker(): THREE.Mesh {
    const mat = new THREE.MeshBasicMaterial({ color: 0xe5484d, transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
    const g = new THREE.TorusGeometry(0.03, 0.0045, 8, 32);
    g.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(POWER_X + PHASE_SPACING, 2.34, WIRE_Z);
    this.cabinet.add(m);
    this.anchor('c.break', this.cabinet, POWER_X + PHASE_SPACING + 0.02, 2.34, WIRE_Z);
    return m;
  }

  /** Décalages d'apparition échelonnés du banc (choréographie d'entrée). */
  static riseOffsets(bench: number) {
    return {
      cabinet: (1 - smooth(0, 0.62, bench)) * -2.6,
      cables: (1 - smooth(0.25, 0.85, bench)) * -2.6,
      sensors: smooth(0.55, 1, bench),
    };
  }

  update(dt: number, d: EquipmentDrive): void {
    this.time += dt;
    const rise = Equipment.riseOffsets(d.bench);
    this.cabinet.position.y = rise.cabinet;
    this.cabinet.visible = d.bench > 0.001;
    this.sensorsFloor.position.y = rise.cables;
    this.sensorsFloor.visible = d.bench > 0.001;
    const s = Math.max(0.0001, rise.sensors);
    this.sensorsMotor.scale.setScalar(1);
    this.sensorsMotor.visible = rise.sensors > 0.02;
    this.sensorsMotor.children.forEach((c) => c.scale.setScalar(s));

    this.breakerLever.rotation.x = 0.6 - 1.2 * d.breaker;
    this.bridges.position.y = 1.25 - 0.024 * (1 - d.contactor);

    const off = new THREE.Color(0x000000);
    const set = (m: THREE.MeshStandardMaterial, c: THREE.Color | null, k = 1) => {
      m.emissive.copy(c ?? off);
      m.emissiveIntensity = c ? k : 0;
    };
    // voyants : couleurs de présentation (cyan / ambre / rouge), pas les couleurs réelles
    set(this.lamps[0], d.lamp === 'normal' ? TONE_COLOR.normal : null, 2.2);
    set(this.lamps[1], d.lamp === 'warning' ? TONE_COLOR.warning : null, 2.2);
    set(this.lamps[2], d.lamp === 'fault' ? TONE_COLOR.fault : null, 2.4);

    const plcColor = d.plc === 'idle' ? null : d.plc === 'run' ? TONE_COLOR.normal : TONE_COLOR[d.plc];
    set(this.plcLeds[0], d.plc !== 'idle' ? TONE_COLOR.normal : null, 1.6);
    set(this.plcLeds[1], d.plc === 'warning' || d.plc === 'fault' ? plcColor : null, 1.8);
    set(this.plcLeds[2], null);

    const blink = d.reducedMotion ? 1 : 0.55 + 0.45 * Math.sin(this.time * 9);
    set(this.channelLeds, d.signals > 0.05 ? TONE_COLOR[d.signalTone] : null, 1.2 * d.signals * blink);
    set(this.sensorLeds, d.signals > 0.05 || d.bench > 0.9 ? TONE_COLOR[d.signalTone] : null, 1.4 * Math.max(d.signals, 0.4) * blink);

    // alarme : anneaux en expansion (visualisation abstraite)
    this.alarmRings.forEach((r, i) => {
      if (d.alarm < 0.01) {
        this.alarmMat[i].opacity = 0;
        r.visible = false;
        return;
      }
      r.visible = true;
      const p = d.reducedMotion ? 0.5 : (this.time * 0.7 + i * 0.5) % 1;
      r.scale.setScalar(1 + p * 1.4);
      this.alarmMat[i].opacity = d.alarm * (d.reducedMotion ? 0.7 : 0.85 * (1 - p));
    });

    (this.breakMarker.material as THREE.MeshBasicMaterial).opacity = d.phaseBreak;
    this.breakMarker.visible = d.phaseBreak > 0.01 && d.bench > 0.5;
  }
}

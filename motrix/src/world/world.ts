import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DEFAULT_STATE, settledSpeed, type CameraKey, type WorldState } from '../core/state';
import { CAMERAS } from './cameras';
import { Equipment, DEVICE_Y, PHASE_SPACING, POWER_X, WIRE_Z } from './equipment';
import { FlowLine } from './flows';
import { offsetPath, type V3 } from './geom';
import { COLORS, createMaterials, poolTexture, TONE_COLOR } from './materials';
import { Motor } from './motor';

export type Quality = 'high' | 'low';

/** Pose caméra animable (interpolée par GSAP). */
export interface CamRig {
  px: number;
  py: number;
  pz: number;
  tx: number;
  ty: number;
  tz: number;
  fov: number;
}

export function rigFromKey(key: CameraKey): CamRig {
  const c = CAMERAS[key];
  return { px: c.pos[0], py: c.pos[1], pz: c.pos[2], tx: c.target[0], ty: c.target[1], tz: c.target[2], fov: c.fov };
}

const PHASE_OFFSETS = [1, 0, -1]; // L1, L2, L3 (avec un vecteur latéral -x : L1 à gauche)

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.05, 60);
  readonly motor: Motor;
  readonly equipment: Equipment;
  readonly anchors: Record<string, THREE.Object3D>;
  /** État visuel courant (interpolé par la scène). */
  readonly live: WorldState = { ...DEFAULT_STATE };
  readonly rig: CamRig = rigFromKey('hero');
  speed = 0;
  reducedMotion = false;
  quality: Quality = 'high';

  private readonly key: THREE.DirectionalLight;
  private readonly rim: THREE.DirectionalLight;
  private readonly cables = new THREE.Group();
  private readonly power: FlowLine[][] = [[], [], []]; // [phase][segment A,B,C,D]
  private readonly signals: FlowLine[] = [];
  private readonly commands: FlowLine[] = [];
  private powerLines: FlowLine[] = [];
  private time = 0;
  private stageScale = 1;
  private readonly tmp = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(COLORS.bg, 1);

    this.scene.background = new THREE.Color(COLORS.bg);
    this.scene.fog = new THREE.Fog(COLORS.bg, 7.5, 18);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.62;
    pmrem.dispose();

    const mats = createMaterials();
    this.scene.add(new THREE.HemisphereLight(0x7a8aa6, 0x0a0e15, 0.35));
    this.key = new THREE.DirectionalLight(0xfff1e2, 2.3);
    this.key.position.set(3.2, 5.6, 3.4);
    this.key.target.position.set(-0.2, 0.4, -0.3);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    const sc = this.key.shadow.camera;
    sc.left = -3.6;
    sc.right = 3.6;
    sc.top = 3.2;
    sc.bottom = -3.2;
    sc.near = 1;
    sc.far = 14;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.rim = new THREE.DirectionalLight(0x86b6ff, 1.5);
    this.rim.position.set(-3.5, 2.8, -4.5);
    // lumière d'appoint froide côté public, sans ombre
    const fill = new THREE.DirectionalLight(0xc8dcff, 0.55);
    fill.position.set(-1.5, 1.6, 5);
    this.scene.add(this.key, this.key.target, this.rim, fill);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mats.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(7.5, 5, 1);
    pool.position.set(-0.2, 0.003, -0.2);
    pool.renderOrder = -1;
    this.scene.add(pool);

    this.motor = new Motor(mats);
    this.equipment = new Equipment(mats, this.motor.group);
    this.scene.add(this.motor.group, this.equipment.cabinet, this.equipment.sensorsFloor, this.equipment.sensorsMotor, this.cables);
    this.buildConductors();
    this.buildSignals();
    this.powerLines = this.power.flat();
    this.anchors = { ...this.motor.anchors, ...this.equipment.anchors };
  }

  private buildConductors(): void {
    const X = POWER_X;
    const Z = WIRE_Z;
    const vert = (y0: number, y1: number): { pts: V3[]; r: V3[] } => ({
      pts: [
        [X, y0, Z],
        [X, y1, Z],
      ],
      r: [
        [-1, 0, 0],
        [-1, 0, 0],
      ],
    });
    // trajet aval : relais thermique → sol → moteur (boîte à bornes)
    const down: { pts: V3[]; r: V3[] } = {
      pts: [
        [X, DEVICE_Y.rt1Bottom, Z],
        [X, 0.04, Z],
        [X, 0.04, -0.45],
        [1.3, 0.04, -0.45],
        [1.3, 0.77, -0.45],
        [1.3, 0.77, -0.155],
      ],
      r: [
        [-1, 0, 0],
        [-1, 0, 0],
        [-1, 0, 1],
        [0, 0, 1],
        [-1, 0, 1],
        [-1, 0, 0],
      ],
    };
    const segments = [
      vert(DEVICE_Y.supplyTop, DEVICE_Y.q1Top),
      vert(DEVICE_Y.q1Bottom, DEVICE_Y.km1Top),
      vert(DEVICE_Y.km1Bottom, DEVICE_Y.rt1Top),
      down,
    ];
    for (let k = 0; k < 3; k++) {
      segments.forEach((seg, si) => {
        const line = new FlowLine(offsetPath(seg.pts, seg.r, PHASE_OFFSETS[k] * PHASE_SPACING), {
          kind: 'power',
          radius: 0.013,
          density: 4.5,
          phase: k / 3, // décalage visuel de 120°
          cornerRadius: 0.08,
        });
        this.power[k].push(line);
        (si === 3 ? this.cables : this.equipment.cabinet).add(line.mesh);
      });
    }
  }

  private buildSignals(): void {
    const S = (p: V3[]) => p.map((v) => new THREE.Vector3(...v));
    const sig = [
      S([[-1.38, 0.13, -0.45], [-1.38, 0.26, -0.45], [-1.38, 0.26, -1.02], [-1.38, 1.5, -1.02]]),
      S([[-1.22, 0.11, -0.66], [-1.22, 0.22, -0.66], [-1.22, 0.22, -1.02], [-1.22, 1.5, -1.02]]),
      S([[1.1, 0.69, -0.27], [1.1, 0.86, -0.27], [1.1, 0.86, -0.74], [1.1, 0.03, -0.74], [-1.1, 0.03, -0.74], [-1.1, 0.03, -1.02], [-1.1, 1.5, -1.02]]),
      S([[1.78, 0.65, 0], [1.78, 0.84, 0], [1.78, 0.84, -0.8], [1.78, 0.03, -0.8], [-0.98, 0.03, -0.8], [-0.98, 0.03, -1.02], [-0.98, 1.5, -1.02]]),
    ];
    for (const pts of sig) {
      const l = new FlowLine(pts, { kind: 'signal', radius: 0.006, density: 6, cornerRadius: 0.06 });
      this.signals.push(l);
      this.cables.add(l.mesh);
    }
    const cmd = [
      S([[-1.4, 1.62, -1.0], [-1.82, 1.62, -1.0], [-1.82, 1.18, -1.0], [-1.965, 1.18, -1.0]]),
      S([[-0.9, 1.8, -1.0], [-0.4, 1.8, -1.0], [-0.4, 1.52, -1.0]]),
    ];
    for (const pts of cmd) {
      const l = new FlowLine(pts, { kind: 'command', radius: 0.007, density: 14, dashed: true, cornerRadius: 0.05 });
      this.commands.push(l);
      this.equipment.cabinet.add(l.mesh);
    }
    const a = new THREE.Object3D();
    a.position.set(-1.82, 1.4, -1.0);
    this.equipment.cabinet.add(a);
    this.equipment.anchors['cmd.km'] = a;
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.key.castShadow = q === 'high';
    this.applyPixelRatio();
  }

  /** stageScale : facteur d'échelle CSS du canevas 1920 × 1080. */
  resize(stageScale: number): void {
    this.stageScale = stageScale;
    this.renderer.setSize(1920, 1080, false);
    this.applyPixelRatio();
  }

  /** Plafond imposé (tests automatisés uniquement, paramètre ?pr=). */
  pixelRatioOverride: number | null = null;

  private applyPixelRatio(): void {
    const dpr = window.devicePixelRatio || 1;
    const cap = this.pixelRatioOverride ?? (this.quality === 'high' ? 1.5 : 0.85);
    this.renderer.setPixelRatio(Math.min(this.stageScale * dpr, cap));
  }

  /** Introduction lumineuse (balayage) — appelée une fois au démarrage. */
  lightIntro(progress: number): void {
    const p = Math.min(1, Math.max(0, progress));
    this.key.intensity = 2.3 * p;
    this.rim.intensity = 1.5 * Math.min(1, p * 1.6);
    this.key.position.set(-2 + 5.2 * p, 5.6, -1.5 + 4.9 * p);
  }

  /** Pose immédiate de la vitesse et des flux (navigation par saut). */
  snapPhysics(): void {
    this.speed = settledSpeed(this.live);
    this.updateFlowTargets();
    for (const l of [...this.power.flat(), ...this.signals, ...this.commands]) l.snap();
  }

  private updateFlowTargets(): void {
    const s = this.live;
    const sup = [s.supplyL1, s.supplyL2, s.supplyL3];
    const breakerOn = s.breaker > 0.5 ? 1 : 0;
    const contOn = s.contactor > 0.5 ? 1 : 0;
    for (let k = 0; k < 3; k++) {
      const a = sup[k] * s.flows;
      this.power[k][0].target = a;
      this.power[k][1].target = a * breakerOn;
      this.power[k][2].target = a * breakerOn * contOn;
      this.power[k][3].target = a * breakerOn * contOn;
    }
    for (const l of this.signals) {
      l.target = s.signals;
      l.setOpacity(s.signals);
    }
    for (const l of this.commands) {
      l.target = s.command;
      l.setOpacity(s.command);
    }
  }

  /** Avance la simulation visuelle d'un pas dt (s). */
  update(dt: number): void {
    this.time += dt;
    const s = this.live;
    const target = settledSpeed(s);
    // roue libre après coupure : décélération lente et visible (constante illustrative)
    const tau = target > this.speed ? 0.9 : s.forceStop ? 2.3 : 4.0;
    this.speed += (target - this.speed) * (1 - Math.exp(-dt / tau));
    if (Math.abs(target - this.speed) < 0.0005) this.speed = target;

    this.motor.update(dt, {
      speed: this.speed,
      explode: s.explode,
      cutaway: s.cutaway,
      field: s.field,
      timeScale: s.motorTimeScale,
      heat: s.heat,
      reducedMotion: this.reducedMotion,
    });
    this.equipment.update(dt, {
      bench: s.bench,
      breaker: s.breaker,
      contactor: s.contactor,
      lamp: s.lamp,
      plc: s.plc,
      alarm: s.alarm,
      phaseBreak: s.phaseBreak,
      signals: s.signals,
      signalTone: s.signalTone,
      reducedMotion: this.reducedMotion,
    });
    const rise = Equipment.riseOffsets(s.bench);
    this.cables.position.y = rise.cables;
    this.cables.visible = s.bench > 0.001;

    this.updateFlowTargets();
    const animate = !this.reducedMotion;
    for (const l of this.powerLines) l.update(dt, animate);
    for (const l of this.signals) {
      l.setGlow(TONE_COLOR[s.signalTone]);
      l.update(dt, animate);
    }
    for (const l of this.commands) {
      l.setGlow(TONE_COLOR[s.commandTone]);
      l.update(dt, animate);
    }

    // caméra + légère dérive (désactivée en mouvement réduit)
    const r = this.rig;
    const drift = this.reducedMotion ? 0 : 1;
    const t = this.time;
    this.camera.position.set(
      r.px + Math.sin(t * 0.13) * 0.045 * drift,
      r.py + Math.sin(t * 0.17) * 0.022 * drift,
      r.pz + Math.cos(t * 0.11) * 0.045 * drift,
    );
    this.camera.lookAt(r.tx, r.ty, r.tz);
    if (this.camera.fov !== r.fov) {
      this.camera.fov = r.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Projection d'une ancre vers les coordonnées de la scène 1920 × 1080. */
  project(id: string): { x: number; y: number; visible: boolean } | null {
    const a = this.anchors[id];
    if (!a) return null;
    a.getWorldPosition(this.tmp);
    this.tmp.project(this.camera);
    const visible = this.tmp.z < 1 && Math.abs(this.tmp.x) < 1.05 && Math.abs(this.tmp.y) < 1.05 && a.parent?.visible !== false;
    return { x: (this.tmp.x + 1) * 960, y: (1 - this.tmp.y) * 540, visible };
  }

  /**
   * Compile tous les shaders avant la première image, y compris ceux des objets
   * encore masqués (sinon la compilation se produirait en pleine transition).
   */
  warmup(): void {
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    this.renderer.compile(this.scene, this.camera);
    // une image hors champ pour initialiser aussi les états de rendu (ombres, transparence)
    this.renderer.render(this.scene, this.camera);
    for (const o of hidden) o.visible = false;
  }

  /** Niveau d'animation des flux (diagnostic / tests) : amont = arrivée, aval = vers le moteur. */
  flowLevels(): { upstream: number[]; downstream: number[] } {
    return { upstream: this.power.map((p) => p[1].flow), downstream: this.power.map((p) => p[3].flow) };
  }

  stats() {
    const i = this.renderer.info;
    return {
      calls: i.render.calls,
      triangles: i.render.triangles,
      geometries: i.memory.geometries,
      textures: i.memory.textures,
      programs: i.programs?.length ?? 0,
      pixelRatio: this.renderer.getPixelRatio(),
    };
  }
}

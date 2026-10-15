/**
 * État déclaratif du monde 3D. Chaque étape de scène décrit un « patch » ; l'état
 * d'une étape est la fusion des valeurs par défaut, de la base de la scène et des
 * patches des étapes 0..n. L'état obtenu ne dépend donc jamais du chemin de navigation.
 */

export type Tone = 'normal' | 'warning' | 'fault';
export type LampState = 'off' | Tone;
export type PlcState = 'idle' | 'run' | Tone;

export type CameraKey =
  | 'hero'
  | 'heroWide'
  | 'problem'
  | 'motorSide'
  | 'motorExplode'
  | 'motorCut'
  | 'orbitCalm'
  | 'benchWide'
  | 'panel'
  | 'powerRun'
  | 'motorBox'
  | 'sensors'
  | 'plc'
  | 'scenarioWide'
  | 'supplyTop'
  | 'contactor'
  | 'cableToMotor'
  | 'motorStop'
  | 'alarm'
  | 'backdrop'
  | 'finale';

export interface WorldState {
  /** Équipements du banc visibles (0 = enfouis sous le sol, 1 = en place). */
  bench: number;
  /** Vue éclatée du moteur. */
  explode: number;
  /** Écorché (quart avant retiré). */
  cutaway: number;
  /** Visualisation du champ tournant. */
  field: number;
  /** Échelle de temps visuelle du moteur (ralenti pédagogique). */
  motorTimeScale: number;
  /** Teinte d'échauffement illustrative de la carcasse. */
  heat: number;
  /** Arrêt forcé illustratif (scène problématique). */
  forceStop: 0 | 1;
  /** Disponibilité des phases à l'arrivée (1 = disponible). */
  supplyL1: 0 | 1;
  supplyL2: 0 | 1;
  supplyL3: 0 | 1;
  /** Position du disjoncteur (1 = fermé). */
  breaker: number;
  /** Position des contacts du contacteur (1 = fermés). */
  contactor: number;
  /** Visibilité de la superposition « flux de puissance ». */
  flows: number;
  /** Visibilité des liaisons capteurs → PLC. */
  signals: number;
  signalTone: Tone;
  /** Visibilité de la liaison de commande PLC → contacteur / signalisation. */
  command: number;
  commandTone: Tone;
  lamp: LampState;
  plc: PlcState;
  alarm: 0 | 1;
  /** Repère de rupture sur la phase indisponible. */
  phaseBreak: number;
  /** Assombrissement de la scène 3D derrière les panneaux (0..1). */
  dim: number;
  /** Étiquettes 3D visibles. */
  labels: readonly string[];
}

export const DEFAULT_STATE: WorldState = {
  bench: 0,
  explode: 0,
  cutaway: 0,
  field: 0,
  motorTimeScale: 1,
  heat: 0,
  forceStop: 0,
  supplyL1: 1,
  supplyL2: 1,
  supplyL3: 1,
  breaker: 1,
  contactor: 1,
  flows: 0,
  signals: 0,
  signalTone: 'normal',
  command: 0,
  commandTone: 'normal',
  lamp: 'off',
  plc: 'idle',
  alarm: 0,
  phaseBreak: 0,
  dim: 0,
  labels: [],
};

/** Champs interpolés continûment ; les autres basculent à un instant donné. */
export const NUMERIC_KEYS = [
  'bench',
  'explode',
  'cutaway',
  'field',
  'motorTimeScale',
  'heat',
  'breaker',
  'contactor',
  'flows',
  'signals',
  'command',
  'phaseBreak',
  'dim',
] as const satisfies readonly (keyof WorldState)[];

export type NumericKey = (typeof NUMERIC_KEYS)[number];

export interface StepSpec {
  /** Modifications de l'état du monde à cette étape. */
  world?: Partial<WorldState>;
  /** Cadrage caméra (sinon celui de l'étape précédente). */
  camera?: CameraKey;
  /** Retards (s) par champ, uniquement en navigation avant animée. */
  delays?: Partial<Record<keyof WorldState, number>>;
  /** Durées (s) par champ numérique, uniquement en navigation avant animée. */
  durations?: Partial<Record<NumericKey, number>>;
}

export interface SceneDef {
  id: string;
  title: string;
  chapter: string;
  camera: CameraKey;
  base?: Partial<WorldState>;
  steps: StepSpec[];
  notes: string;
}

export interface ResolvedStep {
  world: WorldState;
  camera: CameraKey;
}

export function resolveStep(scene: SceneDef, step: number): ResolvedStep {
  const clamped = Math.max(0, Math.min(step, scene.steps.length - 1));
  let world: WorldState = { ...DEFAULT_STATE, ...scene.base };
  let camera = scene.camera;
  for (let i = 0; i <= clamped; i++) {
    const s = scene.steps[i];
    if (s.world) world = { ...world, ...s.world };
    if (s.camera) camera = s.camera;
  }
  return { world, camera };
}

/** Vitesse d'équilibre (0..1) du moteur pour un état donné. */
export function settledSpeed(w: Pick<WorldState, 'breaker' | 'contactor' | 'supplyL1' | 'supplyL2' | 'supplyL3' | 'forceStop'>): number {
  if (w.forceStop) return 0;
  if (w.breaker < 0.5 || w.contactor < 0.5) return 0;
  const phases = w.supplyL1 + w.supplyL2 + w.supplyL3;
  if (phases === 3) return 1;
  // Fonctionnement sur deux phases : un moteur déjà lancé continue de tourner
  // (avec un couple réduit) ; seule la protection l'arrête.
  if (phases === 2) return 0.9;
  return 0;
}

export interface NavPosition {
  scene: number;
  step: number;
}

/** Navigation pure (testable) avec gestion des scènes ignorées. */
export class Navigator {
  readonly stepCounts: readonly number[];
  pos: NavPosition = { scene: 0, step: 0 };
  skipped = new Set<number>();

  constructor(stepCounts: readonly number[]) {
    if (stepCounts.length === 0 || stepCounts.some((n) => n < 1)) {
      throw new Error('Chaque scène doit comporter au moins une étape.');
    }
    this.stepCounts = stepCounts;
  }

  get sceneCount(): number {
    return this.stepCounts.length;
  }

  private nextScene(from: number): number | null {
    for (let i = from + 1; i < this.sceneCount; i++) if (!this.skipped.has(i)) return i;
    return null;
  }

  private prevScene(from: number): number | null {
    for (let i = from - 1; i >= 0; i--) if (!this.skipped.has(i)) return i;
    return null;
  }

  next(): NavPosition | null {
    const { scene, step } = this.pos;
    if (step < this.stepCounts[scene] - 1) return (this.pos = { scene, step: step + 1 });
    const n = this.nextScene(scene);
    return n === null ? null : (this.pos = { scene: n, step: 0 });
  }

  prev(): NavPosition | null {
    const { scene, step } = this.pos;
    if (step > 0) return (this.pos = { scene, step: step - 1 });
    const p = this.prevScene(scene);
    return p === null ? null : (this.pos = { scene: p, step: this.stepCounts[p] - 1 });
  }

  nextSceneStart(): NavPosition | null {
    const n = this.nextScene(this.pos.scene);
    return n === null ? null : (this.pos = { scene: n, step: 0 });
  }

  prevSceneStart(): NavPosition | null {
    if (this.pos.step > 0) return (this.pos = { scene: this.pos.scene, step: 0 });
    const p = this.prevScene(this.pos.scene);
    return p === null ? null : (this.pos = { scene: p, step: 0 });
  }

  goto(scene: number, step = 0): NavPosition {
    const s = Math.max(0, Math.min(Math.trunc(scene), this.sceneCount - 1));
    const k = Math.max(0, Math.min(Math.trunc(step), this.stepCounts[s] - 1));
    return (this.pos = { scene: s, step: k });
  }

  first(): NavPosition {
    return this.goto(0, 0);
  }

  last(): NavPosition {
    const s = this.sceneCount - 1;
    return this.goto(s, this.stepCounts[s] - 1);
  }
}

/**
 * Une transition est animée uniquement si l'on avance d'exactement une étape
 * (dans la scène ou vers la scène suivante non ignorée). Tout le reste
 * (retour, saut) est « posé » directement dans l'état stable de la cible.
 */
export function isForwardStep(from: NavPosition, to: NavPosition, nav: Navigator): boolean {
  if (from.scene === to.scene) return to.step === from.step + 1;
  if (to.step !== 0) return false;
  if (from.step !== nav.stepCounts[from.scene] - 1) return false;
  for (let i = from.scene + 1; i < to.scene; i++) if (!nav.skipped.has(i)) return false;
  return to.scene > from.scene;
}

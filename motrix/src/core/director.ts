import gsap from 'gsap';
import { NUMERIC_KEYS, resolveStep, type NavPosition, type NumericKey, type WorldState } from './state';
import type { Scene } from '../content/scenes';
import { rigFromKey, type World } from '../world/world';
import type { LabelLayer } from '../ui/labels';

const DEFAULT_DUR: Record<NumericKey, number> = {
  bench: 2.8,
  explode: 2.2,
  cutaway: 1.4,
  field: 1.0,
  motorTimeScale: 1.2,
  heat: 1.6,
  breaker: 0.35,
  contactor: 0.25,
  flows: 0.6,
  signals: 0.9,
  command: 0.5,
  phaseBreak: 0.4,
  dim: 0.9,
};

/** Champs qui pilotent la physique : posés immédiatement lors d'un saut. */
const PHYSICAL = new Set<keyof WorldState>(['breaker', 'contactor', 'supplyL1', 'supplyL2', 'supplyL3', 'forceStop']);

export type TransitionMode = 'animate' | 'snap' | 'instant';

/**
 * Applique l'état résolu d'une étape au monde 3D, aux superpositions et aux
 * étiquettes. Une seule chronologie GSAP est active à la fois : toute nouvelle
 * navigation termine (avance) ou interrompt (saut) la précédente.
 */
export class Director {
  private tl: gsap.core.Timeline | null = null;
  private current: NavPosition | null = null;
  reducedMotion = false;
  onCut?: () => void;

  constructor(
    private readonly world: World,
    private readonly scenes: Scene[],
    private readonly overlays: HTMLElement[],
    private readonly labels: LabelLayer,
  ) {}

  get position(): NavPosition | null {
    return this.current;
  }

  /** Vrai tant qu'une transition est en cours (utilisé par les tests). */
  get busy(): boolean {
    return !!this.tl && this.tl.isActive();
  }

  /** Instant courant de la chronologie (diagnostic). */
  get timelineTime(): number {
    return this.tl ? this.tl.time() : -1;
  }

  /** Termine immédiatement la transition en cours. */
  settle(): void {
    if (this.tl) {
      this.tl.progress(1);
      this.tl.kill();
      this.tl = null;
    }
  }

  go(to: NavPosition, mode: TransitionMode): void {
    const scene = this.scenes[to.scene];
    const target = resolveStep(scene, to.step);
    const prev = this.current;
    const sceneChanged = !prev || prev.scene !== to.scene;

    if (mode === 'animate') this.settle();
    else if (this.tl) {
      this.tl.kill();
      this.tl = null;
    }

    const live = this.world.live;
    const rm = this.reducedMotion;
    const tl = gsap.timeline();
    this.tl = tl;

    // ── caméra
    const rig = rigFromKey(target.camera);
    const camChanged = (Object.keys(rig) as (keyof typeof rig)[]).some((k) => Math.abs(this.world.rig[k] - rig[k]) > 1e-4);
    let camDur = 0;
    if (camChanged) {
      if (mode === 'instant' || rm) {
        if (mode !== 'instant') this.onCut?.();
        Object.assign(this.world.rig, rig);
      } else {
        camDur = mode === 'animate' ? (sceneChanged ? 2.4 : 2.0) : 0.9;
        tl.to(this.world.rig, { ...rig, duration: camDur, ease: 'power3.inOut' }, 0);
      }
    }

    // ── état du monde
    const delays = mode === 'animate' ? scene.steps[to.step]?.delays ?? {} : {};
    const durs = mode === 'animate' ? scene.steps[to.step]?.durations ?? {} : {};
    const delayScale = rm ? 0.5 : 1;
    const w = target.world;

    for (const key of Object.keys(w) as (keyof WorldState)[]) {
      if (key === 'labels') continue;
      const value = w[key];
      if (live[key] === value) continue;
      const isNumeric = (NUMERIC_KEYS as readonly string[]).includes(key);
      if (mode === 'instant' || (mode === 'snap' && (!isNumeric || PHYSICAL.has(key) || rm))) {
        (live as unknown as Record<string, unknown>)[key] = value;
        continue;
      }
      const at = (delays[key] ?? 0) * delayScale;
      if (isNumeric) {
        const k = key as NumericKey;
        const base = mode === 'animate' ? durs[k] ?? DEFAULT_DUR[k] : 0.5;
        const dur = rm ? Math.min(base, 0.35) : base;
        tl.to(live, { [k]: value as number, duration: dur, ease: k === 'contactor' || k === 'breaker' ? 'power2.in' : 'power2.inOut' }, at);
      } else {
        tl.call(() => {
          (live as unknown as Record<string, unknown>)[key] = value;
        }, undefined, at);
      }
    }
    if (mode !== 'animate') this.world.snapPhysics();

    // ── étiquettes : retirées pendant le déplacement, reposées à l'arrivée
    const sameLabels = live.labels.join('|') === w.labels.join('|');
    if (!sameLabels) {
      live.labels = w.labels;
      if (camDur > 0 && mode === 'animate') {
        this.labels.setActive([]);
        tl.call(() => this.labels.setActive(w.labels), undefined, camDur * 0.72);
      } else this.labels.setActive(w.labels);
    } else this.labels.setActive(w.labels);

    // ── superpositions HTML
    if (sceneChanged) {
      this.overlays.forEach((el, i) => {
        const on = i === to.scene;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
        el.inert = !on;
      });
    }
    this.applySteps(this.overlays[to.scene], to.step);
    this.current = { ...to };
    if (!tl.getChildren().length) {
      tl.kill();
      this.tl = null;
    }
  }

  private applySteps(root: HTMLElement, step: number): void {
    root.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => el.classList.toggle('is-in', step >= Number(el.dataset.step)));
    root.querySelectorAll<HTMLElement>('[data-only]').forEach((el) => el.classList.toggle('is-in', step === Number(el.dataset.only)));
    root.querySelectorAll<HTMLElement>('[data-until]').forEach((el) => el.classList.toggle('is-in', step <= Number(el.dataset.until)));
    root.querySelectorAll<HTMLElement>('[data-hl]').forEach((el) => {
      const n = Number(el.dataset.hl);
      el.classList.toggle('is-hl', n === step);
      el.classList.toggle('is-past', n < step);
    });
  }
}

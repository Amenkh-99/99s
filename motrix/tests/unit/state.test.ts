import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, Navigator, isForwardStep, resolveStep, settledSpeed, type SceneDef } from '../../src/core/state';

const scene = (steps: SceneDef['steps']): SceneDef => ({ id: 'x', title: 'x', chapter: 'x', camera: 'hero', steps, notes: '' });

describe('Navigator', () => {
  it('avance étape par étape puis de scène en scène', () => {
    const nav = new Navigator([2, 1, 3]);
    expect(nav.next()).toEqual({ scene: 0, step: 1 });
    expect(nav.next()).toEqual({ scene: 1, step: 0 });
    expect(nav.next()).toEqual({ scene: 2, step: 0 });
    nav.last();
    expect(nav.next()).toBeNull();
  });

  it('recule vers la dernière étape de la scène précédente', () => {
    const nav = new Navigator([2, 3]);
    nav.goto(1, 0);
    expect(nav.prev()).toEqual({ scene: 0, step: 1 });
    nav.first();
    expect(nav.prev()).toBeNull();
  });

  it('saute les scènes ignorées dans les deux sens', () => {
    const nav = new Navigator([1, 1, 1, 1]);
    nav.skipped = new Set([1, 2]);
    expect(nav.next()).toEqual({ scene: 3, step: 0 });
    expect(nav.prev()).toEqual({ scene: 0, step: 0 });
    expect(nav.nextSceneStart()).toEqual({ scene: 3, step: 0 });
  });

  it('borne les positions demandées', () => {
    const nav = new Navigator([2, 2]);
    expect(nav.goto(9, 9)).toEqual({ scene: 1, step: 1 });
    expect(nav.goto(-3, -1)).toEqual({ scene: 0, step: 0 });
  });

  it('refuse une scène sans étape', () => {
    expect(() => new Navigator([1, 0])).toThrow();
  });

  it("n'anime que l'avance d'exactement une étape", () => {
    const nav = new Navigator([2, 2, 1]);
    expect(isForwardStep({ scene: 0, step: 0 }, { scene: 0, step: 1 }, nav)).toBe(true);
    expect(isForwardStep({ scene: 0, step: 1 }, { scene: 1, step: 0 }, nav)).toBe(true);
    expect(isForwardStep({ scene: 0, step: 0 }, { scene: 1, step: 0 }, nav)).toBe(false);
    expect(isForwardStep({ scene: 1, step: 1 }, { scene: 1, step: 0 }, nav)).toBe(false);
    expect(isForwardStep({ scene: 0, step: 1 }, { scene: 2, step: 0 }, nav)).toBe(false);
    nav.skipped = new Set([1]);
    expect(isForwardStep({ scene: 0, step: 1 }, { scene: 2, step: 0 }, nav)).toBe(true);
  });
});

describe('resolveStep', () => {
  const s = scene([{ world: { explode: 1 } }, { world: { cutaway: 1 }, camera: 'motorCut' }, { world: { explode: 0 } }]);

  it('cumule les étapes 0..n sur la base et les valeurs par défaut', () => {
    expect(resolveStep(s, 1).world).toMatchObject({ explode: 1, cutaway: 1 });
    expect(resolveStep(s, 2).world).toMatchObject({ explode: 0, cutaway: 1 });
    expect(resolveStep(s, 2).camera).toBe('motorCut');
    expect(resolveStep(s, 0).camera).toBe('hero');
  });

  it('borne l’étape et ne modifie pas les valeurs par défaut', () => {
    expect(resolveStep(s, 99)).toEqual(resolveStep(s, 2));
    expect(DEFAULT_STATE.explode).toBe(0);
  });
});

describe('settledSpeed', () => {
  const base = { breaker: 1, contactor: 1, supplyL1: 1 as const, supplyL2: 1 as const, supplyL3: 1 as const, forceStop: 0 as const };
  it('tourne alimenté sur trois phases', () => expect(settledSpeed(base)).toBe(1));
  it('continue sur deux phases tant que la protection n’a pas agi', () => expect(settledSpeed({ ...base, supplyL3: 0 })).toBe(0.9));
  it("s'arrête quand le contacteur s'ouvre", () => expect(settledSpeed({ ...base, supplyL3: 0, contactor: 0 })).toBe(0));
  it("s'arrête quand le disjoncteur est ouvert", () => expect(settledSpeed({ ...base, breaker: 0 })).toBe(0));
});

import { describe, expect, it } from 'vitest';
import { SCENES } from '../../src/content/scenes';
import { LABELS } from '../../src/content/labels';
import { comparison, faults, gantt, ganttPeriods, identity, sensorCategories, smart, software } from '../../src/content/source';
import { resolveStep } from '../../src/core/state';
import { splitNotes } from '../../src/ui/shell';

/** Texte visible + notes, sans balises. */
const allText = SCENES.map((s) => `${s.title}\n${s.notes}\n${s.overlay.replace(/<[^>]+>/g, ' ')}`).join('\n');

describe('structure des scènes', () => {
  it('comporte 15 scènes aux identifiants uniques', () => {
    expect(SCENES).toHaveLength(15);
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(15);
  });

  it('a des notes de présentation découpées exactement par étape', () => {
    for (const s of SCENES) expect(splitNotes(s.notes), s.id).toHaveLength(s.steps.length);
  });

  it("n'utilise que des étiquettes définies", () => {
    for (const s of SCENES)
      for (let k = 0; k < s.steps.length; k++) for (const id of resolveStep(s, k).world.labels) expect(LABELS[id], `${s.id}:${id}`).toBeDefined();
  });

  it('termine le scénario de perte de phase sur l’arrêt et l’alarme, sans réarmement', () => {
    const sc = SCENES.find((s) => s.id === 'scenario')!;
    const last = resolveStep(sc, sc.steps.length - 1).world;
    expect(last).toMatchObject({ supplyL3: 0, contactor: 0, alarm: 1, lamp: 'fault' });
    for (const s of SCENES.slice(SCENES.indexOf(sc) + 1)) {
      // aucune scène suivante ne remet le moteur sous tension
      for (let k = 0; k < s.steps.length; k++) expect(resolveStep(s, k).world.contactor, s.id).toBe(0);
    }
  });
});

describe('fidélité au dossier source', () => {
  it('reprend exactement les valeurs du planificateur (11 périodes)', () => {
    expect(ganttPeriods).toBe(11);
    expect(gantt.map((t) => [t.planStart, t.planDuration, t.actualStart, t.actualDuration, t.percent])).toEqual([
      [1, 2, 1, 2, 100],
      [2, 1, 2, 1, 100],
      [3, 4, 3, 4, 100],
      [5, 6, undefined, undefined, undefined],
      [3, 8, undefined, undefined, undefined],
      [10, 2, undefined, undefined, undefined],
    ]);
  });

  it("conserve l'objectif temporel de six semaines et le contacteur dans SMART", () => {
    expect(smart.find((s) => s.letter === 'T')!.text).toContain('six semaines');
    expect(smart.find((s) => s.letter === 'A')!.text).toContain('contacteur');
    expect(smart.map((s) => s.text).join(' ')).not.toMatch(/conducteur/i);
  });

  it('liste les cinq défauts et les quatre catégories de capteurs', () => {
    expect(faults).toEqual(['Surcharge', 'Perte de phase', 'Surchauffe', 'Vibration anormale', 'Tension anormale']);
    expect(sensorCategories).toEqual(['Courant', 'Tension', 'Température', 'Vibration']);
  });

  it('attribue aux logiciels leur rôle déclaré', () => {
    expect(software.map((s) => `${s.name}: ${s.role}`)).toEqual([
      'TIA Portal: Programmation du PLC',
      'PLCSIM: Simulation du programme',
      'CADe_SIMU: Simulation du circuit électrique',
    ]);
  });

  it('reprend les trois solutions du tableau comparatif', () => {
    expect(comparison.map((c) => c.solution)).toEqual(['Protection classique', 'Relais électronique', 'Protection intelligente']);
  });

  it("préserve les noms de l'équipe et de l'établissement", () => {
    expect(identity.authors).toEqual(['Laabidi Emna', 'Ben Romdhane Yassine']);
    expect(identity.supervisor).toBe('Madame Ayedi Mounira');
    expect(identity.academicYear).toBe('Année universitaire 2026-2027');
    expect(allText).toContain('Laabidi Emna');
  });
});

describe("garde-fous contre l'invention de données", () => {
  it('ne présente pas le bouton comme un arrêt d’urgence', () => {
    expect(allText).not.toMatch(/arr[êe]t d.urgence/i);
    expect(allText).toContain('Bouton d’arrêt');
  });

  it('ne contient aucune valeur électrique, thermique ou temporelle chiffrée', () => {
    const units = /\b\d+(?:[.,]\d+)?\s?(?:V|kV|mV|A|mA|kA|W|kW|Hz|°C|K|ms|s|min|tr\/min|rpm|mm\/s|g)\b/;
    expect(allText).not.toMatch(units);
  });

  it("n'invente ni modèle d'automate ni adresse d'entrée/sortie", () => {
    expect(allText).not.toMatch(/S7-?\s?\d{3,4}|ET\s?200|LOGO!/i);
    expect(allText).not.toMatch(/\b[IQ]\s?\d+\.\d\b|%[IQM]\d/);
  });

  it('ne mentionne plus le dimensionnement des constituants', () => {
    expect(allText).not.toMatch(/dimensionnement/i);
  });

  it('signale le schéma comme non validé pour câblage', () => {
    expect(allText).toContain('Non validé pour câblage');
    expect(allText).toContain('repères illustratifs');
  });
});

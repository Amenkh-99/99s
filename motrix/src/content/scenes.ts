import type { SceneDef, WorldState } from '../core/state';
import logoUrl from '../assets/logo-iset.jpg';
import {
  chainStrip,
  comparisonGrid,
  faultMatrix,
  functionsList,
  ganttChart,
  ICONS,
  loopDiagram,
  prov,
  schemaDiagram,
  smartCards,
  softwareFlow,
  sourceChainStrip,
} from './overlays';
import { consequences, faults, generalObjective, identity, problemQuestion, sensorCategories } from './source';

export interface Scene extends SceneDef {
  /** Contenu HTML superposé. data-step="n" : visible à partir de l'étape n ; data-only="n" : uniquement à l'étape n. */
  overlay: string;
}

/** Fonctionnement normal du banc (moteur alimenté). */
const RUNNING: Partial<WorldState> = {
  bench: 1,
  breaker: 1,
  contactor: 1,
  flows: 1,
  plc: 'run',
  lamp: 'normal',
  dim: 0,
  explode: 0,
  cutaway: 0,
  field: 0,
  heat: 0,
  forceStop: 0,
  motorTimeScale: 1,
};

/** Arrière-plan des scènes de synthèse : banc retiré, moteur à l'arrêt (aucun réarmement simulé). */
const BACKDROP: Partial<WorldState> = {
  bench: 0,
  breaker: 0,
  contactor: 0,
  flows: 0,
  signals: 0,
  command: 0,
  alarm: 0,
  lamp: 'off',
  plc: 'idle',
  phaseBreak: 0,
  supplyL3: 1,
  explode: 0,
  cutaway: 0,
  field: 0,
  heat: 0,
  forceStop: 0,
  motorTimeScale: 1,
};

const SCENARIO_STEPS = [
  'Fonctionnement normal',
  'Une phase devient indisponible',
  'Condition anormale signalée',
  'Décision de protection',
  "Ouverture du contacteur",
  'Le flux de puissance s’arrête',
  'Le moteur ralentit',
  'Défaut signalé et alarme',
];

const scenarioList = SCENARIO_STEPS.map((s, i) => `<li data-hl="${i}"><span class="sc-n">${i + 1}</span>${s}</li>`).join('');

const status = (tone: 'normal' | 'warning' | 'fault', icon: string, text: string, step: number) =>
  `<p class="status status--${tone}" data-only="${step}">${icon}<span>${text}</span></p>`;

export const SCENES: Scene[] = [
  // 1 ────────────────────────────────────────────────────────────────
  {
    id: 'ouverture',
    title: 'MOTRIX',
    chapter: 'Introduction',
    camera: 'hero',
    base: { ...RUNNING, bench: 0, flows: 0, lamp: 'off', plc: 'idle' },
    steps: [{ camera: 'hero' }, { camera: 'heroWide', world: { dim: 0.45 } }],
    notes:
      "Bonjour. Nous vous présentons MOTRIX, un système de protection intelligente pour un moteur asynchrone triphasé, réalisé par Laabidi Emna et Ben Romdhane Yassine sous l'encadrement de Madame Ayedi Mounira. [Étape suivante] Nous présentons d'abord le planning du projet, puis le problème, le moteur, nos objectifs et la comparaison des solutions, le système, un scénario de défaut, la conception et la conclusion.",
    overlay: `
      <div class="plate" data-until="0">
        <div class="plate__head">
          <img src="${logoUrl}" alt="Logo de l'ISET de Radès" class="plate__logo" width="72" height="72">
          <div>
            <p class="plate__inst">${identity.institute}</p>
            <p class="plate__meta">${identity.academicYear}</p>
          </div>
        </div>
        <h1 class="plate__title">MOTRIX</h1>
        <p class="plate__subtitle">${identity.subtitle}</p>
        <dl class="plate__fields">
          <div><dt>Formation</dt><dd>${identity.program}</dd></div>
          <div><dt>Réalisé par</dt><dd>${identity.authors.join(' et ')}</dd></div>
          <div><dt>Encadré par</dt><dd>${identity.supervisor}</dd></div>
        </dl>
        <p class="plate__foot">${identity.ministry}<br>${identity.direction}</p>
      </div>
      <div class="panel" data-step="1">
        <h2 class="scene-title">Sommaire</h2>
        <ol class="toc">
          <li><span>Planning</span><em>2</em></li>
          <li><span>Problématique</span><em>3</em></li>
          <li><span>Le moteur asynchrone triphasé</span><em>4</em></li>
          <li><span>Objectifs et comparaison des solutions</span><em>5–6</em></li>
          <li><span>Le système : architecture, puissance, mesure, décision</span><em>7–10</em></li>
          <li><span>Défauts : scénario de perte de phase, matrice</span><em>11–12</em></li>
          <li><span>Conception : schéma de principe, logiciels</span><em>13–14</em></li>
          <li><span>Conclusion</span><em>15</em></li>
        </ol>
      </div>`,
  },
  // 2 ────────────────────────────────────────────────────────────────
  {
    id: 'planning',
    title: 'Planning',
    chapter: 'Introduction',
    camera: 'backdrop',
    base: { ...BACKDROP, dim: 0.92 },
    steps: [{}, {}],
    notes:
      "Notre planificateur comprend six tâches, de la préparation du cahier des charges jusqu'à la soutenance. L'axe compte onze périodes, dont l'unité n'est pas précisée dans le document. [Étape suivante] Les trois premières tâches sont réalisées à cent pour cent ; l'avancement des autres n'y est pas renseigné. Notre objectif temporel SMART reste de six semaines.",
    overlay: `
      <div class="wide">
        <div class="title-row">
          <h2 class="scene-title">Planning</h2>
          <p class="smart-note">Objectif temporel (SMART) : <strong>six semaines</strong></p>
        </div>
        ${ganttChart()}
        <ul class="legend legend--row">
          <li><span class="sw-bar sw-bar--plan"></span>Prévu</li>
          <li data-step="1"><span class="sw-bar sw-bar--act"></span>Réel (100 % accompli)</li>
          <li><span class="gt-na-key">—</span>Non renseigné dans le document</li>
        </ul>
        <p class="provs">${prov.src('Tâches et valeurs : planificateur du dossier')}</p>
      </div>`,
  },
  // 3 ────────────────────────────────────────────────────────────────
  {
    id: 'problematique',
    title: 'Problématique',
    chapter: 'Introduction',
    camera: 'problem',
    base: { ...RUNNING, bench: 0, flows: 0, lamp: 'off', plc: 'idle' },
    steps: [
      { world: { labels: ['p.surcharge', 'p.phase', 'p.chauffe', 'p.vibration', 'p.tension'] } },
      {
        world: { heat: 1, forceStop: 1, labels: [] },
        durations: { heat: 4.2 },
        delays: { forceStop: 2.8 },
      },
      {},
    ],
    notes:
      "Un moteur peut subir cinq défauts : surcharge, perte de phase, surchauffe, vibration anormale et tension anormale. [Étape suivante] Sans protection, la conséquence est une chaîne : échauffement, dégradation de l'isolant, arrêt, puis panne. [Étape suivante] D'où notre question : comment détecter rapidement ces défauts et protéger le moteur ?",
    overlay: `
      <div class="panel">
        <h2 class="scene-title">Un moteur exposé à plusieurs défauts</h2>
        <ul class="fault-list">${faults.map((f) => `<li>${ICONS.warn}${f}</li>`).join('')}</ul>
        <div data-step="1" class="cascade-block">
          <h3 class="kicker">Conséquences</h3>
          ${chainStrip(consequences, 'chain--cascade')}
        </div>
        <p class="provs">${prov.src()} <span data-step="1">${prov.ill('Échauffement simulé à titre d’illustration')}</span></p>
      </div>
      <blockquote class="question" data-step="2">
        <p>${problemQuestion}</p>
      </blockquote>`,
  },
  // 4 ────────────────────────────────────────────────────────────────
  {
    id: 'moteur',
    title: 'Le moteur asynchrone triphasé',
    chapter: 'Contexte technique',
    camera: 'motorSide',
    base: { ...RUNNING, bench: 0, flows: 0, lamp: 'off', plc: 'idle' },
    steps: [
      { world: { labels: ['m.frame', 'm.box', 'm.shaft', 'm.cover'] } },
      {
        camera: 'motorExplode',
        world: {
          explode: 1,
          labels: ['m.frame', 'm.stator', 'm.rotor', 'm.shaft', 'm.bearing', 'm.shield', 'm.fan', 'm.cover', 'm.box'],
        },
        durations: { explode: 2.6 },
      },
      {
        camera: 'motorCut',
        world: { explode: 0, cutaway: 1, field: 1, motorTimeScale: 0.22, labels: ['f.field', 'f.coils', 'm.rotor'] },
        durations: { explode: 1.6, cutaway: 1.6, field: 1.2, motorTimeScale: 1.5 },
        delays: { cutaway: 1.4, field: 2.6, motorTimeScale: 1.0 },
      },
    ],
    notes:
      "Rappel général, indépendant de notre matériel. Le moteur asynchrone comporte une carcasse ailetée, un stator bobiné et un rotor à cage. [Étape suivante] Vue éclatée : stator, rotor, arbre, roulements, flasques, ventilateur et boîte à bornes. [Étape suivante] Trois enroulements décalés de 120°, alimentés en triphasé, créent un champ tournant ; le rotor le suit un peu moins vite : c'est le glissement. Sans une phase, ce champ se déséquilibre : le moteur absorbe plus de courant et chauffe.",
    overlay: `
      <div class="panel">
        <h2 class="scene-title">Le moteur asynchrone triphasé</h2>
        <p class="lede" data-until="0">Le moteur à protéger : robuste, simple, omniprésent dans l’industrie. Son fonctionnement explique pourquoi chaque défaut est dangereux.</p>
        <p class="lede" data-only="1">Vue éclatée des principaux constituants.</p>
        <div data-step="2">
          <p class="lede">Trois enroulements décalés de 120°, alimentés par un réseau triphasé, créent un <strong>champ magnétique tournant</strong>. Le rotor est entraîné un peu moins vite que le champ : c’est le glissement, d’où le nom « asynchrone ».</p>
          <p class="lede">Si une phase manque, ce champ n’est plus équilibré : le moteur absorbe davantage de courant et s’échauffe.</p>
          <ul class="legend">
            <li><span class="sw-line sw-line--cyan"></span>Champ tournant</li>
            <li><span class="sw-line sw-line--white"></span>Repère du rotor</li>
          </ul>
          <p class="fine">Vitesses ralenties et écart volontairement exagéré pour la lecture.</p>
        </div>
        <p class="provs">${prov.gen('Principe général — modèle 3D illustratif, pas le matériel du projet')}</p>
      </div>`,
  },
  // 5 ────────────────────────────────────────────────────────────────
  {
    id: 'objectifs',
    title: 'Objectifs',
    chapter: 'Objectifs',
    camera: 'backdrop',
    base: { ...RUNNING, bench: 0, flows: 0, lamp: 'off', plc: 'idle', dim: 0.86 },
    steps: [{}, {}, {}],
    notes:
      "Notre objectif général : concevoir une protection intelligente capable de surveiller un moteur triphasé, de détecter les anomalies et de commander son arrêt en cas de défaut. Le principe tient en quatre temps : mesurer, détecter, décider, protéger. [Étape suivante] Concrètement, le système doit assurer sept fonctions, de la mesure du courant jusqu'à l'alarme. [Étape suivante] Nos objectifs SMART, dont la durée prévue de six semaines.",
    overlay: `
      <div class="wide">
        <h2 class="scene-title">Objectifs</h2>
        <div class="obj-grid">
          <div data-until="0" class="obj-main">
            <p class="lede lede--xl">${generalObjective}</p>
            ${loopDiagram()}
          </div>
          <div data-only="1" class="obj-fn">
            <h3 class="kicker">Le système doit permettre de</h3>
            ${functionsList()}
          </div>
          <div data-only="2">${smartCards()}</div>
        </div>
        <p class="provs">${prov.src()}</p>
      </div>`,
  },
  // 6 ────────────────────────────────────────────────────────────────
  {
    id: 'comparaison',
    title: 'Comparaison des solutions',
    chapter: 'Objectifs',
    camera: 'backdrop',
    base: { ...BACKDROP, dim: 0.9 },
    steps: [{}, {}, {}],
    notes:
      "Trois solutions sont comparées. La protection classique, disjoncteur et relais thermique : simple, fiable et économique, mais avec peu de surveillance. [Étape suivante] Le relais électronique mesure le courant et détecte les défauts : plus précis, mais plus coûteux. [Étape suivante] La protection intelligente ajoute capteurs, automate et alarme : surveillance en temps réel et arrêt automatique, au prix d'une conception plus complexe et d'une programmation.",
    overlay: `
      <div class="wide">
        <h2 class="scene-title">Comparaison des solutions</h2>
        ${comparisonGrid()}
        <p class="provs">${prov.src('Tableau comparatif : dossier du projet')}</p>
      </div>`,
  },
  // 7 ────────────────────────────────────────────────────────────────
  {
    id: 'architecture',
    title: 'Architecture du système',
    chapter: 'Le système',
    camera: 'benchWide',
    base: { ...RUNNING, breaker: 0, contactor: 0, flows: 0, lamp: 'off', plc: 'idle' },
    steps: [
      { world: { labels: ['b.supply', 'b.q1', 'b.km1', 'b.rt1', 'b.motor'] }, durations: { bench: 3.4 } },
      { camera: 'sensors', world: { labels: ['s.i', 's.u', 's.t', 's.v'] } },
      { camera: 'panel', world: { labels: ['b.plc', 'b.lamps', 'b.stop', 'b.q1', 'b.km1', 'b.rt1'] } },
    ],
    notes:
      "Voici l'installation étudiée. Le circuit de puissance : arrivée triphasée, disjoncteur, contacteur, relais thermique, puis le moteur. [Étape suivante] Quatre catégories de capteurs : courant, tension, température et vibration. Leurs modèles et emplacements ne sont pas fixés dans notre dossier : la 3D les représente de façon illustrative. [Étape suivante] Le pilotage est confié à un automate Siemens, avec des voyants et un bouton d'arrêt.",
    overlay: `
      <div class="panel">
        <h2 class="scene-title">Architecture du système</h2>
        <div data-only="0">
          <h3 class="kicker">Circuit de puissance</h3>
          ${chainStrip(['Arrivée triphasée', 'Disjoncteur', 'Contacteur', 'Relais thermique', 'Moteur'], 'chain--vertical')}
        </div>
        <div data-only="1">
          <h3 class="kicker">Quatre catégories de capteurs</h3>
          <ul class="chips-row">${sensorCategories.map((s) => `<li class="chip">${s}</li>`).join('')}</ul>
          <p class="provs">${prov.ill('Types, modèles et emplacements non documentés : représentation illustrative')}</p>
        </div>
        <div data-only="2">
          <h3 class="kicker">Commande et signalisation</h3>
          <ul class="plain-list">
            <li>Automate programmable (PLC Siemens)</li>
            <li>Voyants</li>
            <li>Bouton d’arrêt</li>
          </ul>
          <p class="provs">${prov.ill('Modèle d’automate, câblage et couleurs non documentés')}</p>
        </div>
        <p class="provs">${prov.src('Liste du matériel : dossier du projet')}</p>
      </div>`,
  },
  // 8 ────────────────────────────────────────────────────────────────
  {
    id: 'puissance',
    title: 'Flux de puissance triphasé',
    chapter: 'Le système',
    camera: 'panel',
    base: { ...RUNNING, breaker: 0, contactor: 0, flows: 1, lamp: 'off', plc: 'idle' },
    steps: [
      { world: { breaker: 1, labels: ['c.L1', 'c.L2', 'c.L3', 'b.q1', 'b.km1'] }, delays: { breaker: 1.2 }, durations: { breaker: 0.35 } },
      {
        camera: 'powerRun',
        world: { contactor: 1, lamp: 'normal', plc: 'run', labels: ['b.km1', 'b.rt1', 'c.L1b', 'c.L2b', 'c.L3b', 'b.motor'] },
        delays: { contactor: 1.0, lamp: 1.2, plc: 0.6 },
        durations: { contactor: 0.25 },
      },
      { camera: 'cableToMotor', world: { labels: ['c.L1b', 'c.L2b', 'c.L3b', 'b.motor'] } },
    ],
    notes:
      "Suivons l'énergie. Les trois phases L1, L2 et L3 arrivent sur le disjoncteur ; quand il se ferme, elles atteignent le contacteur. [Étape suivante] Le contacteur se ferme : l'énergie traverse le relais thermique et le moteur démarre. [Étape suivante] Le moteur est alimenté. Les animations cyan sont un code de présentation : elles ne représentent pas la couleur réelle des conducteurs.",
    overlay: `
      <div class="panel">
        <h2 class="scene-title">Flux de puissance triphasé</h2>
        <p class="lede" data-only="0">Les phases L1, L2 et L3 arrivent sur le disjoncteur. Fermé, il les transmet jusqu’au contacteur.</p>
        <p class="lede" data-only="1">Le contacteur se ferme : l’énergie traverse le relais thermique et le moteur démarre.</p>
        <div data-only="2">
          <p class="lede">Le moteur est alimenté par ses trois phases.</p>
          ${chainStrip(['Réseau triphasé', 'Disjoncteur', 'Contacteur', 'Relais thermique', 'Moteur'], 'chain--vertical chain--live')}
        </div>
        <p class="provs">${prov.ill('Animation : code de présentation, pas les couleurs réelles des conducteurs')}</p>
      </div>`,
  },
  // 9 ────────────────────────────────────────────────────────────────
  {
    id: 'mesure',
    title: 'Chaîne de mesure',
    chapter: 'Le système',
    camera: 'sensors',
    base: { ...RUNNING, signals: 0 },
    steps: [
      { world: { labels: ['s.i', 's.u', 's.t', 's.v'] } },
      { world: { signals: 1, labels: ['s.i', 's.u', 's.t', 's.v', 'b.plc'] }, durations: { signals: 1.2 } },
      { world: { signals: 1, labels: ['b.plc'] } },
    ],
    notes:
      "La protection commence par la mesure continue de quatre grandeurs : courant, tension, température et vibration. [Étape suivante] Les capteurs transmettent leurs signaux à l'automate. [Étape suivante] Ces jauges sont purement qualitatives : aucune valeur ni aucun seuil n'est défini dans notre dossier à ce stade.",
    overlay: `
      <div class="panel">
        <h2 class="scene-title">Chaîne de mesure</h2>
        <p class="lede" data-only="0">Quatre grandeurs surveillées en continu.</p>
        <p class="lede" data-only="1">Les capteurs transmettent leurs signaux à l’automate.</p>
        <div data-only="2" class="gauges" aria-label="Jauges qualitatives, sans valeur">
          ${sensorCategories
            .map(
              (s, i) => `<div class="gauge" style="--i:${i}">
                <span class="gauge__name">${s}</span>
                <span class="gauge__track"><span class="gauge__zone gauge__zone--n"></span><span class="gauge__zone gauge__zone--w"></span><span class="gauge__zone gauge__zone--f"></span><span class="gauge__needle"></span></span>
              </div>`,
            )
            .join('')}
          <p class="gauge-legend"><span>zone normale</span><span>vigilance</span><span>anomalie</span></p>
          <p class="provs">${prov.ill('Illustration qualitative : aucune valeur mesurée, aucun seuil défini')}</p>
        </div>
        <p class="provs">${prov.src('Grandeurs surveillées : dossier du projet')}</p>
      </div>`,
  },
  // 10 ───────────────────────────────────────────────────────────────
  {
    id: 'decision',
    title: 'Séquence de protection',
    chapter: 'Le système',
    camera: 'plc',
    base: { ...RUNNING, signals: 1 },
    steps: [
      { camera: 'sensors', world: { labels: ['s.i', 's.u', 's.t', 's.v'] } },
      { camera: 'plc', world: { labels: ['b.plc'] } },
      { camera: 'plc', world: { labels: ['b.plc'] } },
      { camera: 'contactor', world: { command: 1, labels: ['cmd.km', 'b.km1'] } },
      { camera: 'alarm', world: { command: 1, labels: ['b.lamps', 'b.stop'] } },
    ],
    notes:
      "La protection suit cinq étapes. Une mesure continue. [Étape suivante] La détection : l'automate compare les grandeurs à des critères de défaut, qui restent à définir. [Étape suivante] La décision : le programme, développé sous TIA Portal, détermine s'il faut protéger. [Étape suivante] La commande de protection agit sur le contacteur. [Étape suivante] Résultat : arrêt du moteur et alarme. C'est le principe ; le scénario suivant le montre en action.",
    overlay: `
      <div class="panel">
        <h2 class="scene-title">Séquence de protection</h2>
        <p class="lede" data-only="0">Les quatre grandeurs sont mesurées en continu.</p>
        <p class="lede" data-only="1">L’automate compare les mesures à des critères de défaut. Ces critères ne sont pas encore définis dans le dossier.</p>
        <p class="lede" data-only="2">Le programme de l’automate décide de déclencher la protection.</p>
        <p class="lede" data-only="3">La commande de protection agit sur le contacteur.</p>
        <p class="lede" data-only="4">Le moteur est arrêté et l’alarme est déclenchée.</p>
        <p class="provs">${prov.ill('Séquence de principe — le programme réel n’est pas documenté')}</p>
      </div>
      <ol class="pipeline" aria-label="Séquence de protection">
        ${['Mesure continue', 'Détection du défaut', 'Décision du PLC', 'Commande de protection', 'Arrêt du moteur et alarme']
          .map((s, i) => `<li class="pipeline__step" data-hl="${i}"><span class="pipeline__n">${i + 1}</span><span>${s}</span></li>`)
          .join('')}
      </ol>`,
  },
  // 11 ───────────────────────────────────────────────────────────────
  {
    id: 'scenario',
    title: 'Scénario : perte de phase',
    chapter: 'Défauts',
    camera: 'scenarioWide',
    base: { ...RUNNING, signals: 1, command: 0, alarm: 0, supplyL3: 1, phaseBreak: 0 },
    steps: [
      { world: { labels: ['b.motor', 'b.plc'] } },
      { camera: 'supplyTop', world: { supplyL3: 0, phaseBreak: 1, labels: ['c.break', 'c.L1', 'c.L2'] }, delays: { supplyL3: 1.0, phaseBreak: 1.0 }, durations: { phaseBreak: 0.4 } },
      { camera: 'scenarioWide', world: { signalTone: 'warning', plc: 'warning', lamp: 'warning', labels: ['b.plc', 'c.break'] }, delays: { signalTone: 0.8, plc: 1.3, lamp: 1.6 } },
      { camera: 'plc', world: { plc: 'fault', labels: ['b.plc'] }, delays: { plc: 1.0 } },
      {
        camera: 'contactor',
        world: { command: 1, commandTone: 'fault', contactor: 0, labels: ['b.km1', 'cmd.km'] },
        delays: { command: 0.9, commandTone: 0.9, contactor: 2.0 },
        durations: { command: 0.4, contactor: 0.22 },
      },
      { camera: 'powerRun', world: { labels: ['b.km1', 'c.L1b', 'c.L2b', 'c.L3b', 'b.motor'] } },
      { camera: 'motorStop', world: { labels: ['b.motor'] } },
      { camera: 'alarm', world: { lamp: 'fault', alarm: 1, labels: ['b.lamps', 'alarm'] }, delays: { lamp: 0.6, alarm: 0.9 } },
    ],
    notes:
      "Scénario illustratif : perte de phase. Le moteur fonctionne normalement sur ses trois phases. [Étape suivante] La phase L3 devient indisponible ; un moteur lancé continue de tourner, mais dans des conditions anormales. [Étape suivante] Une condition anormale est signalée à l'automate. [Étape suivante] L'automate prend la décision de protéger. [Étape suivante] La commande ouvre le contacteur. [Étape suivante] En aval du contacteur, le circuit n'est plus alimenté ; L1 et L2 restent présentes en amont. [Étape suivante] Privé d'énergie, le moteur ralentit puis s'arrête. [Étape suivante] Le défaut est signalé et l'alarme déclenchée. La séquence s'arrête ici : aucune procédure de réarmement n'est documentée.",
    overlay: `
      <div class="panel panel--scenario">
        <h2 class="scene-title">Scénario : perte de phase</h2>
        <ol class="sc-list" aria-label="Étapes du scénario">${scenarioList}</ol>
        <div class="sc-speed" data-step="4">
          <span class="sc-speed__label">Rotation du moteur</span>
          <span class="sc-speed__track"><span class="sc-speed__fill" data-live="speed"></span></span>
          <span class="fine">indication visuelle, sans valeur</span>
        </div>
        <p class="provs">${prov.ill('Scénario fonctionnel illustratif — pas une reproduction validée du programme ; seuils, temps de réponse et logique de détection non documentés')}</p>
      </div>
      <div class="sc-status" aria-live="polite">
        ${status('normal', ICONS.ok, 'Fonctionnement normal', 0)}
        ${status('warning', ICONS.warn, 'Phase L3 indisponible', 1)}
        ${status('warning', ICONS.warn, 'Condition anormale signalée', 2)}
        ${status('fault', ICONS.fault, 'Décision de protection', 3)}
        ${status('fault', ICONS.fault, 'Ordre d’ouverture : contacteur ouvert', 4)}
        ${status('fault', ICONS.stop, 'Aval du contacteur hors tension', 5)}
        ${status('fault', ICONS.stop, 'Moteur en ralentissement', 6)}
        ${status('fault', ICONS.bell, 'Moteur arrêté : défaut signalé, alarme', 7)}
      </div>
      <aside class="compare-card" data-step="7" aria-label="Comparaison fonctionnement normal et défaut">
        <h3>Avant / après</h3>
        <table>
          <thead><tr><th></th><th>Normal</th><th>Défaut</th></tr></thead>
          <tbody>
            <tr><th scope="row">Phases</th><td>L1, L2, L3</td><td>L3 indisponible</td></tr>
            <tr><th scope="row">Contacteur</th><td>fermé</td><td>ouvert</td></tr>
            <tr><th scope="row">Moteur</th><td>en rotation</td><td>arrêté</td></tr>
            <tr><th scope="row">Signalisation</th><td>${ICONS.ok} normal</td><td>${ICONS.fault} défaut, alarme</td></tr>
          </tbody>
        </table>
      </aside>`,
  },
  // 12 ───────────────────────────────────────────────────────────────
  {
    id: 'matrice',
    title: 'Défauts et grandeurs surveillées',
    chapter: 'Défauts',
    camera: 'backdrop',
    base: { ...BACKDROP, dim: 0.86 },
    steps: [{}, {}],
    notes:
      "Notre dossier liste cinq défauts et quatre catégories de capteurs, mais il ne fixe pas quel capteur détecte quel défaut. [Étape suivante] Voici une correspondance que nous proposons, par exemple le courant pour la surcharge. Elle est conceptuelle et devra être vérifiée.",
    overlay: `
      <div class="wide">
        <h2 class="scene-title">Défauts et grandeurs surveillées</h2>
        <div class="matrix-wrap">
          ${faultMatrix()}
          <div class="matrix-side">
            <p class="lede">Cinq défauts étudiés, quatre catégories de capteurs : le dossier ne précise pas quel capteur détecte quel défaut.</p>
            <div data-step="1">
              <p class="legend-row"><span class="mx-mark mx-mark--legend" aria-hidden="true"></span>Correspondance proposée</p>
              <p class="provs">${prov.ill('Proposition conceptuelle, non confirmée par le dossier — à vérifier')}</p>
            </div>
            <p class="provs">${prov.src('Défauts et capteurs : dossier du projet')}</p>
          </div>
        </div>
      </div>`,
  },
  // 13 ───────────────────────────────────────────────────────────────
  {
    id: 'schema',
    title: 'Schéma de principe',
    chapter: 'Conception',
    camera: 'backdrop',
    base: { ...BACKDROP, dim: 0.93 },
    steps: [{}, {}],
    notes:
      "Voici le schéma de principe. En puissance : réseau triphasé, disjoncteur Q1, contacteur KM1, relais thermique RT1 et moteur M1. [Étape suivante] En commande : les capteurs informent l'automate, qui commande la protection, c'est-à-dire l'ouverture du contacteur et l'alarme. Les repères sont illustratifs, et ce schéma n'est pas un schéma de câblage.",
    overlay: `
      <div class="wide">
        <div class="title-row">
          <h2 class="scene-title">Schéma de principe</h2>
          <p class="badge-warn">${ICONS.warn}Non validé pour câblage</p>
        </div>
        ${schemaDiagram()}
        <p class="provs">${prov.src('Constituants : dossier du projet')} ${prov.ill('Disposition, symboles et repères : illustratifs ; bornes, adresses d’E/S, calibres et câblage de la bobine non documentés')}</p>
      </div>`,
  },
  // 14 ───────────────────────────────────────────────────────────────
  {
    id: 'logiciels',
    title: 'Logiciels et simulation',
    chapter: 'Conception',
    camera: 'backdrop',
    base: { ...BACKDROP, dim: 0.9 },
    steps: [{}, {}],
    notes:
      "Trois logiciels encadrent l'étude. TIA Portal pour programmer l'automate, PLCSIM pour simuler ce programme sans matériel, et CADe_SIMU pour simuler le circuit électrique. [Étape suivante] La chaîne retenue dans notre dossier : capteurs, PLC, TIA Portal et PLCSIM, commande, moteur.",
    overlay: `
      <div class="wide">
        <h2 class="scene-title">Logiciels et simulation</h2>
        ${softwareFlow()}
        <div data-step="1" class="sw-chain">
          <h3 class="kicker">Chaîne indiquée dans le dossier</h3>
          ${sourceChainStrip()}
        </div>
        <p class="provs">${prov.src('Outils et rôles : dossier du projet')} ${prov.ill('Le dossier ne documente ni résultats de simulation ni essais')}</p>
        <p class="fine">Présentation d’origine réalisée avec Microsoft PowerPoint. Cette version web sert à la soutenance et ne fait pas partie du système de protection.</p>
      </div>`,
  },
  // 15 ───────────────────────────────────────────────────────────────
  {
    id: 'conclusion',
    title: 'Conclusion',
    chapter: 'Bilan',
    camera: 'finale',
    base: { ...BACKDROP, dim: 0.3 },
    steps: [{}, { world: { dim: 0.55 } }],
    notes:
      "Pour conclure, MOTRIX associe la protection classique, disjoncteur et relais thermique, à une surveillance par automate qui mesure, détecte, décide et protège. Les prochaines étapes : définir les seuils, choisir les capteurs, valider le câblage sous CADe_SIMU et tester le programme sous PLCSIM. [Étape suivante] Merci pour votre attention ; nous sommes prêts pour vos questions.",
    overlay: `
      <div class="panel" data-until="0">
        <h2 class="scene-title">Conclusion</h2>
        <ul class="plain-list plain-list--lg">
          <li>Une boucle de protection : mesurer, détecter, décider, protéger.</li>
          <li>La protection classique conservée, complétée par la surveillance d’un automate Siemens.</li>
          <li>Un environnement d’étude : TIA Portal, PLCSIM, CADe_SIMU.</li>
        </ul>
        <h3 class="kicker">Prochaines étapes</h3>
        <ul class="plain-list">
          <li>Définir les critères et seuils de protection.</li>
          <li>Choisir les capteurs et leur raccordement.</li>
          <li>Valider le schéma et le programme en simulation.</li>
        </ul>
      </div>
      <div class="thanks" data-step="1">
        <p class="thanks__title">Merci pour votre attention</p>
        <p class="thanks__names">${identity.authors.join(' et ')} — encadrés par ${identity.supervisor}</p>
        <p class="thanks__inst">${identity.institute}, ${identity.academicYear.toLowerCase()}</p>
      </div>`,
  },
];

/** Libellés courts pour la barre de progression et le menu. */
export const CHAPTERS = [...new Set(SCENES.map((s) => s.chapter))];

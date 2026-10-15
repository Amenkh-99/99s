/**
 * Données issues du dossier source « Protection-intelligente-dun-moteur-triphaseee.pptx ».
 * Chaque bloc indique la diapositive d'origine. Les seules modifications apportées sont
 * orthographiques ; elles sont listées dans SOURCES.md. Rien ici n'est inventé :
 * toute information absente du dossier source est absente de ce fichier.
 */

export const identity = {
  project: 'MOTRIX',
  subtitle: "Système de protection intelligente d'un moteur asynchrone triphasé",
  // Diapositive 1
  ministry: "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique",
  direction: 'Direction Générale des Études Technologiques',
  institute: 'Institut Supérieur des Études Technologiques de Radès',
  academicYear: 'Année universitaire 2026-2027',
  program: 'Mini-projet — Département génie électrique — L3GEEI2',
  authors: ['Laabidi Emna', 'Ben Romdhane Yassine'],
  supervisor: 'Madame Ayedi Mounira',
} as const;

/** Diapositive 6 — défauts étudiés, dans l'ordre du dossier. */
export const faults = [
  'Surcharge',
  'Perte de phase',
  'Surchauffe',
  'Vibration anormale',
  'Tension anormale',
] as const;

/** Diapositive 6 — conséquences. */
export const consequences = ['Échauffement', 'Dégradation', 'Arrêt', 'Panne'] as const;

/** Diapositive 6 — question de la problématique. */
export const problemQuestion = 'Comment détecter rapidement ces défauts et protéger le moteur ?';

/** Diapositive 8 — objectif général (orthographe corrigée). */
export const generalObjective =
  "Concevoir une solution de protection intelligente capable de surveiller un moteur triphasé, de détecter les anomalies et de commander son arrêt en cas de défaut.";

/** Diapositive 8 — boucle en quatre temps. */
export const loopSteps = ['Mesurer', 'Détecter', 'Décider', 'Protéger'] as const;

/** Diapositive 8 — fonctions attendues du système. */
export const systemFunctions = [
  'Mesurer le courant du moteur.',
  'Surveiller la tension.',
  'Contrôler la température.',
  'Détecter les vibrations anormales.',
  'Identifier les défauts.',
  'Arrêter automatiquement le moteur.',
  'Déclencher une alarme en cas de problème.',
] as const;

/** Diapositive 10 — objectifs SMART (« conducteur » corrigé en « contacteur »). */
export const smart = [
  { letter: 'S', label: 'Spécifique', text: 'Protéger un moteur triphasé' },
  { letter: 'M', label: 'Mesurable', text: 'Suivre I, U, température et vibration' },
  { letter: 'A', label: 'Atteignable', text: 'Utiliser des capteurs, un PLC et un contacteur' },
  { letter: 'R', label: 'Réaliste', text: 'Réduire les risques de panne' },
  { letter: 'T', label: 'Temporel', text: 'Réaliser le projet en six semaines' },
] as const;

/** Diapositive 12 — ressources matérielles. */
export const hardware = [
  'Moteur triphasé',
  'Disjoncteur',
  'Contacteur',
  'Relais thermique',
  'Capteurs : courant, tension, température, vibration',
  'PLC Siemens',
  "Voyants et bouton d'arrêt",
] as const;

/** Diapositive 12 — les quatre catégories de capteurs. */
export const sensorCategories = ['Courant', 'Tension', 'Température', 'Vibration'] as const;

/** Diapositive 12 — logiciels et rôle déclaré dans le dossier. */
export const software = [
  { name: 'TIA Portal', role: 'Programmation du PLC' },
  { name: 'PLCSIM', role: 'Simulation du programme' },
  { name: 'CADe_SIMU', role: 'Simulation du circuit électrique' },
] as const;

/** Diapositive 12 — logiciel utilisé pour la présentation d'origine (hors système de protection). */
export const originalPresentationTool = 'Microsoft PowerPoint';

/** Diapositive 12 — chaîne indiquée dans le dossier. */
export const sourceChain = ['Capteurs', 'PLC', 'TIA Portal / PLCSIM', 'Commande', 'Moteur'] as const;

/** Diapositive 14 — tableau comparatif, texte du dossier. */
export const comparison = [
  {
    solution: 'Protection classique',
    principle: 'Disjoncteur + relais thermique',
    advantages: 'Simple, fiable, économique',
    drawbacks: 'Peu de surveillance',
  },
  {
    solution: 'Relais électronique',
    principle: 'Mesure électronique du courant et détection des défauts',
    advantages: 'Plus précis, plusieurs protections',
    drawbacks: 'Coût plus élevé',
  },
  {
    solution: 'Protection intelligente',
    principle: 'Capteurs + PLC + contacteur + alarme',
    advantages: 'Surveillance en temps réel, détection rapide, arrêt automatique',
    drawbacks: 'Plus complexe, programmation nécessaire',
  },
] as const;

/** Diapositive 14 — chaîne simplifiée. */
export const comparisonChain = ['Capteur', 'PLC', 'Protection', 'Moteur'] as const;

export interface GanttTask {
  name: string;
  planStart: number;
  planDuration: number;
  actualStart?: number;
  actualDuration?: number;
  percent?: number;
}

/**
 * Diapositive 4 — planificateur. Valeurs numériques reprises telles quelles.
 * L'unité des périodes n'est pas précisée dans le document source.
 */
export const gantt: readonly GanttTask[] = [
  { name: 'Choix du mini-projet et préparation du cahier des charges', planStart: 1, planDuration: 2, actualStart: 1, actualDuration: 2, percent: 100 },
  { name: 'Validation du cahier des charges et étude bibliographique', planStart: 2, planDuration: 1, actualStart: 2, actualDuration: 1, percent: 100 },
  { name: 'Étude théorique et proposition des solutions possibles', planStart: 3, planDuration: 4, actualStart: 3, actualDuration: 4, percent: 100 },
  { name: 'Choix de la solution et réalisation', planStart: 5, planDuration: 6 },
  { name: 'Rédaction du rapport', planStart: 3, planDuration: 8 },
  { name: 'Soutenance', planStart: 10, planDuration: 2 },
];

/** Nombre de périodes affichées sur l'axe du planificateur d'origine. */
export const ganttPeriods = 11;

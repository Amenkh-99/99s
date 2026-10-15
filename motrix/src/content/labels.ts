/** Étiquettes 3D. dir = côté où s'affiche le texte par rapport à l'ancre. */
export type LabelDir = 'l' | 'r' | 't' | 'b';
export type LabelKind = 'part' | 'phase' | 'warn' | 'fault' | 'note';

export interface LabelDef {
  text: string;
  dir: LabelDir;
  kind?: LabelKind;
}

export const LABELS: Record<string, LabelDef> = {
  // anatomie du moteur (principe général)
  'm.frame': { text: 'Carcasse à ailettes', dir: 't' },
  'm.stator': { text: 'Stator : tôles et bobinage', dir: 'b' },
  'm.rotor': { text: "Rotor à cage d'écureuil", dir: 't' },
  'm.shaft': { text: 'Arbre', dir: 'r' },
  'm.bearing': { text: 'Roulement', dir: 'b' },
  'm.shield': { text: 'Flasque', dir: 't' },
  'm.fan': { text: 'Ventilateur', dir: 'b' },
  'm.cover': { text: 'Capot de ventilation', dir: 'b' },
  'm.box': { text: 'Boîte à bornes', dir: 't' },
  'f.field': { text: 'Champ tournant (illustration)', dir: 't' },
  'f.coils': { text: 'Trois enroulements décalés de 120°', dir: 'r' },
  // problématique
  'p.surcharge': { text: 'Surcharge', dir: 'r', kind: 'warn' },
  'p.phase': { text: 'Perte de phase', dir: 'l', kind: 'warn' },
  'p.chauffe': { text: 'Surchauffe', dir: 'l', kind: 'warn' },
  'p.vibration': { text: 'Vibration anormale', dir: 'b', kind: 'warn' },
  'p.tension': { text: 'Tension anormale', dir: 't', kind: 'warn' },
  // banc
  'b.supply': { text: 'Arrivée triphasée', dir: 'l' },
  'b.q1': { text: 'Disjoncteur', dir: 'r' },
  'b.km1': { text: 'Contacteur', dir: 'r' },
  'b.rt1': { text: 'Relais thermique', dir: 'r' },
  'b.motor': { text: 'Moteur asynchrone triphasé', dir: 't' },
  'b.plc': { text: 'Automate programmable Siemens', dir: 't' },
  'b.lamps': { text: 'Voyants', dir: 'r' },
  'b.stop': { text: "Bouton d'arrêt", dir: 'r' },
  's.i': { text: 'Capteur de courant', dir: 'b' },
  's.u': { text: 'Capteur de tension', dir: 'l' },
  's.t': { text: 'Capteur de température', dir: 't' },
  's.v': { text: 'Capteur de vibration', dir: 't' },
  'c.L1': { text: 'L1', dir: 'l', kind: 'phase' },
  'c.L2': { text: 'L2', dir: 't', kind: 'phase' },
  'c.L3': { text: 'L3', dir: 'r', kind: 'phase' },
  'c.L1b': { text: 'L1', dir: 'l', kind: 'phase' },
  'c.L2b': { text: 'L2', dir: 'b', kind: 'phase' },
  'c.L3b': { text: 'L3', dir: 'r', kind: 'phase' },
  'c.break': { text: 'L3 indisponible', dir: 'r', kind: 'fault' },
  'cmd.km': { text: 'Commande (principe)', dir: 'l', kind: 'note' },
  alarm: { text: 'Alarme', dir: 'r', kind: 'fault' },
};

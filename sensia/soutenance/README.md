# SENSIA — soutenance interactive en 3D

Présentation web de **SENSIA** (lunettes intelligentes pour personnes malvoyantes),
ISET Radès · Département Électrique · Classe L3 EI2 · 2026/2027.
Réalisé par **Mohamed Mokhtar MANNAI** et **Rawen TABOUBI**, encadré par **Mounira AYADI**.

Structure reprise du PowerPoint du projet (sommaire en 6 points), en 14 diapositives :

| # | Diapositive | Partie | Interaction |
|---|-------------|--------|-------------|
| 1 | Page de garde | — | lunettes 3D en rotation |
| 2 | Sommaire | — | clic sur une partie → y aller |
| 3 | Planificateur | 1 | Gantt prévu / réel animé, infobulle au survol |
| 4 | Problématique | 2 | — |
| 5 | Propositions des solutions possibles | 3 | canne blanche, chien guide, SENSIA (retenue) |
| 6 | Objectifs SMART | 4 | — |
| 7 | Principe de fonctionnement | 4 | chaîne Capteurs → ESP32 → Sorties → Utilisateur animée, 3 scénarios |
| 8 | **Vue 3D des lunettes** | 4 | rotation / zoom à la souris, vue éclatée, 9 pièces numérotées (clic = zoom), LED, ultrasons, comparaison avec la photo du prototype |
| 9 | Étude du matériel utilisé | 5 | 12 composants affichés en 3D sur le socle, fiche (rôle + pourquoi ce choix) |
| 10 | Logiciels et outils | 5 | liens vers les diapositives 11 et 12 |
| 11 | Schéma de câblage | 5 | zoom au clic sur le schéma Fritzing, tableau des broches filtrable |
| 12 | Extrait de programmation | 5 | code coloré, bouton Copier |
| 13 | Conclusion et perspectives | 6 | — |
| 14 | Merci / Questions | 6 | — |

## Ouvrir la présentation

Le plus simple : **`../../telechargement/SENSIA-soutenance-3D.html`**, un seul fichier à
ouvrir par double-clic (Three.js chargé depuis jsDelivr, il faut Internet).
Sans réseau le jour de la soutenance : **`SENSIA-soutenance-3D-hors-ligne.html`**.

Version modulaire (pour modifier le code) : depuis le dossier `sensia/` :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/soutenance/
```

Ouvrir directement une diapositive : `…/soutenance/#8`.
Qualité graphique forcée : `?qualite=haute`, `?qualite=moyenne` ou `?qualite=basse`
(sinon elle s'adapte toute seule à l'ordinateur).

## Commandes

| Action | Souris / tactile | Clavier |
|--------|------------------|---------|
| Diapositive suivante / précédente | flèches en bas à gauche, ou balayage | → / ← , Espace, Page suivante / précédente |
| Aller à une partie | bandeau du haut, ou le sommaire | — |
| Vue d'ensemble des diapositives | bouton **Diapositives** | O (Échap pour fermer) |
| Première / dernière diapositive | — | Début / Fin |
| Plein écran | bouton en bas à droite | F |
| Tourner / zoomer le modèle 3D (diapositives 8 et 9) | glisser / molette | — |

## Modifier le contenu

- Les textes sont dans `index.html` (une `<section class="slide">` par diapositive).
- Le planning est dans `js/gantt.js` (`TASKS`), le matériel et le tableau des broches dans
  `js/deck.js` (`KIT`, `PINS`), les cadrages de caméra dans `js/deck.js` (`SHOTS`).
- **Extrait de programme** : remplacez le contenu du bloc
  `<script type="text/plain" id="sensia-code">` dans `index.html` par votre vrai code.
- Mention de la page de garde : `PROJECT_KIND` en haut de `js/deck.js`
  (« Projet de fin d'études » ; le PowerPoint parle aussi de « mini-projet »).
- Après une modification, régénérez les fichiers uniques : `python3 tools/build.py soutenance`
  (depuis `sensia/`).

## Organisation

```
soutenance/
├── index.html        14 diapositives (contenu)
├── css/deck.css      mise en page 16:9, verre dépoli, transitions
├── js/deck.js        navigation, chapitres, vue d'ensemble, interactions
├── js/showroom.js    scène 3D unique : lunettes, vue éclatée, composants, plans de caméra
├── js/gantt.js       diagramme de Gantt (SVG)
└── assets/           images reprises du PowerPoint (logo ISET, photos, schéma, logiciels)
```

Les modèles 3D (lunettes, ESP32, HC-SR04, TCS3200, LDR, LED, bouton, DFPlayer, carte
mémoire, batterie, résistances, fils, écouteurs) sont partagés avec la présentation des
fonctions : `../js/models/`. Ils sont **illustratifs** (formes simplifiées, positions
conceptuelles).

## Points à vérifier avant la soutenance

- **GPIO18** est attribuée deux fois dans le tableau de câblage (TCS3200 S2 et DFPlayer TX).
  La diapositive 11 le signale ; corrigez le schéma ou retirez la remarque (`#pin-note`).
- L'image « Principe de fonctionnement » du PowerPoint indique **TCS34725** ; la
  présentation utilise **TCS3200**, comme le reste du dossier.
- Le PowerPoint dit « ultraviolets/ultrasons » pour le HC-SR04 : la présentation dit
  **ultrasons**.
- L'extrait de programme fourni est un **squelette indicatif**, non testé sur le matériel.
- La fluidité n'a pas pu être mesurée sur une vraie carte graphique : faites une
  répétition sur l'ordinateur de la soutenance.

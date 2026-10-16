# MOTRIX : présentation 3D interactive

Présentation de soutenance du mini-projet **MOTRIX : système de protection intelligente d'un moteur asynchrone triphasé** (ISET de Radès, L3GEEI2, 2026-2027).

Il s'agit d'une application web locale en plein écran, construite avec Vite, TypeScript, Three.js et GSAP. Elle comprend 15 scènes, un moteur 3D procédural, l'animation du flux triphasé, un scénario de perte de phase, le schéma de principe, la comparaison des solutions, le planning et des notes de présentation en français.

> Ce qui provient du dossier du projet, ce qui est illustratif et ce qui reste à valider est détaillé dans **[SOURCES.md](SOURCES.md)**.

---

## Utilisation sous Windows

**Prérequis :** [Node.js 20 LTS ou plus récent](https://nodejs.org/) et Google Chrome. Internet n'est nécessaire qu'une fois, pour l'installation.

### Avec les fichiers .bat (double-clic)

1. `installer.bat` : installe les dépendances (une seule fois).
2. `construire.bat` : produit la version hors ligne dans `dist\`.
3. `lancer-soutenance.bat` : démarre le serveur local et ouvre Chrome en plein écran sur `http://127.0.0.1:4173/`.

### En ligne de commande (PowerShell ou cmd, dans le dossier `motrix`)

```bat
npm ci
npm run build
npm run serve
```

Ouvrez ensuite `http://127.0.0.1:4173/` dans Chrome et appuyez sur **F** pour passer en plein écran.

Pour le développement (rechargement automatique) : `npm run dev`, puis `http://127.0.0.1:5173/`.

### Version fichier unique (à envoyer ou ouvrir d'un double-clic)

```bat
npm run build:single
```

Cette commande produit `dist-single\MOTRIX-presentation.html` (environ 1,4 Mo). Le code, les styles, les polices et le logo sont intégrés au fichier.

- Le fichier s'ouvre d'un double-clic dans Chrome, sans serveur ni connexion.
- On peut l'envoyer tel quel par e-mail ou par messagerie.
- La vue présentateur (V) n'y est pas disponible ; les notes (N) le sont.

### Vidéo MP4

```bat
npm run build:single
npm run video
```

Ces commandes enregistrent toute la présentation, image par image, dans `dist-video\MOTRIX-presentation.mp4`.

- **Format :** 1280 × 720, 24 images/s, environ 3 min 50, sans son. Pour du 1920 × 1080, utilisez `node scripts/record-video.mjs --dsf=1.5 --pr=0.75` (rendu plus long).
- **Prérequis :** `ffmpeg` (avec libx264) doit être installé et accessible dans le PATH.
- **Durée de rendu :** le temps de chaque étape est réglé dans `scripts/record-video.mjs` (tableau `HOLDS`). L'enregistrement est plus lent que le temps réel sur un ordinateur sans carte graphique.

> La version standard (`dist\index.html`) ne s'ouvre pas d'un double-clic : les navigateurs bloquent les modules JavaScript externes en `file://`. Utilisez le serveur local, ou la version fichier unique ci-dessus. Le serveur local `scripts/serve.mjs` n'utilise aucune dépendance, aucun service externe et aucun réseau.

---

## Commandes pendant la présentation

| Touche | Action |
|---|---|
| → / Espace / Pg↓ / Entrée | Étape suivante (compatible télécommandes de présentation) |
| ← / Pg↑ | Étape précédente |
| ↓ / ↑ | Scène suivante / précédente |
| Début / Fin | Première / dernière scène |
| 1–15 puis Entrée | Aller à une scène |
| G | Plan des scènes (décocher une scène pour l'ignorer pendant la soutenance) |
| N | Notes du présentateur (sous la scène) |
| V | Vue présentateur dans une seconde fenêtre (notes, scène suivante, chronomètre) |
| F | Plein écran |
| R | Mouvement réduit |
| Q | Qualité réduite (rendu allégé) |
| B | Écran noir |
| P | Indicateurs de performance (images/s, appels de rendu) |
| H | Aide |

Les mêmes fonctions sont accessibles avec la souris dans la barre du bas.

- **Navigation.** Avancer d'une étape joue l'animation. Reculer ou sauter place directement l'état stable de la cible, si bien que la scène est toujours identique, quel que soit le chemin.
- **Scènes ignorées.** Elles sont mémorisées dans le navigateur (G ou vue présentateur).
- **Mouvement réduit.** Il suit la préférence du système (« Afficher les animations » de Windows). La touche R l'active ou le désactive.
- **Fluidité.** Si l'ordinateur peine, le rendu s'allège automatiquement (un message l'indique ; la touche Q permet de revenir).

### Plan (environ 8 à 10 minutes)

1. Ouverture et sommaire
2. Problématique
3. Le moteur asynchrone triphasé (vue éclatée, écorché, champ tournant)
4. Objectifs (général, fonctions, SMART)
5. Architecture du système
6. Flux de puissance triphasé
7. Chaîne de mesure
8. Séquence de protection
9. Scénario : perte de phase
10. Défauts et grandeurs surveillées
11. Schéma de principe (non validé pour câblage)
12. Logiciels et simulation
13. Comparaison des solutions
14. Planning
15. Conclusion

---

## Dépannage

- **« WebGL n'est pas disponible ».** Dans Chrome, ouvrez Paramètres → Système, activez « Utiliser l'accélération graphique si disponible », puis relancez Chrome.
- **Port déjà utilisé.** Lancez `node scripts\serve.mjs 4174`, puis ouvrez `http://127.0.0.1:4174/`.
- **Saccades.** Appuyez sur **Q** (qualité réduite) et vérifiez avec **P** les images par seconde. Branchez l'ordinateur portable sur secteur et choisissez le mode d'alimentation « Performances optimales ».
- **Vue présentateur sans réaction.** Elle doit être ouverte depuis la présentation (touche V), dans le même navigateur.
- **`npm ci` échoue.** Le fichier `.npmrc` active `legacy-peer-deps`, qui contourne un défaut du résolveur de npm 10. Si l'erreur persiste, essayez `npm install`.

---

## Tests

```bat
npm test            :: tests unitaires (navigation, état, contenu et garde-fous)
npm run typecheck   :: vérification TypeScript
npm run build
npm run e2e         :: tests Playwright + captures dans tests\e2e\output\
```

- **Tests unitaires.** Ils vérifient notamment :
  - la navigation et le saut de scènes ;
  - le déterminisme de l'état ;
  - la fidélité des valeurs du planificateur ;
  - un découpage des notes qui correspond exactement aux étapes ;
  - l'absence de valeurs électriques chiffrées, de modèle d'automate, d'adresse d'E/S et de la mention « arrêt d'urgence ».
- **Tests de bout en bout.** Ils parcourent toute la présentation au clavier et vérifient :
  - le déterminisme ;
  - l'ouverture du contacteur, l'arrêt du flux aval et la décélération ;
  - la stabilité des ressources GPU ;
  - l'absence de requête externe et d'erreur console.

  Ils produisent aussi une capture de chaque étape. Sous Windows, pour utiliser Chrome installé : `set MOTRIX_E2E_CHANNEL=chrome` puis `npm run e2e`.

---

## Structure

```
motrix/
  index.html, presenter.html      pages (présentation, vue présentateur)
  src/main.ts                     démarrage, clavier, boucle de rendu, qualité adaptative
  src/core/state.ts               état déclaratif, navigation (pure, testée)
  src/core/director.ts            transitions GSAP (une chronologie à la fois)
  src/world/                      scène 3D : moteur procédural, armoire, conducteurs (shader), caméras
  src/content/source.ts           données reprises du dossier (avec n° de diapositive)
  src/content/scenes.ts           15 scènes : textes, étapes, notes
  src/content/overlays.ts         schéma, matrice, comparaison, planning, logiciels
  src/ui/                         étiquettes 3D, barre de contrôle, dialogues
  scripts/serve.mjs               serveur local hors ligne (sans dépendance)
  tests/                          tests unitaires (Vitest) et de bout en bout (Playwright)
  SOURCES.md                      traçabilité des informations
```

Polices Barlow et Barlow Condensed (licence SIL OFL) embarquées via `@fontsource`.

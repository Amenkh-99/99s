# SENSIA — présentation technique interactive en 3D

Présentation 16:9 en 10 diapositives des lunettes intelligentes **SENSIA**
(mini-projet L3 Électricité industrielle, classe L3 EI2, 2026/2027).
Les scènes 3D sont réalisées avec **Three.js** à partir de formes géométriques
simples : aucun modèle 3D externe, aucun service payant, aucune clé d'API.

| # | Diapositive | Contenu |
|---|-------------|---------|
| 1 | Présentation de SENSIA | Personne malvoyante portant les lunettes, étiquettes des composants, encart « perception réduite » |
| 2 | Problématique | Obstacles, couleurs, faible luminosité ; solutions possibles |
| 3 | Vue éclatée 3D | 10 composants numérotés, éclatement / assemblage, rotation à la souris |
| 4 | Schéma synoptique | Flux de données (cyan) et alimentation (ambre, pointillés) animés |
| 5 | Détection des obstacles | HC-SR04 → ESP32 → DFPlayer Mini → écouteurs : « Attention, il y a un obstacle devant vous. » |
| 6 | Détection de l'obscurité | LDR → ESP32 → deux LED aux extrémités de la monture (mode manuel avec curseur) |
| 7 | Identification de la couleur | Bouton → TCS3200 → ESP32 → DFPlayer Mini : « La couleur de l'objet est rouge. » (ou cube bleu) |
| 8 | Architecture électronique | Rôle de chaque module, outils (Arduino IDE, Fritzing) |
| 9 | Avantages et limites | Capacités décrites sans exagération, perspectives |
| 10 | Conclusion | Rappel des trois fonctions |

## Lancer la présentation

Les modules JavaScript doivent être servis par un serveur HTTP local
(l'ouverture directe du fichier `index.html` est bloquée par les navigateurs).
Depuis le dossier `sensia/` :

```bash
# Option 1 : Python 3 (déjà installé sur la plupart des machines)
python3 -m http.server 8000

# Option 2 : Node.js
npx http-server -p 8000
```

Puis ouvrir <http://localhost:8000> dans Chrome, Edge ou Firefox.
Three.js est inclus dans `vendor/` : la présentation fonctionne **sans connexion
Internet** (seules les polices Google Fonts sont alors remplacées par les polices système).

Pour ouvrir directement une diapositive : <http://localhost:8000/#5>.

## Commandes

| Action | Souris | Clavier |
|--------|--------|---------|
| Diapositive suivante / précédente | **Suivant** / **Précédent** | → / ← (ou Page suivante / précédente) |
| Lecture / Pause de l'animation | **Lecture / Pause** | Espace |
| Recommencer l'animation | **Recommencer** ou **Rejouer l'animation** | R |
| Plein écran | bouton plein écran | F |
| Voix on/off | bouton haut-parleur | S |
| Aller à une étape | clic sur une étape de la liste | Entrée sur l'étape |
| Tourner la vue éclatée | glisser sur le modèle (molette : zoom) | — |

Les messages vocaux sont lus par la synthèse vocale du navigateur (voix française
si elle est installée). Elle illustre le fichier audio que le DFPlayer Mini lirait
depuis la carte mémoire. Le texte est toujours affiché dans une bulle.

## Organisation du code

```
sensia/
├── index.html            diapositives, HUD, commandes
├── css/style.css         mise en page 16:9 (1600 × 900, mise à l'échelle automatique)
├── js/
│   ├── main.js           navigation, lecture/pause, clavier, plein écran
│   ├── engine.js         renderer WebGL, bloom, étiquettes HTML projetées
│   ├── util.js           interpolations, matériaux, textures générées
│   ├── models/           glasses.js, person.js, modules.js, props.js, effects.js
│   ├── scenes/           une vue 3D par diapositive (intro, exploded, obstacle, darkness, color, hero)
│   └── ui/               hud.js (jauges, chaînes), synoptic.js (schéma SVG), speech.js
├── vendor/three/         Three.js r170 (licence MIT) et modules complémentaires utilisés
└── assets/               photo du prototype (affichage de secours)
```

Chaque animation suit une **timeline déterministe** : on peut la mettre en pause,
la rejouer ou sauter à une étape sans incohérence.

Si WebGL n'est pas disponible, la zone 3D est remplacée par la photo du
prototype ; les étapes restent animées et cliquables.

## Précisions techniques (honnêteté du contenu)

- Le **modèle 3D est illustratif** : formes simplifiées, positions conceptuelles,
  échelle non respectée. Ce n'est pas un montage validé. L'ESP32, le DFPlayer Mini et
  la batterie sont représentés dans un boîtier séparé à la ceinture (position illustrative).
- Le **seuil de distance** et le **seuil de luminosité** sont décrits comme des valeurs
  réglables dans le programme ; aucune valeur numérique n'est affichée.
- Les **mesures du TCS3200** affichées sont des valeurs illustratives : la couleur
  reconnue dépend de l'éclairage, de la distance, du calibrage et de l'algorithme.
- Aucune broche GPIO, tension ou détail de câblage n'est représenté dans le synoptique.
- La présentation **n'a pas été testée sur le matériel réel** : elle explique le
  fonctionnement prévu. SENSIA est une aide complémentaire et ne remplace ni la canne
  blanche ni les aides de mobilité habituelles.

## Tests effectués

Testé dans Chromium (rendu logiciel SwiftShader) : navigation clavier et boutons,
les 10 diapositives, rejeu et saut d'étape, éclatement / assemblage, choix d'objet,
contrôle manuel de la lumière, redimensionnement (1600 × 900, 1280 × 720, 400 × 800),
affichage de secours sans WebGL. Aucune erreur dans la console.

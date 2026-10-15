# MOTRIX : sources, corrections et points non documentés

Ce document distingue ce qui provient du dossier du projet de ce qui a été ajouté pour la présentation. Il recense aussi les informations techniques qui manquent encore.

**Source unique :** `Protection-intelligente-dun-moteur-triphaseee.pptx` (17 diapositives).

Le texte, les notes et les images ont été extraits de ce fichier, et chaque diapositive a été convertie en image pour inspection. Les données reprises sont regroupées dans `src/content/source.ts`, avec la diapositive d'origine en commentaire. Les tests `tests/unit/content.test.ts` vérifient qu'elles n'ont pas dérivé.

---

## 1. Informations vérifiées (reprises du dossier)

| Élément | Diapositive | Où dans la présentation |
|---|---|---|
| Établissement, année universitaire 2026-2027, formation L3GEEI2, étudiants (Laabidi Emna, Ben Romdhane Yassine), encadrante (Madame Ayedi Mounira) | 1 | Scène 1 |
| Cinq défauts : surcharge, perte de phase, surchauffe, vibration anormale, tension anormale | 6 | Scènes 2, 10 |
| Conséquences : échauffement → dégradation → arrêt → panne ; question de la problématique | 6 | Scène 2 |
| Objectif général, boucle Mesurer → Détecter → Décider → Protéger, sept fonctions attendues | 8 | Scènes 4, 8 |
| Objectifs SMART (dont « Réaliser le projet en six semaines ») | 10 | Scène 4 |
| Matériel : moteur triphasé, disjoncteur, contacteur, relais thermique, capteurs (courant, tension, température, vibration), PLC Siemens, voyants et bouton d'arrêt | 12 | Scènes 5 à 9, 11 |
| Logiciels : TIA Portal (programmation du PLC), PLCSIM (simulation du programme), CADe_SIMU (simulation du circuit électrique), Microsoft PowerPoint (présentation) | 12 | Scène 12 |
| Chaîne « Capteurs → PLC → TIA Portal / PLCSIM → Commande → Moteur » | 12 | Scène 12 |
| Tableau comparatif : protection classique, relais électronique, protection intelligente | 14 | Scène 13 |
| Planificateur : six tâches et leurs valeurs numériques | 4 | Scène 14 |

### Planning : six semaines et onze périodes

Le dossier contient deux informations temporelles distinctes. Elles sont présentées séparément, sans être rapprochées :

- **Objectif SMART (diapositive 10) :** « Réaliser le projet en six semaines ». Il est conservé tel quel et affiché au-dessus du planificateur.
- **Planificateur (diapositive 4) :** l'axe compte **11 périodes**, dont l'unité n'est pas précisée. L'axe est donc libellé « Périodes de planification (unité non précisée) ». Ces périodes ne sont **pas** présentées comme des semaines.

Valeurs reprises sans modification :

| Tâche | Début prévu | Durée prévue | Début réel | Durée réelle | % accompli |
|---|---|---|---|---|---|
| Choix du mini-projet et préparation du cahier des charges | 1 | 2 | 1 | 2 | 100 % |
| Validation du cahier des charges et étude bibliographique | 2 | 1 | 2 | 1 | 100 % |
| Étude théorique et proposition des solutions possibles | 3 | 4 | 3 | 4 | 100 % |
| Choix de la solution et réalisation | 5 | 6 | non renseigné | non renseigné | non renseigné |
| Rédaction du rapport | 3 | 8 | non renseigné | non renseigné | non renseigné |
| Soutenance | 10 | 2 | non renseigné | non renseigné | non renseigné |

Les cellules vides du document source apparaissent sous la forme « — ».

---

## 2. Corrections apportées au texte d'origine

| Original | Corrigé | Raison |
|---|---|---|
| « deppartement » | « département » | orthographe |
| « PLANIICATEUR » | « Planning » (titre de scène) | orthographe / titre |
| « OBJECTIF GENERALE/SPESIFIQUE » | « Objectifs » | orthographe, accord |
| « Notre objectify » | « Concevoir une solution… » | orthographe |
| « Contrôler la temperature » | « Contrôler la température » | accent |
| « Problematiques », « Schéma Electrique », « Objectif General » | accents rétablis | orthographe |
| SMART, Atteignable : « un conducteur » | « un contacteur » | l'équipement qui commande le moteur est le contacteur |
| Planificateur : « Choix du mini projet… » | « Choix du mini-projet… » | trait d'union (seule modification du libellé) |
| Planificateur : « Etude théorique… » | « Étude théorique… » | accent sur la capitale (seule modification du libellé) |
| « Institut Supérieur des Études Technologiques Rades » | « … de Radès » | forme usuelle du nom |

**Supprimé :** la note de la diapositive 2 évoquait un plan en « six étapes … jusqu'au dimensionnement des constituants ». Aucun dimensionnement ne figure dans le dossier, et la mention a été retirée.

**Conservé :** Microsoft PowerPoint reste cité comme l'outil de la présentation d'origine (scène 12). Il est précisé que la présentation web sert à la soutenance et ne fait pas partie du système de protection.

---

## 3. Éléments illustratifs (créés pour la présentation)

Ces éléments sont marqués à l'écran par l'étiquette « Illustration » (bordure en tirets) ou « Principe général » (bordure en pointillés). Les informations issues du dossier portent l'étiquette « Dossier du projet » (bordure pleine).

- **Modèle 3D du moteur.** Moteur asynchrone générique à carcasse ailetée, construit par programme. Ce n'est pas un modèle CAO du moteur du projet. La plaque signalétique est volontairement vide de caractéristiques.
- **Champ tournant et glissement (scène 3).** Il s'agit d'un principe général. Les vitesses sont ralenties et l'écart entre champ et rotor est volontairement exagéré pour être lisible.
- **Armoire et disposition des appareils.** Disposition, formes et cheminement des câbles sont illustratifs. Les appareils n'ont ni marque, ni modèle, ni repérage de bornes.
- **Capteurs.** Les quatre catégories viennent du dossier. Leurs types, modèles, emplacements et la nature des signaux sont illustratifs. Les jauges de la scène 7 sont qualitatives : elles n'affichent ni valeur ni seuil.
- **Couleurs.**
  - Le cyan (normal), l'ambre (avertissement) et le rouge (défaut) sont un code de présentation. Ils ne décrivent ni les voyants réels, ni les isolants, ni le câblage.
  - Les conducteurs L1, L2 et L3 ont une gaine de couleur neutre, et l'animation lumineuse ne représente pas une couleur d'isolant.
  - Chaque état coloré est doublé d'un texte ou d'un symbole.
- **Alarme.** Elle est visualisée de façon abstraite (anneaux, pictogramme). Son type réel n'est pas documenté.
- **Automate.** Le boîtier est générique et associé au libellé « Automate programmable Siemens ». Aucun modèle n'est indiqué.
- **Schéma de principe (scène 11).**
  - Il porte la mention « Non validé pour câblage » et reste au niveau des blocs.
  - Les repères Q1, KM1, RT1 et M1 sont des identifiants conventionnels illustratifs, signalés comme tels dans la légende.
  - Il ne montre ni bornes, ni adresses d'E/S, ni calibres, ni câblage de la bobine.
  - La liaison « Commande → KM1 » est une relation conceptuelle (tirets), pas un circuit de bobine.
- **Matrice défauts × capteurs (scène 10).** Le dossier liste les cinq défauts et les quatre catégories de capteurs, mais pas leurs correspondances. Les marques en tirets sont une proposition conceptuelle, présentée comme « non confirmée par le dossier — à vérifier » :
  - surcharge → courant ;
  - perte de phase → courant, tension ;
  - surchauffe → température ;
  - vibration anormale → vibration ;
  - tension anormale → tension.
- **Scénario de perte de phase (scène 9).** C'est un scénario fonctionnel illustratif, pas une reproduction du programme PLC. Il suit cette séquence :
  1. fonctionnement normal ;
  2. une phase indisponible ;
  3. condition anormale signalée ;
  4. décision de protection ;
  5. ouverture du contacteur ;
  6. arrêt du flux en aval ;
  7. décélération du moteur ;
  8. défaut signalé et alarme.

  La séquence s'arrête là, et aucune scène suivante ne remet le moteur sous tension. Le moteur continue de tourner sur deux phases jusqu'à l'action de la protection, ce qui correspond au comportement général d'un moteur déjà lancé.
- **Mise sous tension (scène 6).** La fermeture du disjoncteur puis du contacteur est montrée pour suivre le trajet de l'énergie. La commande de démarrage n'est pas documentée, et la scène ne l'attribue à aucun organe.

---

## 4. Informations absentes ou à valider

Aucune de ces informations ne figure dans le dossier, et aucune n'a été inventée :

1. **Valeurs électriques :** caractéristiques du moteur (tension, courant, puissance, fréquence, vitesse, couplage) et calibres du disjoncteur, du contacteur et du relais thermique.
2. **Protection :** seuils (courant, tension, température, vibration), temporisations et temps de réponse.
3. **Capteurs :** modèles, types (analogique ou tout-ou-rien), plages, points de montage et raccordement au PLC.
4. **Automate :** modèle de PLC Siemens, modules d'E/S, adresses d'entrées/sorties et langage de programmation utilisé dans TIA Portal.
5. **Relais thermique :** câblage du contact auxiliaire. On ne sait pas s'il coupe directement la bobine du contacteur, s'il renvoie un signal au PLC, ou les deux. Le relais thermique figure uniquement dans le circuit de puissance.
6. **Câblage de commande :** bobine du contacteur, voyants, alarme et bouton d'arrêt. Le bouton est cité comme « bouton d'arrêt », sans indication qu'il s'agisse d'un arrêt d'urgence.
7. **Signalisation :** type d'alarme (sonore, lumineuse) et couleurs réelles des voyants.
8. **Procédure de réarmement / acquittement :** non documentée, et donc non représentée.
9. **Schéma électrique validé :**
   - La diapositive 16 contient une illustration générée automatiquement, aux libellés illisibles (« DIBONTUUE », « BOBINE DU BAFAIOJO DRAQTIER », codes de couleur hexadécimaux). Elle n'a pas été reprise.
   - Aucun fichier CADe_SIMU n'est disponible.
10. **Résultats :** le dossier ne documente ni simulation PLCSIM ou CADe_SIMU menée à terme, ni réalisation matérielle, ni essai de protection. La présentation ne revendique aucun de ces résultats.
11. **Avancement réel** des tâches 4 à 6 du planificateur et **unité** des périodes.

---

## 5. Images du dossier d'origine

Les illustrations du fichier PowerPoint (croquis de moteurs, schémas) ont été générées par un outil automatique (« Made with Gamma »). Elles comportent des libellés incohérents et ne sont pas réutilisées. Seul le logo de l'ISET de Radès (diapositive 1) est repris, pour la plaque de titre.

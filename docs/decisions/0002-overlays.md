# 0002 — Couche d'overlays : la vue d'interface supérieure, agrandie le temps d'un overlay

- **Statut** : proposée (ARB-38, EP-06)
- **Date** : 2026-11-03
- **Concerne** : couche d'overlays (ARB-39), menus contextuels (ARB-40, ARB-41), suggestions de la barre d'adresse
  (ARB-53), palette de commandes (ARB-67), dialogues et bandeaux à venir

## Contexte

Une page web est une `WebContentsView` : une couche native posée au-dessus du HTML de la fenêtre. Tout menu,
palette ou dialogue de l'interface qui déborde sur la zone de page est masqué par elle (règle d'architecture 4).
Plusieurs tickets en dépendent : les suggestions sous la barre d'adresse, la palette Ctrl+K, les menus contextuels,
les dialogues.

Arbalète a déjà une vue d'interface au-dessus de la page : la barre latérale (ARB-33), une `WebContentsView`
transparente chargée avec `?vue=barre`, qui pilote l'IPC comme la fenêtre. Masquée, elle se réduit à une bande de
6 px au bord gauche : une vue transparente reçoit les clics sur toute sa surface, y compris là où rien n'est dessiné.

Besoins :

| Besoin | Exemple | Exigence |
|---|---|---|
| Overlay ancré sous un champ | suggestions (ARB-53) | Le clavier reste dans le champ pendant l'affichage |
| Overlay modal avec saisie | palette Ctrl+K (ARB-67) | Saisie au clavier sans désactiver la fenêtre |
| Menu au point du clic | menus contextuels (ARB-40, ARB-41) | Apparition immédiate, style de `DESIGN.md` |
| Dialogue | confirmations, invites | Au-dessus de la page, page figée ou non |

## Mesures

Banc Electron 45.1.0 sur le poste de développement (Windows 10), fenêtre de 1280 × 800 avec, en dessous, une page
de 3 000 lignes dans une `WebContentsView`. Le temps va de l'ordre d'affichage jusqu'à deux images rendues par
l'overlay (`requestAnimationFrame` deux fois), menu de 8 entrées rempli à chaque ouverture. 20 ouvertures par option,
deux séries concordantes (une seule pour A2 et pour la fenêtre enfant qui prend le clavier).

| Option | Ouverture (médiane / p95) | Mémoire en plus | Clavier de la fenêtre |
|---|---|---|---|
| A. `WebContentsView` transparente dédiée, préchargée, `setVisible` | 26–27 ms / 29–40 ms | +76 Mo (un processus de rendu) | Gardé |
| A. Même vue créée à chaque ouverture | 77 ms / 78–94 ms | +76 Mo pendant l'affichage | Gardé |
| **A2. Vue toujours affichée, agrandie de 6 px à la fenêtre** | **25 ms / 30 ms** | **0 si c'est la vue de la barre** | **Gardé** |
| B. Page remplacée par sa capture (`capturePage`) | 27–28 ms / 40–43 ms | ~0 (image PNG de 51 Ko) | Gardé |
| C. Fenêtre enfant transparente préchargée, `showInactive` | 25–26 ms / 28–32 ms | +72–73 Mo (un processus de rendu) | Gardé sans saisie ; **perdu** dès que l'overlay prend le clavier |

À 60 Hz, deux images font au moins 17 ms : toutes les options préchargées s'affichent en une à deux images. La
latence ne départage pas les options. Les écarts portent sur la mémoire, le clavier et le comportement.

Mémoire : une page minimale, pas l'interface React d'Arbalète. Une vue qui charge l'interface coûte au moins autant.

## Options étudiées

### A. `WebContentsView` transparente dédiée aux overlays

Une vue de plus au-dessus de la page et de la barre, visible seulement pendant un overlay. Rapide si elle est
préchargée (créée à la demande : 77 ms, perceptible), et la fenêtre garde le clavier. Mais :

- un processus de rendu de plus, au moins 76 Mo, pour une vue invisible la plupart du temps ;
- une troisième vue d'interface à brancher sur l'IPC (`contenusInterface`, `emetteurAutorise`, verrouillage, F12,
  raccourcis) ;
- les suggestions et la palette vivent alors dans un autre document que la barre d'adresse : chaque frappe et chaque
  flèche passent par le processus principal.

### A2. La vue de la barre latérale, agrandie à la fenêtre le temps d'un overlay

La vue d'interface supérieure existe déjà, transparente, au-dessus de la page, branchée sur l'IPC et verrouillée.
Pour un overlay, le processus principal l'agrandit à toute la fenêtre ; à la fermeture, il la rend à sa taille de
barre (ouverte, épinglée ou bande de survol). Ouverture mesurée : 25 ms, aucune mémoire en plus, le clavier reste où
il est.

La cible Arc (EP-05, ARB-31) place la barre d'adresse dans la barre latérale : le champ, ses suggestions, la palette
et les menus des onglets (ARB-41) vivent alors dans le même document React. Le focus, les flèches et Entrée s'y
gèrent sans aller-retour IPC.

Limites :

- tant qu'un overlay est ouvert, la vue couvre la fenêtre et reçoit tous les clics : un clic hors de l'overlay le
  ferme sans atteindre la page. C'est le comportement d'un menu ou d'une palette modale, pas d'une bulle d'aide ;
- un overlay ne déborde pas de la fenêtre : un menu près du bord s'ouvre de l'autre côté ;
- la logique de survol de la barre (retrait à la sortie de la souris, clic dans la page) doit être suspendue
  pendant un overlay ;
- tant que la barre d'adresse est dans la fenêtre (avant ARB-31), ses suggestions s'affichent dans l'autre vue :
  le texte saisi et la sélection y passent par IPC.

### B. Masquer la page derrière sa capture

`capturePage` fige la page en image, affichée dans le HTML de la fenêtre ; la vue web est retirée le temps de
l'overlay. Aucune vue de plus, mais :

- la page est figée : une vidéo s'arrête à l'image, une animation aussi, et rien n'est cliquable dessous ;
- 27 ms médian, 43 ms au p95, et le délai grandit avec la taille de la fenêtre et l'échelle d'affichage (capture à la
  résolution réelle à 150 %) ;
- retirer et remettre la vue web à chaque overlay touche au focus et à l'ordre des vues que règlent ARB-33 et ARB-110.

Écartée comme mécanisme général. Reste possible plus tard pour un effet visuel (page floutée derrière un dialogue).

« Rétrécir » la page ne crée pas d'overlay : c'est une mise en page (la barre épinglée le fait déjà).

### C. Fenêtres enfants

Une `BrowserWindow` sans cadre, transparente, rattachée à la fenêtre. Aussi rapide qu'une vue, et seule option qui
peut déborder de la fenêtre. Mais :

- un processus de rendu de plus (+72–73 Mo) ;
- dès qu'elle prend le clavier (palette, champ de recherche), la fenêtre principale est désactivée (mesuré :
  `isFocused()` faux) : barre de titre grisée, `blur` dans la page et l'interface ;
- elle doit suivre la fenêtre (déplacement, redimensionnement, réduction, agrandissement, ancrage Windows,
  changement d'écran ou d'échelle), et les fenêtres transparentes ont des limites sous Windows (pas de
  redimensionnement, rendu DWM).

Écartée.

### Menus natifs (`Menu.popup`)

Coût nul, débordent de la fenêtre, accessibles au clavier, mais rendus par Windows : ni le style ni les ombres de
`DESIGN.md`, pas d'icônes cohérentes avec l'interface. Hors des options du ticket ; à rediscuter seulement pour le
menu contextuel des pages (ARB-40) si les fonctions de Chromium (correcteur orthographique, entrées propres à un
élément) y sont nécessaires.

## Décision

**Option A2 : les overlays s'affichent dans la vue d'interface supérieure, celle de la barre latérale, agrandie à
toute la fenêtre le temps d'un overlay.**

- Le processus principal tient l'état « overlay ouvert » à côté de celui de la barre : à l'ouverture, la vue est
  remise au premier plan et prend la fenêtre entière ; à la fermeture, `placerBarre` lui rend sa taille.
- L'overlay lui-même est un composant React de la vue de la barre ; son fond hors du contenu est transparent.
  Échap ou un clic hors du contenu ferme l'overlay.
- Ouvrir un overlay passe par un canal IPC typé et validé (règle 2) ; la fenêtre peut en demander un, l'overlay est
  rendu par la vue de la barre.
- Pendant un overlay, la barre ne se retire pas au survol ni au clic dans la page.
- Pas de fenêtre enfant ni de vue d'overlay dédiée. Si la vue de la barre devient trop chargée, l'option A reste le
  repli : même composant, une vue de plus, pour 76 Mo.

## Conséquences

- ARB-39 généralise le placement de la vue de la barre (taille de barre ou fenêtre entière) et ajoute l'API
  d'ouverture et de fermeture côté renderer.
- Faire ARB-31 (barre d'adresse dans la barre latérale) avant ARB-53 évite de faire passer chaque frappe par IPC.
- ARB-40 et ARB-41 utilisent la couche d'overlays ; un menu proche du bord s'ouvre vers l'intérieur.
- Tests à prévoir (ARB-39) : un overlay ouvert couvre la page, se ferme par Échap et par un clic extérieur, rend à
  la barre sa taille d'avant, et la page ne reçoit pas le clic qui ferme.

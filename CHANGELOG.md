# Changelog

Toutes les évolutions notables d'Arbalète. Versions à 4 segments (`MAJEUR.MINEUR.CORRECTIF.MICRO`), gérées par `/ship`.

## [0.12.0.0] - 2026-11-06

### Ajouté
- Les thèmes sombre et clair d'Arbalète suivent désormais les palettes de `DESIGN.md` : Obsidian, Slate et Graphite
  en sombre, Cloud, Porcelain et Mist en clair, avec l'accent Amber. Le changement de thème, choisi ou suivi du
  système, s'applique aussitôt à la fenêtre et à la barre latérale, sans rechargement ni élément resté dans l'autre
  thème.
- Le fond natif de la fenêtre prend la couleur du thème : plus de bande sombre au redimensionnement en thème clair,
  ni de flash sombre au démarrage quand Windows est en mode clair.
- Avec l'option « réduire les animations » de Windows, les transitions de l'interface sont coupées.

### Modifié
- Les couleurs de l'interface ne vivent plus que dans un seul fichier de design tokens ; un test refuse toute
  valeur hexadécimale ailleurs. L'Amber est réservé aux interactions et aux états actifs.

## [0.11.2.0] - 2026-11-03

### Documentation
- `DESIGN.md` passe en version 1.1 avec des contrastes validés : dans les deux thèmes, le texte secondaire, l'accent
  Amber et les couleurs Success, Warning et Error atteignent 4,5:1 sur tous les fonds (seuil AA). Le thème sombre
  s'éclaircit légèrement ; le thème clair prend un Amber plus foncé. Chaque couleur d'espace a désormais une variante
  par thème, lisible sur la barre latérale.
- Un tableau donne le contraste minimum de chaque élément. Sur un bouton Amber, le texte est Obsidian en sombre et
  blanc en clair. De nouvelles règles précisent l'usage des couleurs : les teintes de survol et d'appui de l'accent
  servent de fond, l'anneau de focus reprend l'accent, et un champ ne se repère jamais par sa seule bordure.

## [0.11.1.0] - 2026-11-03

### Documentation
- `DESIGN.md` devient le référentiel graphique officiel d'Arbalète, version 1.0, direction Atmospheric
  Minimalism : palettes sombre et claire autour de l'accent Amber, couleurs des espaces, polices Inter, Manrope et
  JetBrains Mono, espacements, dimensions, rayons, animations, composants et règles d'originalité. Il note les
  décisions du jour (barre de contrôle en haut, barre latérale étendue, compacte ou masquée) et les contrastes du
  thème clair encore à corriger. L'interface actuelle n'a pas encore changé : sa mise en conformité suit dans l'epic
  EP-05.
- `CLAUDE.md` impose de consulter ce référentiel avant toute création ou modification d'interface.

## [0.11.0.0] - 2026-11-03

### Ajouté
- Un clic droit sur un onglet de la barre latérale ouvre son menu (Nouvel onglet, Fermer l’onglet). Le menu passe
  au-dessus de la page sans être masqué par elle ; près d’un bord de la fenêtre, il s’ouvre de l’autre côté. Il se
  parcourt aux flèches, Début et Fin.
- Le menu se ferme par Échap (même quand le clavier est dans la page, qui ne reçoit pas la touche), par un clic hors
  du menu (qui n’atteint pas la page), quand la fenêtre perd le focus, quand son onglet est fermé ailleurs ou avant
  qu’un raccourci d’Arbalète agisse. Une barre non épinglée ne se retire pas tant que le menu est ouvert, et le
  clavier revient à la page quand elle se retire après.
- Ce menu inaugure la couche d’overlays (décision 0002) : les prochains menus, suggestions, palettes et dialogues qui
  passent au-dessus de la page l’utiliseront.

## [0.10.1.0] - 2026-11-03

### Documentation
- Décision 0002 : les menus, palettes et dialogues qui passent au-dessus de la page s'afficheront dans la vue de la
  barre latérale, agrandie à toute la fenêtre le temps de leur affichage. Les autres options (vue dédiée, capture de
  la page, fenêtres enfants) ont été mesurées et écartées.

## [0.10.0.0] - 2026-11-03

### Ajouté
- Arbalète tient l'historique des pages visitées : chaque navigation d'un onglet vers une autre page web enregistre
  son adresse, son titre et la date de la visite, et compte les visites de chaque page. Un rechargement, un saut vers
  une ancre de la même page, une adresse injoignable ou un onglet rouvert à la restauration de la session ne comptent
  pas comme des visites. L'historique est conservé dans la base locale ; le panneau pour le consulter viendra ensuite.
- Le nom d'utilisateur et le mot de passe qu'une adresse peut contenir ne sont jamais enregistrés dans l'historique.

## [0.9.1.0] - 2026-11-03

### Sécurité
- Les pages web ne se voient plus accorder de permissions qu'elles n'ont pas demandées : interrogées, la
  géolocalisation, les notifications, la caméra, le micro et le presse-papiers sont annoncés refusés.
- Une page web ne peut plus accéder aux périphériques USB, série ou HID (manettes, clés de sécurité, cartes
  électroniques) : chaque demande est annulée.

## [0.9.0.0] - 2026-11-03

### Ajouté
- Une base de données illisible (fichier abîmé ou qui n'est pas une base SQLite) est mise de côté sous
  `arbalete.db.corrompue-<date>`, intacte, et remplacée par une base neuve : Arbalète conserve de nouveau la session.
- Une base créée par une version plus récente d'Arbalète n'est jamais modifiée ni renommée.
- Dans ces deux cas, comme quand la base ne s'ouvre pas, un bandeau prévient l'utilisateur de ce qui s'est passé.

## [0.8.0.0] - 2026-11-03

### Ajouté
- Après un arrêt forcé (plantage, fin de tâche, coupure de courant), Arbalète ne rouvre plus d'office la session
  interrompue : un bandeau au-dessus de la page propose de la restaurer. « Restaurer » rouvre ses onglets à la place
  de l'onglet de démarrage s'il n'a pas servi ; « Ignorer » garde la session en cours. Tant que l'invite attend, la
  session interrompue reste intacte sur disque, et fermer Arbalète sans répondre la rouvre au démarrage suivant.

## [0.7.0.0] - 2026-11-03

### Ajouté
- Au démarrage, Arbalète rouvre les onglets de la dernière session, dans leur ordre, avec l'onglet actif et les titres
  enregistrés. Seul l'onglet actif charge sa page ; les autres la chargent à leur premier affichage. Seules les adresses
  web sont rouvertes. Les adresses passées au lancement s'ajoutent après la session restaurée.

## [0.6.0.0] - 2026-11-03

### Ajouté
- La session des onglets est enregistrée dans `arbalete.db` : les onglets ouverts, leur ordre, leurs titres et l'onglet
  actif. L'écriture se fait une seconde après le dernier changement (au plus tard 5 secondes après le premier) et à la
  fermeture d'Arbalète. La restauration au démarrage viendra avec ARB-45.

## [0.5.0.1] - 2026-11-02

### Tests
- Les tests Playwright lancent Arbalète sur un profil de données temporaire (`ARBALETE_PROFIL_TEST`), supprimé à la
  fin : ils ne lisent ni n'écrivent plus l'`arbalete.db` de l'utilisateur, et `npm run test:smoke` tourne même si
  Arbalète est déjà ouvert. La variable est ignorée dans l'app empaquetée et si le chemin n'est pas absolu.

## [0.5.0.0] - 2026-11-02

### Ajouté
- Une seule instance d'Arbalète à la fois : relancer Arbalète ramène la fenêtre déjà ouverte au premier plan (et la
  restaure si elle était réduite) au lieu d'en ouvrir une seconde. Les deux instances ne se disputent plus la base de
  données.
- Les adresses web passées au lancement (`arbalete.exe -- https://…`) s'ouvrent en onglets, dans la fenêtre déjà
  ouverte s'il y en a une. Seules les adresses http(s) sont acceptées, 10 au plus par lancement.

## [0.4.0.0] - 2026-11-02

### Ajouté
- Couche de données dans le processus principal (`src/main/donnees/`) : base SQLite `arbalete.db` dans le dossier de
  données de l'utilisateur, schéma versionné avec migrations, et lecture/écriture de la session d'onglets. Elle
  servira à restaurer les onglets au redémarrage (ARB-44/45) ; rien n'est encore enregistré pendant la navigation.
- Une base créée par une version plus récente d'Arbalète est refusée sans être modifiée ; si la base ne s'ouvre pas,
  le navigateur fonctionne sans conserver de données.
- Tests unitaires (`npm run test:unit`), lancés sous le Node embarqué par Electron.

## [0.3.0.1] - 2026-11-02

### Documentation
- Décision 0001 (`docs/decisions/0001-stockage.md`) : les données d'Arbalète (session, favoris, historique, espaces)
  seront stockées dans SQLite intégré à Electron (`node:sqlite`), derrière un module du processus principal.

## [0.3.0.0] - 2026-11-02

### Ajouté
- Les raccourcis Ctrl+T (nouvel onglet), Ctrl+W (fermer l'onglet), Ctrl+L (barre d'adresse) et Alt+←/→
  (précédent/suivant) fonctionnent aussi quand le clavier est dans une page web ou dans la barre latérale.
- Après Ctrl+T, on peut taper l'adresse tout de suite ; après Ctrl+W, le clavier passe à l'onglet qui devient actif.
- Les raccourcis marchent aussi avec une disposition de clavier non latine (russe, grec…). AltGr n'en déclenche aucun.

### Modifié
- Les raccourcis d'Arbalète sont interceptés par le processus principal : la page ne les reçoit plus et aucune action
  n'est exécutée deux fois.

## [0.2.1.0] - 2026-11-02

### Corrigé
- Au démarrage, le clavier va bien à la page de l'onglet : on peut taper ou faire défiler tout de suite, sans que la
  barre latérale masquée garde le focus.
- La barre latérale se rouvre quand la souris revient vite au bord gauche juste après l'avoir quittée.

### Modifié
- L'interface est découpée en vues et composants (fenêtre, barre latérale, barre d'outils, onglets…), sans changement
  visible. Les prochaines évolutions de la barre et des onglets s'appuieront dessus.
- Les tests vérifient que la page de l'onglet a le focus au démarrage, et les tests de développement attendent que
  l'onglet ait chargé son adresse avant de commencer.

## [0.2.0.0] - 2026-11-02

### Modifié
- La barre latérale disparaît : à l'ouverture de la fenêtre, la page occupe toute la largeur. Approcher la souris du
  bord gauche fait apparaître la barre par-dessus la page, sans la déplacer ; elle se retire quand la souris la quitte
  ou au clic dans la page ou la barre d'outils. Le menu des espaces ouvert la garde affichée.
- Le bouton de repli devient un bouton d'épingle, dans la barre et dans la barre d'outils. Épinglée, la barre reste
  ouverte et la page lui laisse sa place. Ctrl+Maj+B épingle ou libère la barre, même quand le focus est dans une page.
- Le thème choisi s'applique ensemble à la fenêtre et à la barre latérale.
- Ctrl+T, Ctrl+W et Alt+flèches fonctionnent aussi quand le focus est dans la barre latérale.

### Ajouté
- Les tests C31 à C35 et C9 couvrent la barre masquée à l'ouverture, le survol, le retrait, l'épinglage, Ctrl+Maj+B, le
  verrouillage de la vue de la barre et le thème partagé.

## [0.1.5.0] - 2026-11-01

### Modifié
- La barre latérale s'ouvre repliée : à l'ouverture de la fenêtre, seule la bande d'icônes est visible et la page
  prend la largeur libérée. Le bouton en haut de la barre et Ctrl+Maj+B la déploient toujours.

### Ajouté
- Les tests C31 et C32 vérifient la barre repliée à l'ouverture et l'aller-retour avec Ctrl+Maj+B ; C18 la vérifie
  aussi en mode développement.

## [0.1.4.0] - 2026-11-01

### Corrigé
- En développement (`npm run dev`), F12 ouvre et ferme les outils de développement de l'interface où que soit le
  focus : dans la page de l'onglet comme dans l'interface. Jusqu'ici, F12 ne faisait rien au démarrage, quand le
  focus est dans la page. La page ne reçoit plus F12, même maintenue, et un appui long ne fait plus clignoter les
  outils de développement.

### Ajouté
- Les tests C28 à C30 couvrent F12 depuis un onglet, les autres touches et la répétition automatique, et vérifient
  que la page ne reçoit pas F12.

## [0.1.3.0] - 2026-11-01

### Modifié
- Plus de menu d'application : dans l'app construite, Ctrl+Maj+I n'ouvre plus les outils de développement de
  l'interface et Ctrl+R ne la recharge plus. En développement, F12 ouvre toujours ces outils. Le zoom au clavier et
  F11 disparaissent avec ce menu ; ils reviendront, gérés par Arbalète (ARB-107).
- Une page ne peut plus ouvrir que des adresses web dans un nouvel onglet : un lien ou un `window.open` vers
  `file://`, `about:blank` ou un schéma inconnu n'ouvre rien.
- Les pages ne peuvent plus noyer le navigateur sous les onglets : une page en ouvre au plus 5 par 10 secondes,
  toutes les pages réunies 20, et plus aucun au-delà de 50 onglets ouverts. L'utilisateur peut toujours en ouvrir
  depuis l'interface.

### Ajouté
- Les tests automatisés couvrent ces protections : absence de menu, F12 en build et en développement, schémas
  refusés, quotas par onglet et global, fenêtre de 10 secondes et plafond de 50 onglets (C19 à C27).

## [0.1.2.0] - 2026-11-01

### Modifié
- L'interface d'Arbalète est verrouillée : seule sa propre page peut piloter le navigateur. Une page web qui
  obtiendrait le pont `window.arbalete`, un iframe ou une autre fenêtre voit ses commandes refusées.
- La fenêtre de l'interface ne navigue plus : un lien glissé sur la barre latérale ou un script ne peut plus la
  remplacer par une autre page, ni ouvrir de nouvelle fenêtre.
- L'interface construite applique une Content-Security-Policy stricte : aucun script ou style inline, aucune
  ressource externe. Le serveur de développement garde une politique assouplie pour le rechargement à chaud.
- Une app empaquetée ignore `ELECTRON_RENDERER_URL` : elle charge toujours son interface embarquée.

### Ajouté
- Les tests automatisés couvrent ce verrouillage : CSP du build, appels refusés depuis une autre page ou un autre
  fichier local, fenêtre qui ne navigue pas, et mode développement servi par Vite (`tests/developpement.spec.ts`).

## [0.1.1.0] - 2026-10-31

### Modifié
- Arbalète tourne sur Electron 45.1.0 (Chromium et Node 24 à jour). Electron 42 n'était plus maintenu ; la
  version d'Electron est désormais épinglée exactement dans `package.json`.
- Outillage de build à jour : electron-vite 6, Vite 8 et @vitejs/plugin-react 6.
- L'installation demande une étape de plus : `npx install-electron` après `npm install` (ou `npm ci`), car
  `npm install` ne télécharge plus le binaire d'Electron. Sans elle, `npm run dev` échoue.

### Ajouté
- `npm run test:smoke` vérifie l'app construite sous Windows : démarrage, barre d'adresse, précédent/suivant,
  onglets, liens qui ouvrent un onglet, schémas non web refusés, permissions refusées, repli de la barre
  latérale, bouton Recharger et placement de la page au redimensionnement.
- Mises à jour hebdomadaires des dépendances par Dependabot, avec Electron dans son propre groupe.
- Licence GPL-3.0-or-later, README, guide de contribution, code de conduite (Contributor Covenant 2.1) et
  politique de sécurité.

## [0.1.0.0] - 2026-10-27

### Ajouté
- Prototype Electron + React + TypeScript : navigation Chromium réelle (WebContentsView), onglets,
  barre latérale repliable, thèmes système/sombre/clair.
- Aperçu navigateur de l'interface (`npm run dev:web`, API simulée) pour tester l'UI hors Electron.
- Outillage gstack : `CLAUDE.md` (contexte, commandes, cycle de travail), `DESIGN.md`, `VERSION`, `CHANGELOG.md`.
- `.gitignore`, `.gitattributes` (LF), `package-lock.json`.

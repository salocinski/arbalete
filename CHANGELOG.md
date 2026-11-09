# Changelog

Toutes les évolutions notables d'Arbalète. Versions à 4 segments (`MAJEUR.MINEUR.CORRECTIF.MICRO`), gérées par `/ship`.

## [0.12.16.0] - 2026-11-09

### Ajouté
- La barre latérale a trois états : étendue, compacte (68 px, icônes seules avec leur nom en infobulle) ou masquée et rappelée au survol du bord gauche. Un bouton de la barre passe de l'étendue à la compacte, Ctrl+Maj+B l'épingle ou la libère comme avant, et la page s'aligne dans chaque état (ARB-123).
- La largeur de la barre étendue se règle de 200 à 400 px en glissant son bord droit, ou au clavier avec les flèches, Début et Fin (ARB-123).
- Le mode et la largeur de la barre sont conservés au redémarrage : une barre épinglée rouvre à la même taille (ARB-123).

### Limites connues
- En mode compact, un onglet se ferme par le clic droit ou Ctrl+W (pas de croix), et un clic sur l'espace de travail passe au suivant au lieu d'ouvrir le menu.
- Le glissement du bord de la barre n'a pas été essayé à la main sous Windows ; la largeur réglée et le mode sont couverts par un test Electron.

## [0.12.15.0] - 2026-11-09

### Corrigé
- Si vous passez à une autre application pendant le démarrage d'Arbalète, la fenêtre ne repasse plus d'elle-même au premier plan (ARB-112).
- Quand la barre latérale masquée se recharge (plantage de l'interface, rechargement à chaud en développement), le clavier reste dans la page de l'onglet actif au lieu d'être repris par la barre (ARB-113).
- La barre latérale n'affiche plus trois onglets fictifs le temps que les vrais arrivent, ni indéfiniment si leur lecture échoue (ARB-115, ARB-9).
- Fermer l'onglet actif active l'onglet voisin à droite, ou celui de gauche s'il était le dernier, au lieu de sauter au dernier de la liste (ARB-37).

### Limites connues
- Si la barre se recharge pendant que vous tapez dans la barre d'adresse, le clavier retourne à la page.
- Les onglets voisins suivent l'ordre d'ouverture, qui est l'ordre affiché : à revoir si la liste devient réordonnable.
- Le comportement du focus sous Windows quand vous changez d'application n'a pas été essayé à la main ; il est couvert par des tests Electron qui simulent une fenêtre sans focus.

## [0.12.14.0] - 2026-11-09

### Ajouté
- Le thème choisi (système, sombre ou clair) est conservé : au redémarrage, Arbalète s'ouvre avec le thème que vous aviez choisi, fond de la fenêtre, boutons Windows et barre latérale compris, au lieu de revenir au thème du système (ARB-59).

### Limites connues
- Si l'écriture du choix échoue, le thème reste appliqué pendant la session mais revient à l'ancien au redémarrage ; seule la console en garde la trace.
- Les trois chemins d'erreur de cette écriture et de cette lecture n'ont pas de test automatique (ils exigeraient d'ajouter un point d'injection de panne au code de production).
- Rien n'a été essayé à la main dans `npm run dev` : les vérifications sont les tests unitaires et les tests Electron.

## [0.12.13.0] - 2026-11-09

### Modifié
- Un lien de page vers `about:blank` (avec ou sans `#` ou `?`) ne laisse plus l'onglet sur une page vide : Arbalète revient à la page précédente de l'onglet (ARB-97).
- Le rectangle que l'interface donne à la page web est borné à la fenêtre : une valeur aberrante ne peut plus faire sortir la page de la fenêtre ni lever d'erreur dans le processus principal (ARB-104).
- En développement, l'adresse de l'interface (`ELECTRON_RENDERER_URL`) est lue une seule fois au démarrage : une valeur malformée, ou qui n'est pas en `http` ou `https`, arrête Arbalète avec un message clair au lieu de faire échouer chaque message ensuite (ARB-105).

### Limites connues
- La page vide s'affiche un instant avant le retour en arrière. Un script qui navigue lui-même vers `about:blank` remplace sa page dans l'historique : le retour va alors à l'entrée d'avant, voire ne fait rien s'il n'y en a pas.
- Le retour est limité à 2 par minute et par onglet : au-delà, l'onglet reste sur `about:blank`. Ce plafond est une garde contre une boucle, pas une frontière de sécurité, et aucun test ne reproduit une telle boucle.
- Navigation du cadre principal seulement : un sous-cadre peut toujours aller sur `about:blank`.
- Rien n'a été essayé à la main dans `npm run dev` ; les vérifications sont les tests unitaires et les tests Electron.

## [0.12.12.0] - 2026-11-09

### Ajouté
- La page web s'affiche maintenant dans un cadre aux coins arrondis, avec une marge de 8 px à gauche, à droite et en bas, comme dans la maquette de mise en page (ARB-32). Barre latérale masquée, la page part à 8 px du bord ; épinglée, elle part juste après la barre.

### Limites connues
- L'arrondi des coins de la page elle-même (la vue native de Chromium) n'a pas été vérifié à l'écran : les tests automatiques mesurent la marge et le rayon de l'interface, pas la découpe réelle de la page sous Windows. À contrôler à la main dans `npm run dev`, thèmes sombre et clair, barre épinglée ou non, et à 125 % de mise à l'échelle.
- Pendant un redimensionnement, la page peut déborder de la marge sur une image avant de se réaligner (comportement antérieur, plus visible avec la marge).

## [0.12.11.0] - 2026-11-08

### Ajouté
- La fenêtre d'Arbalète n'a plus de barre de titre Windows : sa barre de contrôle (précédent, suivant, adresse) en tient lieu. On déplace la fenêtre en la saisissant par un espace vide de cette barre, et les boutons réduire, agrandir et fermer de Windows restent à droite, à la même hauteur que la barre (ARB-30).
- Les boutons de fenêtre suivent le thème : leurs couleurs changent avec le choix sombre, clair ou celui de Windows.

### Limites connues
- Le déplacement réel de la fenêtre, le survol des boutons Windows et leur accès pendant qu'un menu d'onglet est ouvert n'ont pas été vérifiés à la main : les tests automatiques ne peuvent pas les voir.
- Un clic sur un espace vide de la barre de contrôle ne referme plus la barre latérale non épinglée ; elle se referme toujours quand la souris la quitte. Un clic droit au même endroit ouvre le menu système de Windows.
- Aucun essai à 125 % ou 150 % de mise à l'échelle de Windows.

## [0.12.10.1] - 2026-11-08

### Ajouté
- Le README affiche un badge CI qui montre si le dernier envoi sur `main` passe (ARB-8, troisième phase).

### Modifié
- La règle de protection de `main` (le ruleset `PR-Rule`) exige désormais les deux contrôles de la CI, « Typecheck, tests unitaires, build » et « Smoke test (Electron) » : une PR ne peut plus être fusionnée avec l'un d'eux rouge ou absent. Le réglage vit sur GitHub, pas dans le dépôt.

## [0.12.10.0] - 2026-11-08

### Ajouté
- Le test de fumée (les vraies fenêtres d'Arbalète pilotées par Playwright) tourne maintenant dans la CI Windows (ARB-8, deuxième phase) : un second job, 50 tests en une minute environ lors de la première exécution. Il n'a aucun nouvel essai automatique, pour qu'un test instable se voie et se corrige. En cas d'échec, le contexte d'erreur des tests est gardé 7 jours dans l'artefact `smoke-test-results`, et un dossier vide laisse un avertissement. Le test de garde de la CI interdit aussi `continue-on-error` et les nouveaux essais.

### Limites connues
- Le premier onglet charge google.com : une page de consentement ou une panne de réseau sur le poste de GitHub peut faire échouer le test de fumée sans changement de code, et aucune page de départ de test n'existe encore. Les durées des tests n'ont été observées que sur une exécution.
- La règle qui impose la CI verte avant la fusion sur `main` n'est pas posée (phase 3) ; tant qu'elle ne l'est pas, une PR peut être fusionnée avec un test de fumée rouge. Les noms des deux jobs seront les identifiants à exiger.

## [0.12.9.0] - 2026-11-08

### Ajouté
- Une intégration continue vérifie chaque modification (ARB-8, première phase) : sur un poste Windows neuf, à chaque envoi sur `main` et à chaque pull request, GitHub lance le contrôle des types, les tests unitaires et la compilation. Le workflow est en lecture seule et ses actions sont épinglées par empreinte de commit, que Dependabot met à jour. Un test unitaire protège ces deux propriétés et la liste des étapes.

### Limites connues
- Le smoke test (fenêtres Electron) ne tourne pas encore dans la CI : seconde phase. Il n'y a pas de contrôle de style (« lint »), faute de script. La règle qui impose la CI avant fusion sur `main` n'est pas posée. Pour limiter les abus sur un dépôt public, activer dans les réglages GitHub l'approbation des exécutions pour tous les contributeurs externes.

## [0.12.8.1] - 2026-11-08

### Corrigé
- Les réessais d'ouverture de la base de la version 0.12.7.0 portent désormais le ticket ARB-132 dans le code, le test, le CHANGELOG et CLAUDE.md : ils étaient notés ARB-130, numéro déjà pris par le ticket des droits du logo. Le message de la version 0.12.7.0 sur GitHub garde l'ancien numéro.

## [0.12.8.0] - 2026-11-08

### Ajouté
- Arbalète garde une copie de secours de ses données (ARB-131) : écrite à la fermeture normale et, 30 secondes après le démarrage, si la dernière a plus de 24 h. Une deuxième copie, d'au moins 24 h de plus, est conservée à côté. Si les données sont vraiment illisibles, elles sont remplacées par cette copie au lieu de repartir de zéro, et l'avertissement l'indique (les changements récents ont pu être perdus).

### Corrigé
- Des données jugées illisibles ne sont plus mises de côté sur une seule lecture ratée : Arbalète les rouvre 3 fois, à 500 ms d'intervalle, avant de conclure à une vraie corruption (ARB-131).

### Limites connues
- La copie de secours se fait sur le fil principal, sans borne de taille ni de durée : un très gros historique la rendrait lente à la fermeture. Le bandeau n'indique pas l'âge de la copie restaurée, et les échecs d'écriture de la copie ne sont visibles que dans la console. Les copies et les données mises de côté gardent un historique supprimé depuis.

## [0.12.7.0] - 2026-11-08

### Corrigé
- Arbalète ne perd plus sa session ni l'invite de restauration quand Windows tient encore les fichiers de la base juste après un plantage ou un redémarrage très rapide (ARB-132) : l'ouverture de la base réessaie jusqu'à 5 fois, à 500 ms d'intervalle, avant de démarrer sans sauvegarde. Seule l'erreur d'entrée-sortie « disk I/O error » est réessayée, pour ne pas retarder l'ouverture de la fenêtre quand le problème ne passera pas (base corrompue ou plus récente, droits, verrou déjà attendu 5 s).

### Limites connues
- Une lecture qui échoue par intermittence pendant la vérification de la base peut encore la faire prendre pour corrompue et la mettre de côté (comportement d'ARB-119, inchangé).

## [0.12.6.3] - 2026-11-08

### Corrigé
- Le test C42 (invite de restauration après un arrêt forcé) ne dépend plus de la charge de la machine (ARB-129) : sous forte charge il échouait 11 fois sur 12, il passe maintenant 12 fois sur 12. Trois causes, toutes dans le test : la lecture de la session pendant que l'app l'écrit (« database is locked »), un relancement trop rapide qui se fermait comme une seconde instance, et un profil encore tenu par Windows après l'arrêt forcé, qui faisait démarrer l'app sans base et sans invite.

### Limites connues
- Une base momentanément inaccessible au démarrage faisait démarrer l'app sans persistance ni invite de restauration ; traité en 0.12.7.0.

## [0.12.6.2] - 2026-11-08

### Corrigé
- Les smoke tests ne dépendent plus de la position du curseur de l'utilisateur (ARB-129) : la fenêtre de test ignore la souris système, si bien que le survol réel du bord gauche n'ouvre plus la barre latérale pendant C33 et C34. Les événements de test (Playwright, `sendInputEvent`) restent actifs.
- C14 attend la fin du chargement du premier onglet avant de comparer son adresse, qui passait de `https://www.google.com` à `https://www.google.com/` en cours de chargement et faisait échouer le test par intermittence.

### Limites connues
- C42 (invite de restauration après un arrêt forcé) restait suspect d'instabilité ; corrigé en 0.12.6.3.

## [0.12.6.1] - 2026-11-07

### Modifié
- La barre de contrôle (ARB-31) fait désormais 48 px, comme le prévoit `DESIGN.md`, au lieu de 64 px : sa hauteur, ses marges et ses écarts passent par les tokens du design system, sans valeur en dur. Précédent, Suivant et Recharger forment le composant `NavigationControls`, et la vue de la page garde le même décalage avant le premier calcul de l'interface (48 px au lieu de 64 px).

### Ajouté
- Un test vérifie que la règle de la barre de contrôle passe par les tokens (hauteur, marges, écarts), et le test C3 contrôle que Suivant se désactive en fin d'historique alors que Précédent et Recharger restent actifs.

### Limites connues
- La barre reste dans la colonne de la page, à droite de la barre latérale : la pleine largeur de la composition A (ARB-28) et l'alignement des boutons Windows (ARB-30) restent à faire. L'accès aux commandes n'existe pas encore, et le bouton Favori n'a toujours pas de comportement.
- Le gap et le padding de la barre sont vérifiés dans le texte de la feuille de style, pas dans le rendu ; l'ordre Épingle puis Navigation et le cas sans onglet actif ne sont pas testés (non couverts volontairement).

## [0.12.6.0] - 2026-11-07

### Ajouté
- `DESIGN.md` (Layout) place désormais la marque dans la barre de contrôle, comme la composition A, et `CLAUDE.md` référence le dossier `docs/maquettes/`.
- Une maquette de la mise en page cible, `docs/maquettes/arb-28-mise-en-page.html` (ARB-28) : la barre de contrôle de 48 px en haut sur toute la largeur, la barre latérale étendue, compacte ou masquée (rappelée au survol du bord gauche), et la page dans un cadre arrondi. Elle se feuillette en Dark et en Light, avec les quatre espaces de travail. La composition A (barre de contrôle pleine largeur) est validée ; la composition B (barre latérale pleine hauteur) est écartée.

### Limites connues
- La maquette est une page statique, sans effet sur l'application. Elle simule un survol des boutons Windows et des infobulles que l'application réelle ne pourra pas reproduire à l'identique (`titleBarOverlay`, couche d'overlays).
## [0.12.5.0] - 2026-11-07

### Ajouté
- Chaque onglet de la barre latérale affiche le favicon du site (ARB-35). Le processus principal écoute `page-favicon-updated` et ne transmet que les adresses `https:` et les images `data:` (PNG, JPEG, GIF, WebP, ICO) de 32 Ko au plus. Le favicon disparaît à la navigation vers un autre document, mais pas à un changement de fragment, et l'icône générique revient quand le site n'en annonce pas. L'icône d'erreur ou de chargement garde la priorité sur l'image.
- Un test (C50) vérifie que le favicon s'affiche sans violation de la CSP, qu'il survit à un changement de fragment et qu'il est retiré à la navigation suivante, et un test unitaire couvre le filtre des adresses acceptées.

### Modifié
- La CSP de l'interface autorise désormais `img-src 'self' data: https:` (ARB-106) pour charger les favicons ; `script-src` et `style-src` restent stricts, et C50 épingle ces trois directives.

### Limites connues
- Un favicon en `http:` n'est pas affiché (icône générique).
- L'interface charge elle-même le favicon `https:` choisi par la page : l'hôte voit la requête de l'interface, hors du cloisonnement de la session de l'onglet. À durcir en récupérant le favicon dans le processus principal pour le renvoyer en `data:`, ce qui permettrait de retirer `https:` de la CSP.
- Le favicon est aussi effacé quand une navigation démarre sans aboutir (téléchargement, réponse 204).

## [0.12.4.0] - 2026-11-07

### Ajouté
- Chaque onglet de la barre latérale montre son état : chargement (indicateur tournant sur l'icône), erreur quand la page n'a pas pu se charger (icône et couleur d'erreur, effacées à la navigation suivante), son et muet (icône de haut-parleur), épinglé (icône d'épingle, sans bouton de fermeture). L'onglet actif se repère à sa barre Amber, sans fond fortement contrasté, et les états sont aussi annoncés aux lecteurs d'écran.
- Quand les onglets changent de place ou qu'un onglet se ferme, les autres glissent en 160 ms au lieu de sauter ; le réglage de mouvement réduit du système coupe l'animation.
- Un test vérifie qu'un échec de chargement met l'onglet en erreur et que la navigation suivante l'efface, un autre que l'erreur l'emporte sur le chargement et le muet sur le son.

### Modifié
- `TabItem` devient un composant à part (`TabList` ne garde que la liste), et `DESIGN.md` décrit ces états.

### Limites connues
- Les états Épinglé et Muet sont prêts mais aucune commande ne les déclenche encore : épingler un onglet et couper son son viendront avec leurs propres tickets.
- L'onglet affiche toujours l'icône générique : le favicon de la page n'est pas encore transmis.

## [0.12.3.0] - 2026-11-07

### Modifié
- La barre d'adresse n'a plus besoin qu'on lui transmette l'état de focus du champ : l'anneau de focus suit désormais le champ lui-même. L'adresse affichée reste protégée pendant la saisie, comme avant.
- Les descriptions de `npm run test:unit` dans `README.md` et `CLAUDE.md` citent les tests des polices et des composants de base, en plus de la couche de données et des design tokens.

## [0.12.2.0] - 2026-11-07

### Ajouté
- Trois composants de base servent désormais de seuls boutons et champs de l'interface : `Button` (principal, secondaire, discret, destructif, en deux tailles), `IconButton` (bouton d'icône, avec libellé obligatoire pour l'accessibilité) et `Input` (champ avec icônes et état d'erreur). Tous suivent les design tokens, dans les thèmes sombre et clair, avec un anneau de focus visible au clavier.
- Des tests vérifient que chaque variante a ses états survol, actif et désactivé, que le champ a ses états focus et erreur, et qu'aucun dégradé n'apparaît.

### Modifié
- La barre d'outils, la barre d'adresse, les bandeaux, la page d'accueil, la barre latérale et les onglets utilisent ces composants à la place de leurs boutons et champs propres. Les états désactivés sont un peu plus lisibles (opacité de 0,4 au lieu de 0,28).

## [0.12.1.0] - 2026-11-07

### Ajouté
- L'interface d'Arbalète utilise désormais ses trois polices : Inter pour l'interface, Manrope pour les titres et la marque, JetBrains Mono pour les données techniques. Elles sont embarquées dans l'application, donc identiques hors ligne et sans appel réseau, avec Segoe UI en repli.
- Un test vérifie que les trois polices se chargent sous la politique de sécurité stricte de l'interface construite, et que chaque police des design tokens a sa déclaration.

## [0.12.0.3] - 2026-11-07

### Documentation
- Le README et la politique de sécurité décrivent l'état réel d'Arbalète (version 0.12 en développement, session des onglets et historique déjà enregistrés), et le README racine renvoie vers celui de l'application.
- Le README de l'application ne contredit plus le mode système du thème, et ses prochaines étapes ne listent plus ce qui est fait.
- La description du test C31 dans `CLAUDE.md` mentionne le focus clavier laissé à la page.

## [0.12.0.2] - 2026-11-07

### Modifié
- L'icône d'Arbalète contient désormais quatre tailles (16, 32, 48 et 256 px) : elle reste nette dans la barre de titre, la barre des tâches et les petites vignettes de Windows.

### Ajouté
- Les sources du logo et des icônes sont versionnées dans le dossier `branding/`, avec leur provenance.

## [0.12.0.1] - 2026-11-06

### Ajouté
- Arbalète a désormais sa propre icône dans la barre de titre de la fenêtre et dans la barre des tâches de Windows.

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

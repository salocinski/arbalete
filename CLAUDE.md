# Arbalète — instructions pour Claude

Navigateur Web pour **Windows**, inspiré de l'ergonomie d'**Arc** : barre latérale, espaces de travail,
organisation des onglets, compatibilité visée avec les extensions Chrome. Ce n'est pas une maquette :
l'objectif est un navigateur utilisable au quotidien.

Langue de travail : **français** (code, commentaires, commits et documentation).

## Sources de vérité

| Sujet | Où |
|---|---|
| Vision et stratégie | Document « Synthèse du projet » du projet Claude *Arbalete* |
| Backlog, epics, statuts | **Arbalète Suivi** : https://claude.ai/artifact/FpicMw6k8toB6GKWEp6BhW (tickets `ARB-n`, epics `EP-nn`) |
| Design | `DESIGN.md` (racine) : référentiel Atmospheric Minimalism, voir « Référentiel graphique obligatoire » |
| Décisions techniques | `docs/decisions/` (une fiche numérotée par choix structurant, ex. `0001-stockage.md`) |
| Maquettes | `docs/maquettes/` : pages HTML statiques de design validé, sans effet sur l'application (ex. `arb-28-mise-en-page.html`, mise en page cible, composition A) |
| Historique des versions | `VERSION` et `CHANGELOG.md` |
| Identité visuelle | `branding/` : sources du logo et des icônes (ARB-127), voir son README |
| Licence | **GPL-3.0-or-later** (`LICENSE`) : tout code ajouté doit être compatible (pas de dépendance sous licence propriétaire ou incompatible GPL) |
| Contribution externe | `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` |

Le backlog vit dans Arbalète Suivi (privé pour l'instant ; les issues GitHub deviendront le backlog public à l'ouverture du dépôt), pas dans un fichier. Si un skill gstack (`/ship`, `/review`…)
propose de créer `TODOS.md`, répondre **Skip** et signaler les éléments à ajouter au tableau.

## Structure

```
arbalete-browser/
  src/main/index.ts        processus principal : fenêtre, onglets (WebContentsView), navigation, IPC
  src/main/favicon.ts      filtre des favicons transmis à l'interface (https: ou data: image de 32 Ko au plus, ARB-35) ; test favicon.test.ts
  src/main/zoom.ts         zoom de la page de l'onglet actif (ARB-107) : geste reconnu selon la touche (Ctrl+=, Ctrl+-, Ctrl+0, Maj permis, AltGr écarté) et paliers de Chrome (25 % à 500 %) ; test zoom.test.ts ; F11 (plein écran) est dans index.ts
  src/main/navigationClavier.ts  Ctrl+Tab / Ctrl+Maj+Tab / Ctrl+PageUp/PageDown, Ctrl+1…9 (touche physique, 9 = dernier onglet), F5 / Ctrl+R et rechargement sans cache (Ctrl+F5, Maj+F5, Ctrl+Maj+R) (ARB-19, ARB-21) ; test navigationClavier.test.ts
  src/main/ongletsFermes.ts  pile des 10 derniers onglets fermés (adresses web et file: seulement) pour Ctrl+Maj+T (ARB-20) ; test ongletsFermes.test.ts
  src/main/apercuUrl.ts    aperçu de l'adresse d'un lien survolé (ARB-36, décision 0003) : texte filtré, placement de la bulle, document de sa vue native ; test apercuUrl.test.ts
  src/main/recherche.ts    recherche dans la page (ARB-70) : placement de la petite vue native au coin haut-droit de la page et texte accepté ; la vue charge l'interface avec `?vue=recherche` (`views/FindView.tsx`, compteur dans `src/shared/recherche.ts`), pilotée par `findInPage` du processus principal ; tests recherche.test.ts
  src/main/donnees/favoris.ts  favoris (ARB-47, ARB-49) : `estFavori`, `basculerFavori` et `favorisGrille` (les 8 premiers, grille de la barre latérale) sur la table `favori` (migration 4) ; l'adresse vient d'`adresseHistorique`, la page active est lue par `stateSnapshot` (index.ts) et le canal `browser:toggle-favorite` bascule ; test favoris.test.ts
  src/main/donnees/espaces.ts  espaces (ARB-60, EP-12) : table `espace` (nom, couleur = nom d'un token `--color-workspace-*`, icône, position ; migration 5), `onglet.espace` pour la liste d'onglets de chaque espace (session.ts), validation des champs ; types, couleurs et espaces d'origine dans `src/shared/espaces.ts` ; ARB-61 : `semerEspaces` (trois espaces au premier lancement, table vide), `lireEspaceActif` / `ecrireEspaceActif` (clé `pref.espace.actif`), couleur inconnue lue comme `personal`, canal `browser:set-workspace` et `changerEspace` (index.ts), règles de restauration `rattacherAuxEspaces` et `actifsParEspace` dans session.ts ; création, renommage, ordre et suppression par l'utilisateur : ARB-62 (canaux `browser:create-workspace`, `rename-workspace`, `move-workspace`, `delete-workspace` et fonctions `creerEspaceUtilisateur`… d'index.ts ; `champsNouvelEspace` et `ordreApresDeplacement` dans `src/shared/espaces.ts`) ; test espaces.test.ts
  src/main/suggestions.ts  suggestions de la barre d'adresse (ARB-53, décision 0002) : première ligne (chercher ou aller à), pages de l'historique (`rechercherPages` dans `donnees/historique.ts`), flèches en boucle, validation du texte et de l'index reçus ; l'état est tenu par index.ts, la liste est affichée par `components/SuggestionsOverlay.tsx` dans la vue de la barre, le champ (AddressBar) gardant le clavier ; tests suggestions.test.ts et historique.test.ts
  src/main/voisin.ts       onglet à activer à la fermeture de l'onglet actif : le voisin de droite, sinon celui de gauche (ARB-37) ; test voisin.test.ts
  src/main/bornes.ts       bornage du rectangle reçu par `browser:set-content-bounds` (ARB-104) ; urlDev.ts : lecture unique d'ELECTRON_RENDERER_URL, erreur claire si malformée ou hors http(s) (ARB-105) ; aboutBlank.ts : détection d'about:blank et plafond des retours en arrière (ARB-97) ; tests durcissement.test.ts
  src/main/donnees/        base SQLite (node:sqlite, décision 0001) : ouverture (réessais sur erreur d'E/S, ARB-132 ; confirmation de la corruption avant mise de côté et copie de secours `sauvegarde.ts`, ARB-131), migrations, dépôts, écriture différée, préférences (`preferences.ts`, clés `pref.*` de la table `etat`, ARB-59) ; tests *.test.ts
  src/preload/index.ts     pont IPC minimal exposé en window.arbalete
  src/shared/types.ts      types partagés main ↔ renderer (BrowserAPI, BrowserState)
  src/shared/barre.ts      barre latérale en trois états (ARB-123) : largeurs (étendue 252 par défaut, bornée à 200-400 ; compacte 68 ; bande de survol 6), transitions étendue / compacte / masquée, partagées par le processus principal et l'aperçu web ; test barre.test.ts
  src/renderer/src/        interface React : App.tsx (aiguillage fenêtre / barre), styles.css
  src/renderer/src/design-system/tokens.css  design tokens et palettes Dark / Light (ARB-34) : seules couleurs de l'interface
  src/renderer/src/design-system/fonts.css   @font-face d'Inter, Manrope et JetBrains Mono (ARB-121) ; licences OFL dans licences-polices/
  src/renderer/src/views/  MainView (fenêtre) et SidebarView (vue native de la barre, ?vue=barre)
  src/renderer/src/components/  Sidebar, TabList, TabItem (sept états visuels, ARB-124 ; logique pure dans tabState.ts), Toolbar (barre de contrôle, 48 px via `--size-control-bar`, ARB-31), NavigationControls (Précédent, Suivant, Recharger), AddressBar, WorkspaceSwitcher… (plus de barre d'état depuis ARB-36)
  src/renderer/src/components/ui/  Button, IconButton et Input (ARB-122) : seuls boutons d'action et champs de l'interface ; styles dans design-system/controls.css
  src/renderer/src/state.ts      hooks d'état suivis depuis le processus principal (onglets, barre, thème)
  src/renderer/src/shortcuts.ts  raccourcis d'onglets de l'aperçu web (dans Electron, le processus principal les intercepte)
  src/renderer/src/previewApi.ts  API simulée pour l'aperçu navigateur (hors Electron)
  vite-csp.ts              CSP de l'interface injectée dans index.html (stricte au build, assouplie en dev)
  resources/icone.ico      icône de l'application, 4 tailles (16, 32, 48, 256), passée en `icon` à BrowserWindow
  scripts/test-unitaire.mjs  lance les tests unitaires sous le Node d'Electron
  tests/                   tests Playwright (smoke.spec.ts, developpement.spec.ts)
  src/ci.test.ts           garde-fous de la CI (ARB-8) : lecture seule, actions épinglées, étapes attendues de `../.github/workflows/ci.yml`, clé du cache du binaire d'Electron alignée sur la version de `package.json`
```

## Commandes

Toutes les commandes se lancent dans `arbalete-browser/`.

| Commande | Rôle |
|---|---|
| `npm install` | Installer les dépendances |
| `npx install-electron` | Télécharger le binaire Electron : depuis Electron 42, `npm install` ne le fait plus. À relancer après chaque `npm ci` ou mise à jour d'Electron (réinstallation de `node_modules/electron`). Sans lui, `dev` et `preview` échouent avec « Electron uninstall » et `test:smoke` avec une erreur d'installation d'Electron |
| `npm run dev` | Lancer l'application Electron en développement |
| `npm run dev:web` | **Aperçu navigateur** de l'interface sur http://localhost:5180 (API simulée) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run build` | Build Electron (main, preload, renderer) dans `out/` |
| `npm run build:web` | Build de l'aperçu navigateur dans `out/web/` |
| `npm run test:unit` | Tests unitaires `node:test` (`src/**/*.test.ts`) sous le Node d'Electron, sans build : couche de données, design tokens, polices, composants de base, états des onglets, onglet voisin à la fermeture, bornage du rectangle de la page, lecture d'`ELECTRON_RENDERER_URL`, détection d'`about:blank`, aperçu de l'adresse survolée, recherche dans la page, zoom de page, raccourcis d'onglets et de rechargement, et garde-fous de la CI |
| `npm run test:smoke` | Build puis tests Playwright de l'app Electron : `tests/smoke.spec.ts` (app construite) et `tests/developpement.spec.ts` (mode développement, serveur Vite) |

## Testing

Test automatisé : un smoke test Playwright (`_electron`) depuis ARB-4, et depuis ARB-43 des tests unitaires `node:test`
sur la couche de données (lecture/écriture de la session, migrations, refus d'une base plus récente, mise de côté d'une base illisible) et, depuis ARB-34, sur les design tokens (aucune valeur hexadécimale hors de `tokens.css`, mêmes variables dans les deux palettes, `FOND_FENETRE` aligné sur `--color-background`, boutons Windows de `titleBarOverlay` alignés sur `--color-text-primary` et `--size-control-bar` depuis ARB-30, barre de contrôle zone de déplacement), puis depuis ARB-121 sur les polices (chaque famille des tokens a son `@font-face`, dont les six fichiers existent dans `node_modules`), puis depuis ARB-122 sur les boutons et champs de base (chaque variante définit ses états Hover et Active, Disabled est commun, focus et erreur des champs présents, aucun dégradé) ; EP-14 les étendra.
Il couvre le contrat de régression C1-C7, C11 et C12 : démarrage avec `window.arbalete`, barre d'adresse,
précédent/suivant, onglets, `target=_blank` en onglet, schéma non http et `about:blank` refusés, permissions refusées, bouton Recharger,
alignement de la vue web au redimensionnement. Depuis ARB-33, la barre latérale est une vue native au-dessus de la page :
masquée à l'ouverture, la page de l'onglet actif gardant alors le focus clavier (C31), elle apparaît au survol du bord gauche par-dessus la page et se retire à la sortie de la
souris ou au clic dans la page (C33) ; épinglée par le bouton (C9) ou Ctrl+Maj+B depuis la page (C32), la page lui laisse
sa place ; sa vue ne navigue pas, n'ouvre pas de fenêtre et pilote l'IPC, qu'elle perd une fois chargée sur une autre
page (C34) ; le thème choisi s'applique à la fenêtre et à la barre (`data-theme` sur `<html>`) ainsi qu'au fond natif de la fenêtre et aux couleurs des boutons Windows (ARB-30), et `set-theme` comme `set-sidebar` refusent un
argument hors liste (C35). Depuis ARB-18, Ctrl+L, Alt+←/→, Ctrl+T et Ctrl+W agissent depuis la page, la barre et la
fenêtre, interceptés par le processus principal sans atteindre la page ni doubler l'action ; Ctrl+T donne le clavier
à la barre d'adresse, Ctrl+W à l'onglet redevenu actif, et AltGr n'en déclenche aucun (C36). Depuis ARB-117, un second
lancement d'Arbalète se ferme et ouvre ses adresses web dans la première instance, restaurée si elle était réduite (C37). Depuis ARB-118, l'app des tests a son propre profil de données (C38), et une instance lancée sur un autre profil démarre au lieu de se fermer (C39). Depuis ARB-44, la session des onglets (ordre, onglet actif) est écrite sur disque une seconde après chaque changement et à la fermeture (C40) ; depuis ARB-45, elle revient au redémarrage, l'onglet actif chargé et les autres à leur premier affichage (C41). Depuis ARB-46, après un arrêt forcé, la session interrompue n'est ni rouverte ni écrasée : un bandeau propose de la restaurer (Restaurer, Ignorer), et une fermeture normale n'en appelle plus (C42 ; le test tue l'arborescence par `taskkill`). Depuis ARB-119, une base illisible est mise de côté sous `arbalete.db.corrompue-<date>` et remplacée par une base neuve (C43), une base d'une version plus récente reste intacte (C44), et un bandeau prévient l'utilisateur dans les deux cas. Depuis ARB-132, l'ouverture de la base réessaie jusqu'à 5 fois, à 500 ms d'écart, la seule erreur d'E/S SQLite (`SQLITE_IOERR`, « disk I/O error ») avant l'incident `indisponible` ; une base plus récente ou verrouillée n'est jamais réessayée. Depuis ARB-131, une base jugée illisible est rouverte 3 fois avant d'être mise de côté, et remplacée par la dernière copie de secours saine (`arbalete.db.sauvegarde`, puis `.precedente`, écrites par `VACUUM INTO` à la fermeture normale, et 30 s après le démarrage si la dernière a plus de 24 h ; la copie courante ne passe en `.precedente` que si elle a plus de 24 h) plutôt que par une base vide, un bandeau distinct annonçant alors que des changements récents ont pu être perdus ; la copie n'est jamais écrite depuis une base qui échoue à `quick_check`, et aucune copie n'est écrite pendant une session démarrée sur une corruption non restaurée (base neuve), pour ne pas écraser les copies existantes (C52 ; tests unitaires de `donnees.test.ts`, pause injectée). Depuis ARB-120, le refus des permissions couvre aussi les vérifications (`navigator.permissions` répond `denied`) et l'accès aux périphériques HID, série et USB (C45). Depuis ARB-51, chaque navigation d'un onglet vers une autre page est enregistrée dans l'historique avec son titre et une visite datée ; un rechargement ou un changement de fragment ne compte pas (C46). Depuis ARB-39 (décision 0002), le clic droit sur un onglet ouvre son menu dans la couche d'overlays : la vue de la barre couvre la fenêtre, au premier plan, suit le redimensionnement et ne se retire pas ; Échap (depuis la page, qui n'en reçoit ni l'appui ni le relâchement, alors qu'Échap lui revient hors overlay), un clic hors du menu, une entrée, la perte de focus de la fenêtre, un raccourci (qui agit ensuite) ou la fermeture de son onglet ailleurs le ferment et rendent à la barre sa taille, et seule la vue de la barre ouvre ou ferme un overlay (C47). Depuis ARB-121, Inter, Manrope et JetBrains Mono, embarquées sous licence OFL, se chargent sous la CSP stricte de l'interface (C48). Depuis ARB-124, un échec de chargement de la page principale met l'onglet en erreur (`error`), effacé par la navigation suivante vers un autre document (C49). Depuis ARB-35 et ARB-106, l'onglet affiche le favicon du site (https ou image data:, `src/main/favicon.ts`), `img-src` de la CSP admettant `https:` sans élargir `script-src` ni `style-src`, et le perd à la navigation (C50). Depuis ARB-30, la fenêtre est sans cadre (`titleBarStyle: 'hidden'` et `titleBarOverlay` de 48 px, couleurs suivies sur le thème) : la barre de contrôle déplace la fenêtre sans voler le clic de ses boutons ni de son champ, et laisse sa droite aux boutons Windows (C53 ; le déplacement réel et le survol des boutons restent manuels). Depuis ARB-32, la page s'affiche dans un cadre arrondi (marge de 8 px, rayon de 10 px, `RAYON_PAGE` jumeau de `--radius-md`) : la vue web suit `.web-content`, donc x vaut 8 barre masquée et 260 barre épinglée étendue à sa largeur par défaut (C31, C32, C9). Depuis ARB-97, une navigation du cadre principal vers `about:blank` (lien, avec ou sans `#` ou `?`) est défaite par un retour en arrière, plafonné à 2 par minute et par onglet, un sous-cadre gardant le droit d'y aller (C6). Depuis ARB-104, un rectangle aberrant reçu par `browser:set-content-bounds` est borné à la fenêtre (C54). Depuis ARB-59, le thème choisi est écrit en base au `set-theme` et relu avant la création de la fenêtre : il revient au redémarrage, fond natif compris, et une valeur inconnue en base redonne `system` (C56 ; tests unitaires de `preferences.test.ts`). Depuis ARB-60, la couche de données porte les espaces (table `espace`, `onglet.espace`, migration 5), sans IPC ni interface jusqu'à ARB-61 (ci-dessous) : tests unitaires de `espaces.test.ts` (création, ordre, champs invalides refusés, id d'espace périmé enregistré comme « aucun espace », suppression qui libère les onglets, migration d'une base au schéma 4 sans perte de session). Depuis ARB-62, le menu du sélecteur d'espace (barre étendue) crée, renomme, réordonne (monter, descendre) et supprime les espaces : un nouvel espace s'ajoute en fin de liste et s'affiche (nom nettoyé, couleur et icône suivantes de la liste), supprimer un espace ferme ses onglets après confirmation et affiche son voisin du dessous (sinon du dessus), le dernier espace ne se supprime pas, et noms, ordre et espace affiché reviennent au redémarrage (C76 ; tests unitaires `src/shared/espaces.test.ts` ; le mode compact n'offre pas cette gestion, le rendu du menu se vérifie dans l'aperçu web, et la couleur d'un espace ne se règle pas encore, ARB-63). Depuis ARB-36, il n'y a plus de barre d'état : survoler un lien affiche son adresse dans une petite vue native au bas de la page, sous la barre latérale, retirée à la sortie du lien, au changement d'onglet et à la navigation (C60 à C63 : retrait, thème, barre épinglée, vue verrouillée ; décision 0003 ; le passage de la bulle de l'autre côté sous la souris reste manuel). Depuis ARB-123, la barre épinglée est étendue (largeur réglable de 200 à 400 px, `set-sidebar-width`, poignée au bord droit) ou compacte (68 px, icônes et infobulles, `toggle-compact`), la page et la réserve suivent chaque mode, et le mode comme la largeur sont écrits en base (clés `pref.barre.*`) et relus avant la création de la fenêtre : une barre épinglée redémarre ouverte (C59 ; le glissement de la poignée reste manuel). Depuis ARB-37, fermer l'onglet actif active son voisin de droite, ou celui de gauche s'il était le dernier (`voisin.ts`, C57 ; test unitaire `voisin.test.ts`). Depuis ARB-112 et ARB-113, la page de l'onglet actif reprend le focus à chaque chargement de la vue de la barre masquée, différé jusqu'au retour du focus de la fenêtre si elle l'a perdu, avec un seul écouteur en attente (C58). Depuis ARB-115, l'interface démarre sans onglet fictif (`state.ts` ; l'aperçu navigateur crée ses propres onglets dans `previewApi.ts`). Depuis ARB-12/13/14, il vérifie
aussi le verrouillage de l'interface : CSP stricte au build (C13), appels IPC d'une autre page refusés (C14),
fenêtre d'interface qui ne navigue pas et n'ouvre pas de fenêtre (C15), fenêtre d'interface chargée sur une autre
page http (C16) ou sur un fichier local hors de `out/renderer`, quasi-homonyme compris (C17), qui perd l'IPC.
Depuis ARB-101/102, il vérifie aussi les ouvertures : pas de menu d'application (C19), F12 sans effet dans l'app
construite (C24), `window.open` d'une page limité aux adresses web (C20), au plus 5 ouvertures par onglet source
(C21, C22) et 20 toutes pages réunies (C26) par fenêtre de 10 secondes (C23), plus aucune ouverture par les pages
au-delà de 50 onglets ouverts, l'utilisateur gardant la main (C27).
Pages de test servies en http sur 127.0.0.1. `tests/developpement.spec.ts` vérifie qu'en développement
l'interface et la vue de la barre latérale, servies par le serveur Vite, gardent l'IPC sous la CSP assouplie (C18), et que F12 ouvre puis ferme ses
DevTools, que le focus soit dans l'interface (C25) ou dans un onglet (C28), qu'aucune autre touche ne les ouvre (C29)
et que la page de l'onglet ne reçoit pas F12 (C30). Depuis ARB-105, une `ELECTRON_RENDERER_URL` malformée ou hors http(s) fait échouer le démarrage avec un message clair (C55). Depuis ARB-107, les raccourcis du menu d'application retiré sont rétablis côté processus principal, comme ceux d'ARB-18 : Ctrl+=, Ctrl+- et Ctrl+0 (Maj permis, AltGr écarté) zooment la page de l'onglet actif par paliers de Chrome et jamais l'interface, que le focus soit dans la page, la barre ou la fenêtre, et F11 bascule le plein écran, la page suivant la zone de contenu ; aucune de ces touches n'arrive à la page, et Ctrl+Maj+I n'ouvre pas les DevTools de l'interface (C64, C65 ; test unitaire `zoom.test.ts` ; le zoom n'est pas conservé par site, ARB-71, et les touches d'un clavier AZERTY réel restent manuelles). Depuis ARB-19 et ARB-21, Ctrl+Tab, Ctrl+Maj+Tab et Ctrl+1…9 changent l'onglet actif dans l'ordre affiché (en boucle ; Ctrl+9 vise le dernier, un numéro sans onglet ne fait rien) et F5, Ctrl+R, Ctrl+F5 rechargent la page de l'onglet actif, d'où que vienne la touche (C66 ; test unitaire `navigationClavier.test.ts` ; le contournement du cache et un clavier AZERTY réel restent manuels). Depuis ARB-20, Ctrl+Maj+T rouvre le dernier onglet fermé (jusqu'à 10, les plus récents d'abord), l'active et lui donne le clavier ; il revient en fin de liste et sans son historique, et un onglet retiré par Arbalète (onglet de démarrage remplacé par la session) n'est pas mémorisé (C67, et C42 pour l'onglet remplacé par la session ; test unitaire `ongletsFermes.test.ts`). Depuis ARB-70, Ctrl+F ouvre la recherche dans la page dans une petite vue native (et non un overlay modal : la page garde défilement et clics) : compteur « 3/12 », Entrée et Maj+Entrée parcourent les résultats, Échap ou la croix ferment et rendent le clavier à la page, un autre onglet affiché la ferme, et seule sa vue la pilote, qui suit la page au redimensionnement (C68, C69 ; test unitaire `recherche.test.ts` ; le surlignage dans la page et le suivi d'une navigation restent manuels). Depuis ARB-53, taper dans la barre d'adresse ouvre sous le champ une liste dans la couche d'overlays (la vue de la barre couvre alors la fenêtre) : première ligne « Rechercher » ou « Aller à » (ce que ferait Entrée), puis les pages déjà visitées dont l'adresse ou le titre contient chaque mot ; le champ garde le clavier, les flèches (envoyées au processus principal) choisissent une ligne, Entrée ou un clic l'ouvre, Échap, un texte vide, Tab ou une navigation la referment, et seule la fenêtre envoie texte et flèches ; le schéma tapé (https://) n'est pas cherché, un texte de plus de 256 caractères ne donne pas de liste, un argument aberrant est refusé, un index hors liste ne fait rien, et un overlay déjà ouvert (un menu) n'est ni remplacé ni fermé par une suggestion (C70, C71 ; tests unitaires `suggestions.test.ts` et `historique.test.ts` ; les favoris ne sont pas encore proposés, le remplissage du champ par la ligne choisie reste à faire, et l'aperçu navigateur n'affiche pas de suggestions). Depuis ARB-47, l'étoile de la barre d'adresse ajoute la page de l'onglet actif aux favoris (table `favori`, `donnees/favoris.ts`, sous l'adresse d'historique : web seulement, sans identifiants ni fragment) et l'en retire ; l'état `favorite` de `BrowserState` la remplit, elle est inactive hors du web, et le favori revient au redémarrage (C72 ; test unitaire `favoris.test.ts` ; ni dossiers ni panneau de favoris, ARB-48). Depuis ARB-49, les 8 premiers favoris s'affichent en grille de tuiles (initiale du site) en haut de la barre latérale, sous le sélecteur d'espace (`favorites` de `BrowserState`, `favorisGrille`) ; un clic (`openFavorite`, canal `browser:open-favorite`) active l'onglet déjà ouvert sur la page ou l'ouvre dans un nouvel onglet, et refuse toute adresse qui n'est pas un favori enregistré (C73 ; test unitaire `favoris.test.ts` ; le rendu des tuiles et le mode compact restent manuels, sans favicon : la table `favori` n'en garde pas). Depuis ARB-61, la barre latérale liste les espaces du processus principal (`workspaces`, `activeWorkspaceId` de `BrowserState`) et `setWorkspace` (canal `browser:set-workspace`, argument entier exigé) change d'espace : `state.tabs` ne montre que les onglets de l'espace affiché, les autres restent ouverts et masqués ; chaque espace garde son dernier onglet actif, un espace sans onglet en ouvre un, un onglet d'un autre espace ne s'active pas, et la session écrit l'espace de chaque onglet (un seul onglet actif par espace, règle du code, pas de la base) ; l'espace affiché et l'onglet actif de chacun reviennent au redémarrage (C74 ; tests unitaires `espaces.test.ts`) ; Ctrl+Tab, Ctrl+1…9, la fermeture d'un onglet (le dernier d'un espace en rouvre un) et `openFavorite` ne regardent que l'espace affiché (C75), une page d'un espace masqué n'ouvre aucune fenêtre (`setWindowOpenHandler`, sans test), et un espace affiché sans onglet restauré reçoit son onglet du démarrage seulement si aucune adresse de lancement ne s'y ouvre (sans test) ; ARB-63 : la barre latérale porte un filet de 3 px à la couleur de l'espace affiché (`--espace-couleur` sur `.sidebar`, Sidebar.tsx), sans teinte de fond (le gris secondaire de la barre claire tombe sous 4,5:1 dès 2 % de teinte) ; couleur « Custom » non faite ; le rendu du sélecteur reste manuel, et la colonne `onglet.espace` des sessions écrites avant ARB-61 passe au premier espace. Depuis ARB-22, l'interface n'affiche plus de symbole ⌘ (« Ctrl K »). Restent manuels : C8 (thème système) et C10 (aperçu web).

La CSP de l'interface est injectée par `vite-csp.ts` : stricte au build, assouplie pour le serveur de dev
(`'unsafe-inline'`, WebSocket du HMR). L'avertissement Electron « Insecure Content-Security-Policy » en `npm run dev`
est donc attendu ; il ne doit jamais apparaître sur l'app construite.
La barrière locale avant une PR (`/ship` compris) :

```bash
cd arbalete-browser && npm run typecheck && npm run test:unit
```

`npm run test:smoke` n'est lancé en local que dans trois cas, la CI (job `smoke`, exigé par `PR-Rule`) le couvrant sinon :
la PR clôt le **dernier ticket d'une epic** (les autres étant Terminé dans Arbalète Suivi), le diff touche
`src/main`, `src/preload` ou l'IPC, ou l'utilisateur le demande. Ne pas relancer `typecheck` ni `test:unit`
si le dernier commit les a déjà passés au vert. Pendant le travail, préférer les `*.test.ts` du module modifié.

`test:smoke` ouvre des fenêtres Arbalète pendant quelques secondes. L'app des tests démarre sur une page locale
(`/demarrage.html`, adresse passée au lancement) : aucun test ne dépend du réseau. `developpement.spec.ts` seul charge
encore google.com au démarrage de l'app. En CI, le binaire d'Electron est mis en cache (`actions/cache` sur
`electron_config_cache`, clé `CLE_CACHE_ELECTRON` = `electron-windows-<version d'Electron>`, à changer avec la version épinglée) : un 502 de GitHub ne casse plus le téléchargement quand le zip y est déjà.
Les tests lancent l'app avec `ARBALETE_PROFIL_TEST` (ARB-118) : un dossier userData temporaire, supprimé à la fin,
qui ne touche jamais l'`arbalete.db` de l'utilisateur. Le verrou d'instance unique (ARB-117) dépend de ce dossier :
`test:smoke` tourne même si Arbalète (`npm run dev` compris) est ouvert. La variable est ignorée dans l'app empaquetée.

Pour tester l'interface avec `/qa`, `/qa-only`, `/design-review` ou `/browse` : lancer `npm run dev:web`
et viser **http://localhost:5180**. L'aperçu remplace les pages web par un cadre « Aperçu navigateur » :
il valide l'interface (onglets, barre latérale, thèmes, barre d'adresse), pas le rendu Chromium.
Ce qui touche à la navigation réelle, aux WebContentsView ou à l'IPC se teste dans `npm run dev`, sous Windows.

## Deploy Configuration

Aucun déploiement : Arbalète est une application de bureau. Pas d'environnement de production, pas d'URL.
`/land-and-deploy`, `/canary` et `/setup-deploy` ne s'appliquent pas. La distribution (installeur NSIS,
signature, mises à jour automatiques via GitHub Releases) est planifiée dans EP-14.

## Règles d'architecture (non négociables)

1. **Sécurité Electron** : `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` sur toutes
   les fenêtres et vues. Le renderer ne parle au processus principal que via `window.arbalete` (preload).
2. **IPC** : chaque canal est typé dans `src/shared/types.ts`, exposé dans le preload, et ses arguments
   sont validés côté main. Les nouveaux canaux vérifient l'émetteur (`event.senderFrame`).
3. **Pages web** : jamais d'accès Node, jamais le preload de l'interface. Permissions refusées par défaut.
4. **WebContentsView est une couche native au-dessus du HTML** : tout menu, palette ou dialogue qui déborde
   sur la zone de contenu sera masqué. Passer par la couche d'overlays (EP-06), ne pas contourner en CSS.
5. **Raccourcis clavier** : à gérer côté processus principal (`before-input-event` / menu), sinon ils ne
   fonctionnent pas quand le focus est dans une page.
6. **Windows d'abord** : chemins, fins de ligne (LF dans le dépôt), polices embarquées de `DESIGN.md` avec repli
   sur Segoe UI, barre de titre Windows.
7. **Fonctionnel avant visuel** : un bouton sans comportement réel est marqué comme tel dans le tableau
   de suivi. Chaque epic se termine par un livrable testable.

## Référentiel graphique obligatoire

Avant toute création ou modification d'interface, consulter `DESIGN.md` : c'est la référence officielle de
conception graphique et UX d'Arbalète (direction **Atmospheric Minimalism**). En cas de conflit entre une
proposition et le référentiel, signaler le conflit et son impact, proposer une solution compatible, et ne
modifier `DESIGN.md` qu'après validation.

- Respecter strictement les design tokens ; aucune valeur hexadécimale dans les composants.
- Maintenir les thèmes Dark, Light et System.
- Utiliser Amber comme couleur signature, réservée aux interactions et états actifs.
- Privilégier une densité d'interface minimale.
- Réutiliser les composants existants ; ne pas introduire de styles contradictoires.
- Documenter toute évolution du design system dans `DESIGN.md`.

## Conventions

- Branches : `arb-<n>-<description-courte>` pour les tickets du tableau (ex. `arb-12-ipc-sender`), `<numéro-issue>-<description>` pour les contributions externes.
- Commits : `<type>: <résumé>` avec `feat`, `fix`, `chore`, `refactor`, `docs`, `test` ; référencer le ticket
  dans le corps (`Ticket: ARB-12`).
- Une PR = un ticket ou une petite grappe de tickets d'une même epic.
- Version à 4 segments dans `VERSION` (`0.1.0.0`), gérée par `/ship`.
- Dépendances : `electron` est épinglé en version exacte (sans `^`), pour que le Chromium livré se lise dans
  `package.json` ; les autres dépendances gardent `^`, le `package-lock.json` fige l'installation.
  `@types/node` suit la majeure de Node embarquée par Electron (Node 24 pour Electron 45).
- CI (`.github/workflows/ci.yml`, ARB-8) : à chaque push sur `main` et chaque PR, sur `windows-latest`, deux jobs.
  `verifier` (phase 1) : `npm ci`, cache du binaire d'Electron (`actions/cache`, clé `CLE_CACHE_ELECTRON` = `electron-windows-<version>`, vérifiée par `src/ci.test.ts`), `npx install-electron`, `npm run typecheck`, `npm run test:unit` et `npm run build`.
  `smoke` (phase 2) : `npm ci`, même cache, `npx install-electron` et `npm run test:smoke`, sans nouvel essai automatique ; en cas
  d'échec, `arbalete-browser/test-results/` est gardé 7 jours dans l'artefact `smoke-test-results` (simple avertissement
  si le dossier est absent ou vide). Droits en lecture seule, actions épinglées par empreinte (Dependabot les met à jour), `continue-on-error` et les nouveaux essais
  interdits par `src/ci.test.ts`.
  Phase 3 : le badge CI du `README.md` suit `main`, et le ruleset GitHub `PR-Rule` (réglage du dépôt, hors Git) exige les deux
  contrôles « Typecheck, tests unitaires, build » et « Smoke test (Electron) » avant fusion. Renommer un job du workflow
  oblige à mettre à jour ce ruleset, sinon plus aucune PR ne fusionne.
- PR Dependabot : la CI couvre typecheck, tests unitaires, build et smoke ; fusionner une PR dont les deux jobs sont verts.

## Cycle de travail avec gstack

gstack enchaîne Réfléchir → Planifier → Construire → Revoir → Tester → Livrer → Rétro. Correspondance
avec le tableau Arbalète Suivi :

| Étape | Skill gstack | Quand l'utiliser sur Arbalète | Statut du ticket |
|---|---|---|---|
| Réfléchir | `/office-hours`, `/spec` | Début d'une epic floue (espaces, extensions) | À faire |
| Planifier | `/plan-eng-review` | Toute epic qui touche main/IPC/données (EP-02, 04, 06, 07, 12) | À faire |
| Planifier | `/plan-design-review`, `/design-consultation` | EP-05 (refonte Atmospheric Minimalism), faire évoluer `DESIGN.md` | À faire |
| Construire | — | Implémentation sur une branche `arb-<n>` | En cours |
| Revoir | `/review` | Avant chaque PR | En revue |
| Tester | `/qa` sur http://localhost:5180 | Tout changement d'interface | En revue |
| Sécurité (rapide) | `/cso` | Contrôle de routine : fin de chaque epic qui touche main, preload, IPC ou permissions | En revue |
| Sécurité (audit complet) | skill `security-audit` (Cloudflare) | Jalons : fin d'EP-02, avant le passage en public (ARB-91), avant d'activer les extensions (EP-04), avant chaque version distribuée (EP-14) | En revue |
| Déboguer | `/investigate` | Bug dont la cause n'est pas évidente | En cours |
| Livrer | `/ship` | Ticket terminé : sync main, vérifs, VERSION, CHANGELOG, PR | Terminé |
| Rétro | `/retro` | Fin de chaque epic | — |

Garde-fous utiles : `/careful` avant une opération destructive, `/freeze <dossier>` pour limiter les
modifications à une zone (ex. `arbalete-browser/src/renderer` pendant EP-05).

### Audits de sécurité

Deux niveaux complémentaires :

- **`/cso` (gstack)** : revue rapide de la posture de sécurité, à lancer souvent.
- **`security-audit` (Cloudflare, https://github.com/cloudflare/security-audit-skill)** : audit approfondi en six
  phases (reconnaissance, chasse guidée par la couverture, validation adverse par un agent indépendant,
  rapport). Coûteux en temps et en jetons : réservé aux jalons du tableau ci-dessus. Le lancer explicitement :
  « audit de sécurité complet de ce dépôt ». Fichiers de référence les plus utiles pour Arbalète :
  `DESKTOP-MOBILE-AND-LOCAL-IPC.md` (pont webview, IPC, preload), `CLIENT-SIDE.md`,
  `SUPPLY-CHAIN-AND-RELEASE.md` (dépendances, mises à jour, extensions).

Règles pour les résultats d'audit :

1. **Jamais dans le dépôt** : la sortie reste dans `~/security-audit-skill/arbalete/run-<N>` (valeur par défaut).
   Le dépôt deviendra public (ARB-91) : un rapport de failles non corrigées ne doit pas y être commité.
2. Chaque faille `confirmed` devient un **avis de sécurité privé GitHub** (onglet Security), pas une issue publique,
   et un ticket dans le tableau sans détail exploitable.
3. Les éléments `needs_validation` sont vérifiés sous Windows dans `npm run dev` avant d'être classés.
4. Les audits sont cumulatifs : relancer sur le même dossier de sortie pour combler les trous de couverture.

Skills **non pertinents** ici : `/land-and-deploy`, `/canary`, `/setup-deploy`, `/benchmark` (Core Web Vitals
d'un site), les skills `ios-*`, `/supabase`, `/ubicloud`.

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience (Windows : Git for Windows, Bun et Node.js requis) :

```powershell
git clone --depth 1 https://github.com/garrytan/gstack.git $HOME\.claude\skills\gstack
cd $HOME\.claude\skills\gstack
.\setup.ps1 --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use ~/.claude/skills/gstack/... for gstack file paths.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to skills in the session's available-skills list; answer directly for quick questions or small scoped edits.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate, unless one read-only check confirms the cause and a narrow fix (then fix it and run the focused test)
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

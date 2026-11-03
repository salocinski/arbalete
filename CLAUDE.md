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
| Design | `DESIGN.md` (racine) |
| Décisions techniques | `docs/decisions/` (une fiche numérotée par choix structurant, ex. `0001-stockage.md`) |
| Historique des versions | `VERSION` et `CHANGELOG.md` |
| Licence | **GPL-3.0-or-later** (`LICENSE`) : tout code ajouté doit être compatible (pas de dépendance sous licence propriétaire ou incompatible GPL) |
| Contribution externe | `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` |

Le backlog vit dans Arbalète Suivi (privé pour l'instant ; les issues GitHub deviendront le backlog public à l'ouverture du dépôt), pas dans un fichier. Si un skill gstack (`/ship`, `/review`…)
propose de créer `TODOS.md`, répondre **Skip** et signaler les éléments à ajouter au tableau.

## Structure

```
arbalete-browser/
  src/main/index.ts        processus principal : fenêtre, onglets (WebContentsView), navigation, IPC
  src/main/donnees/        base SQLite (node:sqlite, décision 0001) : ouverture, migrations, dépôts, écriture différée ; tests *.test.ts
  src/preload/index.ts     pont IPC minimal exposé en window.arbalete
  src/shared/types.ts      types partagés main ↔ renderer (BrowserAPI, BrowserState)
  src/renderer/src/        interface React : App.tsx (aiguillage fenêtre / barre), styles.css
  src/renderer/src/views/  MainView (fenêtre) et SidebarView (vue native de la barre, ?vue=barre)
  src/renderer/src/components/  Sidebar, TabList, Toolbar, AddressBar, WorkspaceSwitcher, StatusBar…
  src/renderer/src/state.ts      hooks d'état suivis depuis le processus principal (onglets, barre, thème)
  src/renderer/src/shortcuts.ts  raccourcis d'onglets de l'aperçu web (dans Electron, le processus principal les intercepte)
  src/renderer/src/previewApi.ts  API simulée pour l'aperçu navigateur (hors Electron)
  vite-csp.ts              CSP de l'interface injectée dans index.html (stricte au build, assouplie en dev)
  scripts/test-unitaire.mjs  lance les tests unitaires sous le Node d'Electron
  tests/                   tests Playwright (smoke.spec.ts, developpement.spec.ts)
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
| `npm run test:unit` | Tests unitaires `node:test` (`src/**/*.test.ts`) sous le Node d'Electron, sans build : couche de données |
| `npm run test:smoke` | Build puis tests Playwright de l'app Electron : `tests/smoke.spec.ts` (app construite) et `tests/developpement.spec.ts` (mode développement, serveur Vite) |

## Testing

Test automatisé : un smoke test Playwright (`_electron`) depuis ARB-4, et depuis ARB-43 des tests unitaires `node:test`
sur la couche de données (lecture/écriture de la session, migrations, refus d'une base plus récente, mise de côté d'une base illisible) ; EP-14 les étendra.
Il couvre le contrat de régression C1-C7, C11 et C12 : démarrage avec `window.arbalete`, barre d'adresse,
précédent/suivant, onglets, `target=_blank` en onglet, schéma non http refusé, permissions refusées, bouton Recharger,
alignement de la vue web au redimensionnement. Depuis ARB-33, la barre latérale est une vue native au-dessus de la page :
masquée à l'ouverture (C31), elle apparaît au survol du bord gauche par-dessus la page et se retire à la sortie de la
souris ou au clic dans la page (C33) ; épinglée par le bouton (C9) ou Ctrl+Maj+B depuis la page (C32), la page lui laisse
sa place ; sa vue ne navigue pas, n'ouvre pas de fenêtre et pilote l'IPC, qu'elle perd une fois chargée sur une autre
page (C34) ; le thème choisi s'applique à la fenêtre et à la barre, et `set-theme` comme `set-sidebar` refusent un
argument hors liste (C35). Depuis ARB-18, Ctrl+L, Alt+←/→, Ctrl+T et Ctrl+W agissent depuis la page, la barre et la
fenêtre, interceptés par le processus principal sans atteindre la page ni doubler l'action ; Ctrl+T donne le clavier
à la barre d'adresse, Ctrl+W à l'onglet redevenu actif, et AltGr n'en déclenche aucun (C36). Depuis ARB-117, un second
lancement d'Arbalète se ferme et ouvre ses adresses web dans la première instance, restaurée si elle était réduite (C37). Depuis ARB-118, l'app des tests a son propre profil de données (C38), et une instance lancée sur un autre profil démarre au lieu de se fermer (C39). Depuis ARB-44, la session des onglets (ordre, onglet actif) est écrite sur disque une seconde après chaque changement et à la fermeture (C40) ; depuis ARB-45, elle revient au redémarrage, l'onglet actif chargé et les autres à leur premier affichage (C41). Depuis ARB-46, après un arrêt forcé, la session interrompue n'est ni rouverte ni écrasée : un bandeau propose de la restaurer (Restaurer, Ignorer), et une fermeture normale n'en appelle plus (C42 ; le test tue l'arborescence par `taskkill`). Depuis ARB-119, une base illisible est mise de côté sous `arbalete.db.corrompue-<date>` et remplacée par une base neuve (C43), une base d'une version plus récente reste intacte (C44), et un bandeau prévient l'utilisateur dans les deux cas. Depuis ARB-120, le refus des permissions couvre aussi les vérifications (`navigator.permissions` répond `denied`) et l'accès aux périphériques HID, série et USB (C45). Depuis ARB-12/13/14, il vérifie
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
et que la page de l'onglet ne reçoit pas F12 (C30). Restent manuels : C8 (thème système) et C10 (aperçu web).

La CSP de l'interface est injectée par `vite-csp.ts` : stricte au build, assouplie pour le serveur de dev
(`'unsafe-inline'`, WebSocket du HMR). L'avertissement Electron « Insecure Content-Security-Policy » en `npm run dev`
est donc attendu ; il ne doit jamais apparaître sur l'app construite.
La barrière minimale avant une PR :

```bash
cd arbalete-browser && npm run typecheck && npm run test:unit && npm run test:smoke
```

`test:smoke` ouvre des fenêtres Arbalète pendant quelques secondes. Le premier onglet charge google.com :
le démarrage demande le réseau, pas les assertions.
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
6. **Windows d'abord** : chemins, fins de ligne (LF dans le dépôt), polices Segoe UI, barre de titre Windows.
7. **Fonctionnel avant visuel** : un bouton sans comportement réel est marqué comme tel dans le tableau
   de suivi. Chaque epic se termine par un livrable testable.

## Conventions

- Branches : `arb-<n>-<description-courte>` pour les tickets du tableau (ex. `arb-12-ipc-sender`), `<numéro-issue>-<description>` pour les contributions externes.
- Commits : `<type>: <résumé>` avec `feat`, `fix`, `chore`, `refactor`, `docs`, `test` ; référencer le ticket
  dans le corps (`Ticket: ARB-12`).
- Une PR = un ticket ou une petite grappe de tickets d'une même epic.
- Version à 4 segments dans `VERSION` (`0.1.0.0`), gérée par `/ship`.
- Dépendances : `electron` est épinglé en version exacte (sans `^`), pour que le Chromium livré se lise dans
  `package.json` ; les autres dépendances gardent `^`, le `package-lock.json` fige l'installation.
  `@types/node` suit la majeure de Node embarquée par Electron (Node 24 pour Electron 45).
- PR Dependabot : pas de CI avant ARB-8. Avant de fusionner, récupérer la branche puis lancer dans `arbalete-browser/`
  `npm ci`, `npx install-electron`, `npm run typecheck` et `npm run test:smoke`.

## Cycle de travail avec gstack

gstack enchaîne Réfléchir → Planifier → Construire → Revoir → Tester → Livrer → Rétro. Correspondance
avec le tableau Arbalète Suivi :

| Étape | Skill gstack | Quand l'utiliser sur Arbalète | Statut du ticket |
|---|---|---|---|
| Réfléchir | `/office-hours`, `/spec` | Début d'une epic floue (espaces, extensions) | À faire |
| Planifier | `/plan-eng-review` | Toute epic qui touche main/IPC/données (EP-02, 04, 06, 07, 12) | À faire |
| Planifier | `/plan-design-review`, `/design-consultation` | EP-05 (refonte Arc), affiner `DESIGN.md` | À faire |
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

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
| Historique des versions | `VERSION` et `CHANGELOG.md` |
| Licence | **GPL-3.0-or-later** (`LICENSE`) : tout code ajouté doit être compatible (pas de dépendance sous licence propriétaire ou incompatible GPL) |
| Contribution externe | `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` |

Le backlog vit dans Arbalète Suivi (privé pour l'instant ; les issues GitHub deviendront le backlog public à l'ouverture du dépôt), pas dans un fichier. Si un skill gstack (`/ship`, `/review`…)
propose de créer `TODOS.md`, répondre **Skip** et signaler les éléments à ajouter au tableau.

## Structure

```
arbalete-browser/
  src/main/index.ts        processus principal : fenêtre, onglets (WebContentsView), navigation, IPC
  src/preload/index.ts     pont IPC minimal exposé en window.arbalete
  src/shared/types.ts      types partagés main ↔ renderer (BrowserAPI, BrowserState)
  src/renderer/src/        interface React (App.tsx, styles.css)
  src/renderer/src/previewApi.ts  API simulée pour l'aperçu navigateur (hors Electron)
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
| `npm run test:smoke` | Build puis smoke test Playwright de l'app Electron (`tests/smoke.spec.ts`) |

## Testing

Test automatisé : un smoke test Playwright (`_electron`) depuis ARB-4 ; EP-14 l'étendra et ajoutera Vitest.
Il couvre le contrat de régression C1-C7, C9, C11 et C12 : démarrage avec `window.arbalete`, barre d'adresse,
précédent/suivant, onglets, `target=_blank` en onglet, schéma non http refusé, permissions refusées, repli de la
barre latérale, bouton Recharger, alignement de la vue web au redimensionnement. Pages de test servies en http sur
127.0.0.1. Restent manuels : C8 (thème système) et C10 (aperçu web).
La barrière minimale avant une PR :

```bash
cd arbalete-browser && npm run typecheck && npm run test:smoke
```

`test:smoke` ouvre des fenêtres Arbalète pendant quelques secondes. Le premier onglet charge google.com :
le démarrage demande le réseau, pas les assertions.

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
| Sécurité | `/cso` | Fin d'EP-02, puis avant chaque version publique | En revue |
| Déboguer | `/investigate` | Bug dont la cause n'est pas évidente | En cours |
| Livrer | `/ship` | Ticket terminé : sync main, vérifs, VERSION, CHANGELOG, PR | Terminé |
| Rétro | `/retro` | Fin de chaque epic | — |

Garde-fous utiles : `/careful` avant une opération destructive, `/freeze <dossier>` pour limiter les
modifications à une zone (ex. `arbalete-browser/src/renderer` pendant EP-05).

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

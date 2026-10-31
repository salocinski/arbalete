# Contribuer à Arbalète

Merci de ton intérêt ! Ce guide explique comment proposer une modification.
En participant, tu acceptes de respecter le [code de conduite](CODE_OF_CONDUCT.md).

## Avant de commencer

- **Bug** : ouvre une issue avec le modèle « Signaler un bug ».
- **Nouvelle fonctionnalité** : ouvre d'abord une issue ou une discussion, pour valider l'idée avant
  d'écrire du code. Une PR non discutée sur une grosse fonctionnalité risque d'être refusée.
- **Faille de sécurité** : jamais en public, voir [SECURITY.md](SECURITY.md).
- Les issues marquées `good first issue` sont un bon point de départ.

## Installer le projet

Prérequis : Windows 10/11, Node.js LTS, Git.

```powershell
git clone https://github.com/<ton-compte>/arbalete.git   # ton fork
cd arbalete\arbalete-browser
npm install
npx install-electron   # télécharge le binaire Electron, que npm install ne récupère plus
npm run dev
```

`npx install-electron` est à relancer après chaque `npm ci` ou mise à jour d'Electron (par exemple après avoir
récupéré une PR Dependabot) : sans le binaire, `npm run dev` et `npm run test:smoke` échouent.

`npm run dev:web` lance l'interface seule dans un navigateur (API Electron simulée) : pratique pour
travailler sur l'interface sans redémarrer Electron.

## Proposer une modification

1. **Forke** le dépôt et crée une branche depuis `main` : `<numéro-issue>-<description-courte>`
   (ex. `42-raccourci-ctrl-tab`).
2. Fais des commits ciblés au format `<type>: <résumé>`, avec `feat`, `fix`, `refactor`, `docs`, `test` ou `chore`.
   Exemple : `fix: activer l'onglet voisin à la fermeture`.
3. Vérifie avant d'ouvrir la PR :
   ```powershell
   npm run typecheck
   npm run build
   npm run test:smoke
   ```
4. Ouvre une **pull request** vers `main` en remplissant le modèle. Mentionne l'issue (`Fixes #42`).
5. Une PR est fusionnée par un mainteneur après revue, en *squash* (un commit par PR).

## Règles du projet

Elles sont détaillées dans [CLAUDE.md](CLAUDE.md) (lu aussi par les assistants IA). Les principales :

- **Sécurité Electron** : `contextIsolation`, `sandbox` activés, `nodeIntegration` désactivé. L'interface ne
  parle au processus principal que via le preload (`window.arbalete`), avec des canaux IPC typés et validés.
- **Fonctionnel avant visuel** : pas de bouton sans comportement réel.
- **Windows d'abord** : polices, raccourcis et conventions Windows.
- **Design** : suivre [DESIGN.md](DESIGN.md).
- **Langue** : le projet est en français (code commenté, commits, documentation).

## Assistants IA

Les contributions écrites avec l'aide d'une IA sont acceptées, à condition que tu aies relu et compris le
code proposé. Le projet est configuré pour [gstack](https://github.com/garrytan/gstack) (Claude Code) :
son utilisation est facultative.

## Licence des contributions

Arbalète est sous licence GPL-3.0-or-later. En soumettant une contribution, tu acceptes qu'elle soit
distribuée sous cette même licence, et tu confirmes avoir le droit de la soumettre.

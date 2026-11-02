# 0001 — Stockage des données : SQLite intégré (`node:sqlite`)

- **Statut** : proposée (ARB-42, EP-07)
- **Date** : 2026-11-02
- **Concerne** : onglets et session (EP-07), favoris (EP-08), historique (EP-09), espaces (EP-12)

## Contexte

Arbalète ne garde rien entre deux lancements : fermer l'application perd les onglets. EP-07 doit créer une
couche de données dans le processus principal, réutilisée ensuite par les favoris, l'historique et les espaces.

Besoins à couvrir :

| Besoin | Origine | Exigence |
|---|---|---|
| Session (onglets, ordre, onglet actif) | ARB-44, ARB-45 | Écriture fréquente, petite, anti-rebond ; survivre à un arrêt brutal (ARB-46) |
| Favoris et dossiers | ARB-47, ARB-48 | Relations simples, quelques centaines de lignes |
| Historique des visites | ARB-51 | Une écriture par navigation, des dizaines de milliers de lignes à terme |
| Recherche et suggestions | ARB-52, ARB-53 | Recherche plein texte titre + URL, réponse à chaque frappe |
| Effacement par période | ARB-54 | Suppression par plage de dates |
| Espaces | ARB-60, ARB-61 | Rattacher les onglets à un espace |

Contraintes : Windows d'abord, installeur NSIS (EP-14), mises à jour fréquentes d'Electron (Dependabot),
licence GPL-3.0-or-later, schéma versionné avec migrations (ARB-43).

## Options étudiées

### A. Fichiers JSON

Simple et lisible, aucune dépendance. Mais :

- pas de requête : l'historique et les suggestions demanderaient de tout charger en mémoire et de filtrer à la main ;
- chaque écriture réécrit le fichier entier, et il faut écrire dans un fichier temporaire puis renommer pour ne pas
  corrompre après un arrêt brutal ;
- migrations et index à réinventer.

Convient à la session seule, pas à l'historique.

### B. `better-sqlite3`

SQLite mûr, API synchrone, licence MIT (compatible GPL). Mais c'est un **module natif** :

- il faut le recompiler pour l'ABI d'Electron (`@electron/rebuild` ou binaires précompilés) à chaque mise à jour
  d'Electron, donc à chaque PR Dependabot ;
- il doit sortir de l'archive asar (`asarUnpack`) dans l'installeur ;
- il dépend d'une chaîne de compilation C++ sous Windows quand aucun binaire précompilé ne correspond.

### C. `node:sqlite` (module intégré à Node)

SQLite compilé dans le binaire d'Electron lui-même. Mesuré dans **Electron 45.1.0** (Node 24.22.1, SQLite 3.53.4),
avec `ELECTRON_RUN_AS_NODE` :

- `require('node:sqlite')` fonctionne sans option ni avertissement ;
- WAL (`journal_mode=wal`) sur fichier : OK ;
- FTS5 (recherche plein texte, préfixe `navig*`) : OK ;
- fonctions JSON (`json_extract`) : OK ;
- 10 000 insertions en une transaction : 31 ms.

Rien à compiler, rien à décompresser de l'asar, rien à ajouter à `package.json` : la base suit automatiquement la
version d'Electron épinglée. API synchrone proche de `better-sqlite3` (`DatabaseSync`, `prepare`, `run`, `get`, `all`).

Risque : la documentation de Node 24 classe le module en « Stability 1.2 – Release candidate » depuis Node 24.15.0,
pas encore « stable ». Une évolution d'API reste possible, mais peu probable, d'une version d'Electron à l'autre.

## Décision

**Option C : `node:sqlite`, derrière une couche d'accès propre au processus principal.**

- Une seule base `arbalete.db` dans `app.getPath('userData')`, ouverte par le processus principal uniquement.
  Le renderer et les pages n'y accèdent jamais directement : tout passe par des canaux IPC typés et validés
  (règles d'architecture 1 à 3).
- WAL activé, `synchronous=NORMAL` : écritures rapides et base intacte après un arrêt brutal.
- Schéma versionné par `PRAGMA user_version`, migrations numérotées appliquées dans une transaction au démarrage.
- Tout le code SQL vit dans un module `src/main/donnees/` (ARB-43). Le reste du processus principal appelle des
  fonctions métier (`sauverSession`, `ajouterVisite`…), jamais `node:sqlite` directement. Si l'API de `node:sqlite`
  change ou pose problème, seul ce module bascule vers `better-sqlite3`, dont l'API est presque identique.

## Conséquences

- ARB-43 crée le module, la première migration et les tests de lecture/écriture.
- L'API est synchrone et s'exécute dans le processus principal : les écritures restent petites et groupées
  (anti-rebond pour la session, transaction par lot pour l'historique). Une requête lente bloquerait l'interface.
- Chaque mise à jour d'Electron doit garder le test du module de données au vert : c'est lui qui détecte un
  changement d'API de `node:sqlite`.
- Les tests unitaires du module (Vitest, prévu en EP-14) devront tourner sous le Node d'Electron
  (`ELECTRON_RUN_AS_NODE=1`) ou sous un Node 24 local, qui fournit le même module.

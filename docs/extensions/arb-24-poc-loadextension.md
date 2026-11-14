# ARB-24 — POC : charger une extension non empaquetée (`session.extensions`)

Relevé du 2026-11-14 sous Windows 10, **Electron 45.2.3 (Chromium 156.0.8078.80)**. Script : `arbalete-browser/scripts/poc-extensions.mjs` (`npx electron scripts/poc-extensions.mjs`, extensions décompressées dans `arbalete-browser/.poc/ext/`, dossier ignoré par Git). Le script n'est lié à aucun code de l'application : Arbalète ne charge aucune extension tant que l'audit de sécurité d'EP-04 (ARB-95) n'est pas fait.

## Méthode

Pour chaque extension : une session persistante jetable (profil sous `%TEMP%`), `session.extensions.loadExtension(dossier)`, ouverture d'une page locale servie en http (qui appelle un hôte de publicité connu), attente de 8 s, puis relevé des erreurs du service worker, des requêtes refusées et de l'effet visible sur la page.

## Résultats

| Extension | Version | `loadExtension` | Fonctionne | Cause de l'écart |
|---|---|---|---|---|
| Dark Reader | 4.9.135 | Chargée | **Oui** : 10 éléments `style.darkreader` injectés dans la page, service worker actif | Avertissements sans effet : permissions `fontSettings` et `contextMenus` inconnues, directive CSP `navigate-to` non reconnue |
| Bitwarden | 2026.10.2 | Chargée | **Non** : le service worker plante au démarrage (`Cannot read properties of undefined (reading 'onCommitted')`, enregistrement refusé, code 15) | `chrome.webNavigation` absent ; permissions `contextMenus`, `sidePanel`, `webNavigation`, `notifications` et `privacy` inconnues |
| uBlock Origin Lite | 2026.1110.1816 | Chargée | **Non** : le service worker plante (`reading 'onCommand'`), aucune requête publicitaire bloquée | `chrome.commands` absent ; le blocage par `declarativeNetRequest` n'est pas démontré, il reste à tester une fois le service worker sauvé (ARB-25) |
| 1Password | — | Non testé | — | Source fermée, installable seulement depuis le Chrome Web Store : dépend d'ARB-26 |
| Immersive Translate | — | Non testé | — | Source fermée, installable seulement depuis le Chrome Web Store : dépend d'ARB-26 |

## Ce qu'on retient

- `loadExtension` accepte les extensions MV3 non empaquetées, y compris sous un nom `__MSG_…__` (noms localisés) ; il refuse toute session temporaire (« Extensions cannot be loaded in a temporary session ») : il faut une partition `persist:`.
- Electron n'implémente qu'une partie des API `chrome.*` : l'absence d'un seul espace de noms (`webNavigation`, `commands`) suffit à tuer le service worker d'une extension qui l'utilise sans garde. Une extension qui n'a besoin que de scripts de contenu (Dark Reader) fonctionne.
- Le comblement de ces API (`webNavigation`, `commands`, `contextMenus`, `sidePanel`, `notifications`) est donc le vrai travail d'EP-04 : ARB-25 (`electron-chrome-extensions`) est le candidat à tester ensuite sur Bitwarden et uBOL Lite.
- Un script Electron en ES module ne doit pas contenir d'`await` au plus haut niveau : `ready` n'arrive jamais, le processus reste suspendu. Le POC l'évite.

## Non couvert

Popup, options, `chrome.storage` persistant, messagerie native (`nativeMessaging`), chargement de l'extension dans la session d'Arbalète et installation depuis un `.crx` ou le Web Store (ARB-26).

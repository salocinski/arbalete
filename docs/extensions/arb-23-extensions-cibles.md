# ARB-23 : extensions Chrome visées et API qu'elles utilisent

Spike d'EP-04 (POC extensions Chrome). Entrée de ARB-24, ARB-25 et ARB-27 (décision Go / No-Go).
Date : 2026-11-14. Electron visé : 45.2.3.

**Fiabilité des données.** `[M]` = lu dans le manifest brut (relu une seconde fois pour uBO, uBOL,
Bitwarden et Dark Reader). `[C]` = lu dans un fichier de code précis, **pas** un grep exhaustif.
`[T]` = source tierce. `[D]` = déduit. Aucune liste d'API ci-dessous n'est exhaustive : la recherche de
code GitHub n'était pas accessible. ARB-24 et ARB-25 tranchent par l'essai, pas par ce tableau.

## Extensions retenues

| Extension | Pourquoi | Source du code |
|---|---|---|
| uBlock Origin Lite (MV3) | Bloqueur de pub, cas `declarativeNetRequest` | ouverte |
| uBlock Origin (MV2) | Référence `webRequest` bloquant, **hors store Chrome** (MV2 retiré), témoin seulement | ouverte |
| Bitwarden | Gestionnaire de mots de passe, autoremplissage, service worker | ouverte |
| 1Password | Idem, avec `nativeMessaging` vers l'app de bureau | **fermée** |
| Dark Reader | Content scripts massifs, peu de permissions | ouverte |
| Immersive Translate | Traducteur, content scripts sur toutes les pages | **fermée** |

Les cibles d'EP-04 sont uBOL, Bitwarden, 1Password, Dark Reader et Immersive Translate ;
uBO MV2 n'est qu'un témoin de comparaison.

## Tableau extension → API requises

| API / fonction | uBOL | uBO MV2 | Bitwarden | 1Password | Dark Reader | Immersive T. |
|---|---|---|---|---|---|---|
| Manifest | 3 [M] | 2 [M] | 3 [M] | 3 [T] | 3 [M] | 3 [T] |
| Fond | service worker | page | service worker | ? | service worker | ? |
| `storage` | oui | oui | oui | oui [T] | oui (local + sync) | oui [T] |
| `tabs` | oui [C] | oui | oui [C] | oui [T] | ? | ? |
| `scripting` | oui [C] | non | oui | oui [T] | oui (déclaré) | ? |
| `webRequest` | non | **bloquant** [C] | oui (+ `webRequestAuthProvider`) | `webRequestAuthProvider` [T] | non | oui [T] |
| `declarativeNetRequest` | **cœur** [M] | non | non | `...WithHostAccess` [T] | non | `...WithHostAccess` [T] |
| `webNavigation` | non | oui | oui [C] | oui [T] | non | ? |
| `action` + popup | oui | oui (`browser_action`) | oui | oui [T] | oui | ? |
| `contextMenus` | non | oui | oui | oui [T] | non | ? |
| `commands` (raccourcis) | oui | oui | oui (6) | ? | `getAll` seulement [C] | ? |
| `alarms` | oui | oui | oui | oui [T] | oui | ? |
| `offscreen` | oui | non | oui | oui [T] | non | ? |
| `nativeMessaging` | non | non | optionnel [M] | **oui** [T] | non | ? |
| `sidePanel` | non | non | déclaré, inactif [D] | ? | non | ? |
| `userScripts` | oui [M] | non | non | ? | non | ? |
| `privacy` | non | oui | optionnel | oui [T] | non | ? |
| `notifications`, `idle`, `clipboard*` | non | non | oui | partiel [T] | non | ? |
| `windows` | oui [C] | ? | oui [C] | ? | non | ? |
| `management`, `downloads`, `bookmarks` | non | non | `management` [C] | oui [T] | non | ? |
| `fontSettings` | non | non | non | non | oui [M] | non |
| Content scripts | aucun | tous cadres, `document_start` | tous cadres, `document_start` | ? | `world: MAIN` + `ISOLATED`, tous cadres | ? |
| Hôtes | `<all_urls>` | `<all_urls>` | `http(s)://*/*` | `<all_urls>` [T] | `*://*/*` | tous sites [T] |

`?` = non établi (source fermée ou fichier non lu), à relever par l'essai.

## Détails utiles par extension

- **uBOL** : 56 jeux de règles DNR, 6 actifs par défaut ; filtrage entièrement déclaratif, le service worker ne
  s'éveille que pour le popup et les options [T README]. Utilise `userScripts.configureWorld`, `windows.create`,
  `runtime.onUserScriptMessage`. La seule API réseau est `declarativeNetRequest`.
- **uBO MV2** : `webRequest` en mode `blocking` sur `onHeadersReceived` [C, `traffic.js`]. Inutilisable tel quel
  sur le store ; sert à mesurer ce qu'Electron sait faire sans passer par DNR.
- **Bitwarden** : 6 commandes clavier, `connectNative` dans le code mais permission `nativeMessaging` seulement
  optionnelle, `sidePanel.open/setOptions` appelés [C], `minimum_chrome_version` 134. Le panneau latéral du manifest
  n'est qu'un espace réservé de build.
- **1Password** : 18 permissions relevées par une analyse tierce d'une version antérieure (8.12.8.26, le store
  affiche 8.12.44.33) ; dialogue avec l'app de bureau par Native Messaging (l'app vérifie l'ID de l'extension).
  C'est le cas le plus à risque : il demande aussi un **ID d'extension connu**, donc une installation depuis
  le Chrome Web Store (ARB-26), pas un chargement non empaqueté.
- **Dark Reader** : seules `alarms`, `fontSettings`, `scripting`, `storage` en permissions. Le script `proxy.js` tourne
  dans le monde MAIN, ce qui exige que le chargement des content scripts d'Electron respecte `world`.
- **Immersive Translate** : code non public, manifest non lu. Faits limités à des tiers (extscope, AMO).
  À remplacer par un traducteur open source si ARB-24 en a besoin.

## Prise en charge par Electron (ce que disent les sources)

| API | Électron 45 (doc officielle) | `electron-chrome-extensions` (README) |
|---|---|---|
| `webRequest` | « supported », mais le `webRequest` d'Electron passe avant | « Not supported » |
| `scripting` | « supported » | non listé (`tabs.executeScript`, `insertCSS`) |
| `storage` | local ok, sync = disque local, managed = vide | sync et managed retombent sur local |
| `tabs` | partiel (`query` limité, `update` url + muted) | à compléter par l'app (`assignTabDetails`) |
| `action` / popup | non documenté | oui (`<browser-action-list>`) |
| `commands`, `contextMenus`, `cookies`, `windows` | non documenté | oui |
| `webNavigation` | non documenté | top frame seulement |
| `declarativeNetRequest`, `nativeMessaging`, `sidePanel`, `offscreen` | **non documentés** | **non listés** |
| service workers MV3 | non documenté | « Background scripts are always persistent » |

Les deux sources se contredisent sur `webRequest` et `scripting` (périmètres différents : l'API intégrée
d'Electron contre une bibliothèque tierce). Le Web Store et les `.crx` ne sont pas gérés par Electron
(seulement les extensions décompressées) : c'est l'objet d'ARB-26.

## Lecture pour la suite (hypothèses, à confirmer)

1. **Risque fort** : `declarativeNetRequest` (uBOL, deux autres extensions), `nativeMessaging` (1Password),
   `offscreen` (quatre extensions) et `sidePanel` n'ont aucune prise en charge documentée.
2. **Risque moyen** : `webNavigation` partiel, `tabs.query` partiel, MV3 service worker.
3. **Probablement ok** : `storage`, `alarms`, `contextMenus`, `commands`, `action`, content scripts classiques.
4. Dark Reader est le meilleur candidat de premier essai (peu d'API) ; uBOL le meilleur test d'un blocage
   MV3 ; Bitwarden un test réaliste d'autoremplissage.

## À relever en ARB-24 et ARB-25 (hors périmètre de cette fiche)

- Résultat réel de `loadExtension` par extension, API appelées en pratique (journal des erreurs `chrome.*`).
- `world: MAIN`, `userScripts`, popup affiché, `chrome.tabs` fourni par l'application.
- Versions épinglées des extensions testées, pour la reproductibilité.

## Sources non trouvées

Doc officielle 1Password sur les permissions ; manifest et code de 1Password et d'Immersive Translate ;
grep exhaustif des appels `chrome.*` de uBO, Bitwarden, Dark Reader ; source Electron sur DNR,
nativeMessaging, sidePanel, offscreen ; version du manifest MV3 de Dark Reader.

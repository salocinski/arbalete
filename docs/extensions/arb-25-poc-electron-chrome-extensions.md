# ARB-25 — POC : bibliothèque `electron-chrome-extensions`

Relevé du 2026-11-14 sous Windows 10, **Electron 45.2.3 (Chromium 156.0.8078.80)**, bibliothèque `electron-chrome-extensions` **4.10.0** (licence MIT, compatible GPL-3.0 ; développée et testée sur Electron 44, 45 non listé mais sans écart constaté). Script : `arbalete-browser/scripts/poc-electron-chrome-extensions.mjs` (`npx electron scripts/poc-electron-chrome-extensions.mjs`), mêmes extensions décompressées que pour ARB-24 (`arbalete-browser/.poc/ext/`), bibliothèque installée dans `arbalete-browser/.poc/lib/` (dossier ignoré par Git : elle n'est **pas** ajoutée aux dépendances d'Arbalète, ce sera la décision d'ARB-27). Le script n'est lié à aucun code de l'application : Arbalète ne charge aucune extension tant que l'audit de sécurité d'EP-04 (ARB-95) n'est pas fait.

## Méthode

Pour chaque extension : une session persistante jetable (profil sous `%TEMP%`), `new ElectronChromeExtensions({ session })`, `session.extensions.loadExtension(dossier)`, la page de test (servie en http) ajoutée par `addTab` / `selectTab`, attente de 4 s. Puis une fenêtre hôte, dont un preload expose `<browser-action-list>` (la barre d'actions de la bibliothèque) : on clique sur l'action de l'extension et on relève la popup créée (`browser-action-popup-created`), son URL, son contenu après 2,5 s et le résultat de `chrome.tabs.query({})` exécuté **depuis la popup**.

## Résultats

| Extension | Service worker | Action dans `<browser-action-list>` | Popup | `chrome.tabs` (depuis la popup) | Écart avec ARB-24 |
|---|---|---|---|---|---|
| Dark Reader 4.9.135 | Actif | Affichée | **Affichée** (`ui/popup/index.html`, contenu rendu, 1204 caractères) | `query({})` renvoie la page de test | Content scripts toujours injectés (10 éléments `style.darkreader`) ; plus rien à signaler |
| Bitwarden 2026.10.2 | **Actif** (échec d'ARB-24 levé) | Affichée | **Affichée** (`popup/index.html#/intro-carousel`, contenu rendu : la page d'accueil de l'extension non connectée) | `query({})` renvoie la page de test | `chrome.webNavigation` fourni par la bibliothèque ; les permissions `sidePanel`, `privacy` restent « inconnues » d'Electron |
| uBlock Origin Lite 2026.1110.1816 | **Plante toujours** (`reading 'onCommand'`, enregistrement refusé, code 15) | Affichée | Affichée mais quasi vide (13 caractères, service worker absent) | `query({})` renvoie la page de test | Inchangé : `chrome.commands` n'est pas fourni par la bibliothèque (cases `getAll` et `onCommand` non cochées dans son README) |
| 1Password, Immersive Translate | — | — | — | — | Non testées : installables seulement depuis le Chrome Web Store, dépendent d'ARB-26 |

Critère du ticket (« popup d'une extension affichée ») : **atteint** pour Dark Reader et Bitwarden, et l'élément fonctionne aussi pour uBOL Lite, dont la popup s'ouvre mais ne peut pas fonctionner sans son service worker.

## Ce qu'on retient

- La bibliothèque comble `webNavigation` (le blocage de Bitwarden) et apporte la barre d'actions, les popups, `chrome.tabs` / `windows` / `cookies` / `contextMenus` / `notifications`. Elle ne comble **pas** `chrome.commands`, `sidePanel` ni `privacy`.
- **uBlock Origin Lite reste bloqué** par `chrome.commands`, et son filtrage par `declarativeNetRequest` n'a donc toujours pas pu être essayé. Voie possible : un petit complément propre à Arbalète qui fournit un `chrome.commands` factice (`getAll` vide, `onCommand` sans effet) dans le service worker, à évaluer en ARB-27 plutôt que de porter un correctif dans la bibliothèque.
- Limite documentée de la bibliothèque : `webRequest` d'Electron neutralise les écouteurs `chrome.webRequest` des extensions (Arbalète ne l'utilise pas aujourd'hui, à surveiller si ce n'est plus vrai) ; tous les scripts d'arrière-plan sont persistants ; pas d'extensions en session temporaire ou privée (déjà vrai en ARB-24).
- Intégration : la bibliothèque veut des `WebContents` de pages ajoutés par `addTab` (Arbalète utilise des `WebContentsView`, donc `addTab(vue.webContents, fenêtre)`), `selectTab` à chaque changement d'onglet actif, et un preload de l'interface pour `<browser-action-list>`. Ce dernier doit passer dans la **couche d'overlays** d'Arbalète (règle d'architecture 4 : une popup native est une fenêtre à part, pas du HTML) : la barre d'actions se loge dans la vue de la barre, la popup est une fenêtre fille créée par la bibliothèque.
- Le preload de `<browser-action-list>` demande `sandbox: true` (déjà le cas) et s'écrit en CommonJS pour une vue sandboxée : le bundle `browser-action` de la bibliothèque ne dépend que d'`electron`, il sert tel quel.

## Non couvert

uBOL Lite en fonctionnement (blocage réel), 1Password et Immersive Translate (ARB-26), `chrome.tabs.create` côté extension (le rappel `createTab` n'a pas été sollicité), le menu contextuel des extensions (`getContextMenuItems`), les pages remplacées (`chrome_url_overrides`), la place des popups avec les `WebContentsView` d'Arbalète et le clavier, la sécurité (ARB-95).

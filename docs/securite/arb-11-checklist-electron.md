# ARB-11 — Revue de la checklist de sécurité Electron

Date : 2026-11-13 · Electron 45.2.3 · branche `arb-11-audit-securite-electron`.
Référence : la liste « Security checklist » de la documentation officielle d'Electron (20 recommandations).
Méthode : lecture du code via `/cso` statique (deux passages, statut partiel) puis recherche ciblée de chaque
recommandation dans `src/main/index.ts`, `src/preload/index.ts`, `vite-csp.ts` et `package.json`.
Limites : pas de scanner (Docker absent), `index.ts` lu par recherche ciblée et non ligne à ligne, aucun test à l'exécution.

## Synthèse

17 recommandations sur 20 sont respectées ou sans objet ; 3 (13, 18, 19) portent **4 écarts** de durcissement, dont un
(E4) de défense en profondeur. Aucun n'est exploitable aujourd'hui d'après la lecture du code. Aucune faille confirmée, donc aucun avis de sécurité privé.

## Écarts

| # | Recommandation | Écart | Gravité | Voie de correction |
|---|---|---|---|---|
| E1 | 19. Fuses | Aucun fuse n'est posé (pas de `@electron/fuses`). Sans eux, un binaire empaqueté reste lançable en mode Node (`ELECTRON_RUN_AS_NODE`) et accepte les arguments d'inspection. | Moyenne à la distribution, nulle en développement | À l'empaquetage (EP-14) : `RunAsNode` off, `EnableNodeCliInspectArguments` off, `OnlyLoadAppFromAsar` on, `EnableEmbeddedAsarIntegrityValidation` on |
| E2 | 18. Éviter `file://` | L'interface empaquetée est chargée par `loadFile` (`file://`). Les onglets acceptent aussi `file:` : `will-navigate` ne bloque que les schémas autres que http(s) et file, y compris pour une navigation lancée par une page. | Faible (Chromium refuse déjà de faire naviguer une page http vers `file:`) | Interface sous un protocole personnalisé (EP-14) ; refuser dans `will-navigate` un `file:` demandé par une page qui n'est pas elle-même en `file:` |
| E3 | 13. Limiter la navigation | `will-navigate` ne couvre que le cadre principal. Ni `will-frame-navigate` ni `will-redirect` ne sont branchés sur les onglets : un sous-cadre ou une redirection n'est pas filtré par le code d'Arbalète (le filtrage de schéma est celui de Chromium). | Faible | Ajouter les deux écouteurs avec le même filtre d'adresse que `will-navigate` |
| E4 | 14 et 13, en profondeur | Aucun garde-fou global `app.on('web-contents-created')` : chaque vue (`WebContentsView`, pop-up) pose elle-même ses refus. Une future vue qui l'oublierait serait ouverte. | Informationnelle | Un écouteur unique : `setWindowOpenHandler` refusant par défaut, `will-attach-webview` bloqué |

## Recommandations respectées ou sans objet

| # | Recommandation | État | Preuve |
|---|---|---|---|
| 1 | Ne charger que du contenu sécurisé | Sans objet : navigateur, http reste permis pour les pages | adresse de l'utilisateur ; l'interface est locale |
| 2 | Pas de Node pour le contenu distant | Respecté | `nodeIntegration: false` sur toutes les vues |
| 3 | Isolation de contexte | Respecté | `contextIsolation: true` partout, preload par `contextBridge` |
| 4 | Sandbox | Respecté | `sandbox: true` sur les 4 déclarations de préférences |
| 5 | Demandes de permission | Respecté | `setPermissionRequestHandler`, `setPermissionCheckHandler`, `setDevicePermissionHandler` ; refus par défaut, invite par site |
| 6 | Ne pas désactiver `webSecurity` | Respecté | jamais désactivé : `webSecurity: true` explicite sur 3 vues, valeur par défaut (vraie) sur la 4e |
| 7 | CSP | Respecté pour l'interface | `default-src 'none'`, `script-src 'self'` au build ; pages web hors périmètre |
| 8 | Pas d'`allowRunningInsecureContent` | Respecté | absent |
| 9 | Pas de fonctions expérimentales | Respecté | absent |
| 10 | Pas d'`enableBlinkFeatures` | Respecté | absent |
| 11 | Pas d'`allowpopups` | Respecté | `webviewTag` non activé |
| 12 | Vérifier les options d'un WebView | Respecté | `will-attach-webview` bloqué sur l'interface ; les onglets n'ont pas `webviewTag` (désactivé par défaut), voir E4 |
| 14 | Limiter la création de fenêtres | Respecté | `setWindowOpenHandler` partout ; pop-ups plafonnées, gestes exigés (ARB-16, ARB-108) |
| 15 | Pas de `shell.openExternal` non fiable | Respecté | aucun appel ; `shell.openPath` ne s'applique qu'à un téléchargement terminé non exécutable |
| 16 | Version courante d'Electron | Respecté | 45.2.3 épinglée, Dependabot hebdomadaire |
| 17 | Valider l'émetteur des messages IPC | Respecté | `emetteurAutorise` (cadre principal, URL de l'interface) sur `traiter`, `exigerBarre` pour les canaux sensibles |
| 20 | Ne pas exposer les API d'Electron | Respecté | le preload n'expose que des fonctions nommées, jamais `ipcRenderer` |

## Connu, déjà suivi

- Téléchargements sans invite, y compris d'un exécutable (« Ouvrir » le refuse) : raccourci documenté dans
  `gestionnaireTelechargements.ts`, à traiter avant ARB-91 (EP-10).
- Analyse par scanners, dépendances et historique Git : non faits, il faut Docker (`/cso --comprehensive`).

# Arbalète — application desktop

Navigateur Windows inspiré d'Arc, construit avec Electron, React, TypeScript et Vite.

## Prérequis

- Windows 10/11
- Node.js LTS
- npm

## Démarrer

Dans PowerShell, à la racine du projet :

```powershell
npm install
npx install-electron   # télécharge le binaire Electron, que npm install ne récupère plus
npm run dev
```

`npx install-electron` est à relancer après chaque `npm ci` ou mise à jour d'Electron : sans le binaire,
`npm run dev` échoue.

Aperçu de l'interface dans un navigateur, sans Electron (API simulée), pour les tests `/qa` et `/design-review` de gstack :

```powershell
npm run dev:web   # http://localhost:5180
```

## Interactions incluses

- Barre latérale masquée à l'ouverture : elle apparaît par-dessus la page au survol du bord gauche ; `Ctrl+Shift+B` ou le bouton d'épingle la garde ouverte, étendue (largeur réglable de 200 à 400 px en glissant son bord droit, ou au clavier avec les flèches, Début et Fin) ou compacte (68 px, icônes seules, bouton de la barre de contrôle) ; le mode et la largeur sont conservés au redémarrage
- Nouvel onglet : `Ctrl+T`
- Fermer l'onglet actif : `Ctrl+W` ; rouvrir le dernier onglet fermé : `Ctrl+Maj+T` (jusqu'à 10, en fin de liste, sans son historique de navigation)
- Focus sur la barre d'adresse : `Ctrl+L`
- Précédent / suivant : `Alt+←` / `Alt+→`
- Zoom de la page de l'onglet actif : `Ctrl+=` (plus), `Ctrl+-` (moins), `Ctrl+0` (100 %) ; plein écran : `F11`
- Changer d'onglet : `Ctrl+Tab` / `Ctrl+Maj+Tab` (ou `Ctrl+PageDown` / `Ctrl+PageUp`), en boucle ; `Ctrl+1` à `Ctrl+8` visent le n-ième onglet, `Ctrl+9` le dernier
- Recharger la page de l'onglet actif : `F5` ou `Ctrl+R` ; sans le cache : `Ctrl+F5`, `Maj+F5` ou `Ctrl+Maj+R`
- Ces raccourcis agissent aussi depuis une page web ou la barre latérale (interceptés par le processus principal)
- Navigation Chromium réelle via `WebContentsView`
- Onglets créés, sélectionnés et fermés
- Espaces de travail visuels
- Thème manuel sombre / clair / système (le mode système est le défaut initial ; le thème choisi est conservé au redémarrage)
- Session des onglets restaurée au redémarrage, avec un bandeau pour reprendre une session interrompue
- Historique enregistré à chaque navigation vers une autre page
- Favicon du site dans chaque onglet de la barre latérale (adresses `https:` et images `data:` seulement ; icône générique sinon)
- Adresse d'un lien survolé dans une petite bulle au bas de la page, comme dans Arc (pas de barre d'état) ; elle passe de l'autre côté sous la souris et n'apparaît pas dans l'aperçu navigateur (`npm run dev:web`)

## État actuel et limites

Arbalète est en développement, pas encore un navigateur prêt à être utilisé quotidiennement.

- Les favoris, les téléchargements et les espaces ne sont pas encore persistés ; l'historique est enregistré mais n'a pas encore de panneau.
- Le sélecteur d'espaces modifie pour l'instant l'interface, pas les sessions ou les groupes d'onglets.
- Le thème suit `nativeTheme` : en mode système, il s'adapte au thème clair/sombre de Windows.
- La gestion des permissions distantes est volontairement restrictive.
- Les extensions Chrome ne sont pas encore intégrées. Electron ne garantit pas la compatibilité avec toutes les extensions du Chrome Web Store.
- Les onglets utilisent actuellement la session par défaut commune.
- L'interface React se superpose au contenu Chromium via `WebContentsView`; le processus principal synchronise la zone visible à partir de la géométrie envoyée par le renderer. La barre latérale est une seconde vue native de la même interface (`?vue=barre`), posée au-dessus de la page.

## Architecture

- `src/main/index.ts` : fenêtre, gestion des vues web, navigation, IPC et raccourcis clavier.
- `src/main/favicon.ts` : choix du favicon transmis à l'interface, dont la CSP n'autorise que `'self'`, `data:` et `https:` pour les images.
- `src/main/navigationClavier.ts` : reconnaissance des raccourcis de changement d'onglet (Ctrl+Tab, Ctrl+1…9) et de rechargement (F5, Ctrl+R), et onglet visé.
- `src/main/ongletsFermes.ts` : pile des 10 derniers onglets fermés (adresses web et `file:`), pour `Ctrl+Maj+T`.
- `src/main/apercuUrl.ts` : texte, placement et document de la bulle d'adresse du lien survolé, vue native dédiée (décision 0003).
- `src/main/donnees/` : base SQLite `arbalete.db` (dossier de données de l'utilisateur), migrations, dépôts et préférences (thème choisi, mode et largeur de la barre latérale).
- `src/shared/barre.ts` : largeurs et transitions de la barre latérale (étendue, compacte, masquée), partagées par le processus principal et l'aperçu web.
- `src/preload/index.ts` : API IPC minimale exposée à l'interface.
- `src/renderer/src/App.tsx` : aiguillage entre la fenêtre et la vue de la barre latérale (`?vue=barre`).
- `src/renderer/src/views/` et `src/renderer/src/components/` : interface et interactions.
- `src/renderer/src/state.ts` et `src/renderer/src/shortcuts.ts` : état suivi depuis le processus principal et raccourcis d'onglets de l'aperçu web.
- `resources/icone.ico` : icône de la fenêtre et de la barre des tâches (16, 32, 48 et 256 px) ; sources dans `branding/`.
- `src/renderer/src/styles.css` : identité visuelle.
- `src/renderer/src/design-system/tokens.css` : design tokens et palettes sombre / claire de `DESIGN.md`, seules couleurs de l'interface.
- `src/renderer/src/components/ui/` : `Button`, `IconButton` et `Input`, composants de base de l'interface (styles dans `design-system/controls.css`).
- `src/renderer/src/design-system/fonts.css` : polices Inter, Manrope et JetBrains Mono (paquets `@fontsource-variable`, licence OFL, textes dans `licences-polices/`), servies localement.

## Prochaines étapes recommandées

1. Tester le démarrage sur Windows et corriger les éventuels écarts de configuration.
2. Persister favoris et espaces dans SQLite (onglets et historique le sont déjà).
3. Réaliser un prototype de compatibilité des extensions avant de figer l'architecture.
4. Préparer le packaging et les mises à jour automatiques.

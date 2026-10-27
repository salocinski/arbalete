# Arbalète — prototype desktop

Prototype de navigateur Windows inspiré d'Arc, construit avec Electron, React, TypeScript et Vite.

## Prérequis

- Windows 10/11
- Node.js LTS
- npm

## Démarrer

Dans PowerShell, à la racine du projet :

```powershell
npm install
npm run dev
```

## Interactions incluses

- Barre latérale repliable : `Ctrl+Shift+B`
- Nouvel onglet : `Ctrl+T`
- Fermer l'onglet actif : `Ctrl+W`
- Focus sur la barre d'adresse : `Ctrl+L`
- Précédent / suivant : `Alt+←` / `Alt+→`
- Navigation Chromium réelle via `WebContentsView`
- Onglets créés, sélectionnés et fermés
- Espaces de travail visuels
- Thème manuel sombre / clair / système (le mode système est le défaut visuel initial)

## État actuel et limites

Ceci est un prototype de départ, pas encore un navigateur prêt à être utilisé quotidiennement.

- Les favoris, l'historique, les téléchargements et les espaces ne sont pas encore persistés.
- Le sélecteur d'espaces modifie pour l'instant l'interface, pas les sessions ou les groupes d'onglets.
- Le thème suit `nativeTheme` : en mode système, il s'adapte au thème clair/sombre de Windows.
- La gestion des permissions distantes est volontairement restrictive.
- Les extensions Chrome ne sont pas encore intégrées. Electron ne garantit pas la compatibilité avec toutes les extensions du Chrome Web Store.
- Les onglets utilisent actuellement la session par défaut commune.
- L'interface React se superpose au contenu Chromium via `WebContentsView`; le processus principal synchronise la zone visible à partir de la géométrie envoyée par le renderer.

## Architecture

- `src/main/index.ts` : fenêtre, gestion des vues web, navigation et IPC.
- `src/preload/index.ts` : API IPC minimale exposée à l'interface.
- `src/renderer/src/App.tsx` : interface et interactions.
- `src/renderer/src/styles.css` : identité visuelle.

## Prochaines étapes recommandées

1. Tester le démarrage sur Windows et corriger les éventuels écarts de configuration.
2. Ajouter un vrai mode système via `nativeTheme`.
3. Persister onglets, favoris, historique et espaces dans SQLite.
4. Ajouter une politique stricte de navigation et de fenêtres externes.
5. Réaliser un prototype de compatibilité des extensions avant de figer l'architecture.
6. Préparer le packaging et les mises à jour automatiques.

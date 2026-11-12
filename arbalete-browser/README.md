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
- Rechercher dans la page : `Ctrl+F` ; compteur « 3/12 », `Entrée` / `Maj+Entrée` pour le résultat suivant / précédent, `Échap` ou la croix pour fermer (absent de l'aperçu navigateur)
- Suggestions de la barre d'adresse : en tapant, une liste propose de chercher ou d'aller à l'adresse, puis les pages déjà visitées ; `↑` / `↓` choisissent une ligne, `Entrée` ou un clic l'ouvre, `Échap` la ferme (absentes de l'aperçu navigateur)
- Ces raccourcis agissent aussi depuis une page web ou la barre latérale (interceptés par le processus principal)
- Navigation Chromium réelle via `WebContentsView`
- Onglets créés, sélectionnés et fermés
- Espaces de travail : le sélecteur de la barre latérale liste les espaces (Développement, Personnel et Recherche au premier lancement) ; son menu crée, renomme, réordonne et supprime un espace (le dernier ne se supprime pas ; supprimer un espace ferme ses onglets) ; un clic droit sur le nom de l'espace ouvre « Changer la couleur… » (14 couleurs) ; changer d'espace affiche les onglets de cet espace (les autres restent ouverts, masqués), chaque espace garde son dernier onglet actif, et l'espace affiché revient au redémarrage
- Thème manuel sombre / clair / système (le mode système est le défaut initial ; le thème choisi est conservé au redémarrage)
- Session des onglets restaurée au redémarrage, avec un bandeau pour reprendre une session interrompue
- Historique enregistré à chaque navigation vers une autre page
- Panneau Historique (bouton « Historique » de la barre latérale) : visites les plus récentes d'abord, regroupées par jour, une page une fois par jour ; la saisie filtre par titre ou adresse, un clic ou Entrée (première ligne) ouvre la page dans un nouvel onglet, `Échap` ferme ; le pied du panneau efface par période (dernière heure, 24 h, 7 jours, tout) l'historique, les cookies et le cache, après un second clic de confirmation (cookies et cache toujours en entier) (200 lignes au plus, ni suppression d'une entrée isolée ni `Ctrl+H` ; absent de l'aperçu navigateur)
- Favicon du site dans chaque onglet de la barre latérale (adresses `https:` et images `data:` seulement ; icône générique sinon)
- Étoile de la barre d'adresse : ajoute la page de l'onglet actif aux favoris, ou l'en retire (pages web seulement)
- Grille de favoris en haut de la barre latérale : les 8 premiers favoris ajoutés, en tuiles (initiale du site, titre en infobulle) ; un clic active l'onglet déjà ouvert sur cette adresse, sinon l'ouvre dans un nouvel onglet
- Panneau Favoris (bouton « Favoris » de la barre latérale) : tous les favoris, rangés par dossier puis « Sans dossier » ; on y crée, renomme et supprime un dossier (un niveau ; supprimer un dossier garde ses favoris), on range un favori par sa liste « Dossier » ou on le retire, un clic l'ouvre ; la grille de la barre latérale ne tient pas compte des dossiers (absent de l'aperçu navigateur)
- Téléchargements : un fichier proposé par une page (adresses web et `blob:`) s'enregistre sans invite dans le dossier Téléchargements, sans écraser un fichier existant ; progression, pause, reprise, annulation et retrait depuis le panneau de la barre latérale, puis, une fois terminé, « Ouvrir le fichier » (application par défaut de Windows, refusé pour un fichier exécutable) et « Afficher dans le dossier » (Explorateur) ; l'historique (200 derniers) est conservé en base, et un téléchargement resté actif à l'arrêt apparaît interrompu au redémarrage ; 20 actifs au plus
- Clic droit dans une page : menu dans la couche d'overlays, au point du clic ; « Précédent », « Suivant » (si possible) et « Recharger » sur la page, « Ouvrir le lien dans un nouvel onglet » et « Copier l'adresse du lien » sur un lien web, « Enregistrer l'image », « Copier » sur une sélection, « Inspecter » hors de l'app empaquetée ; `Échap`, un clic ailleurs ou une entrée le ferme (ni correcteur orthographique ni menu dans les champs de saisie ; absent de l'aperçu navigateur)
- Clic droit sur un onglet : menu « Nouvel onglet », « Dupliquer » (même adresse web), « Épingler » / « Désépingler » (l'onglet épinglé perd son bouton de fermeture), « Copier l'adresse » (pages web seulement), « Fermer les autres onglets » (ceux de l'espace, sauf l'onglet visé et les épinglés ; rouvrables par `Ctrl+Maj+T`) et « Fermer l'onglet » ; l'épinglage n'est pas conservé au redémarrage
- Adresse d'un lien survolé dans une petite bulle au bas de la page, comme dans Arc (pas de barre d'état) ; elle passe de l'autre côté sous la souris et n'apparaît pas dans l'aperçu navigateur (`npm run dev:web`)

## État actuel et limites

Arbalète est en développement, pas encore un navigateur prêt à être utilisé quotidiennement.

- Les téléchargements s'enregistrent sans invite dans le dossier Téléchargements (sans choix du dossier ni confirmation, quel que soit le type de fichier) ; l'historique et les favoris sont enregistrés ; le panneau Historique n'a ni suppression d'une entrée isolée ni pagination, et les favoris n'ont ni glisser-déposer, ni ordre au choix, ni dossiers imbriqués.
- Le sélecteur d'espaces change les onglets affichés et la session les rattache à leur espace ; le rendu du sélecteur n'a été essayé que dans l'aperçu navigateur.
- Le thème suit `nativeTheme` : en mode système, il s'adapte au thème clair/sombre de Windows.
- La gestion des permissions distantes est volontairement restrictive.
- Les extensions Chrome ne sont pas encore intégrées. Electron ne garantit pas la compatibilité avec toutes les extensions du Chrome Web Store.
- Les onglets utilisent actuellement la session par défaut commune.
- L'interface React se superpose au contenu Chromium via `WebContentsView`; le processus principal synchronise la zone visible à partir de la géométrie envoyée par le renderer. La barre latérale est une seconde vue native de la même interface (`?vue=barre`), posée au-dessus de la page.

## Architecture

- `src/main/index.ts` : fenêtre, gestion des vues web, navigation, IPC et raccourcis clavier.
- `src/main/favicon.ts` : choix du favicon transmis à l'interface, dont la CSP n'autorise que `'self'`, `data:` et `https:` pour les images.
- `src/main/telechargements.ts` et `src/main/gestionnaireTelechargements.ts` : nom de fichier sûr et chemin libre, liste des téléchargements (`will-download`), progression, pause, reprise, annulation, ouverture du fichier terminé (hors exécutables) et affichage dans l'Explorateur ; persistés par `donnees/telechargements.ts` (migration 6) et affichés par `components/DownloadsOverlay.tsx`.
- `src/main/navigationClavier.ts` : reconnaissance des raccourcis de changement d'onglet (Ctrl+Tab, Ctrl+1…9) et de rechargement (F5, Ctrl+R), et onglet visé.
- `src/main/ongletsFermes.ts` : pile des 10 derniers onglets fermés (adresses web et `file:`), pour `Ctrl+Maj+T`.
- `src/main/apercuUrl.ts` : texte, placement et document de la bulle d'adresse du lien survolé, vue native dédiée (décision 0003).
- `src/main/recherche.ts` : placement de la petite vue native de recherche (coin haut-droit de la page) et texte accepté ; sa vue est `?vue=recherche` (`views/FindView.tsx`).
- `src/main/menuPage.ts` : choix des entrées du menu contextuel d'une page selon le clic (lien, image, sélection) et filtre des adresses web ; liste fermée d'entrées dans `src/shared/menuPage.ts` ; le menu est affiché par la vue de la barre latérale, qui seule choisit une entrée.
- `src/shared/menuOnglet.ts` : actions du menu d'un onglet (liste fermée validée par le processus principal, canal `browser:tab-action`) et onglets à fermer par « Fermer les autres » (épinglés gardés).
- `src/shared/ordreOnglets.ts` : nouvel ordre des onglets après un glisser-déposer (canal `browser:move-tab`) ; les onglets des autres espaces gardent leur place.
- `src/shared/historique.ts` : regroupement des visites par jour et libellés (« Aujourd’hui », « Hier ») du panneau Historique (`components/HistoryPanel.tsx`, modale de la couche d'overlays), et périodes d'effacement (`debutEffacement`) ; lecture filtrée et `effacerHistorique` dans `src/main/donnees/historique.ts`, canal `browser:clear-browsing-data` dans `src/main/index.ts`.
- `src/main/suggestions.ts` : construction de la liste des suggestions, flèches et validation des entrées ; la liste est affichée par la vue de la barre latérale (`components/SuggestionsOverlay.tsx`).
- `src/main/donnees/` : base SQLite `arbalete.db` (dossier de données de l'utilisateur), migrations, dépôts (session, historique, favoris, espaces, téléchargements) et préférences (thème choisi, mode et largeur de la barre latérale).
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
2. Réaliser un prototype de compatibilité des extensions avant de figer l'architecture.
3. Préparer le packaging et les mises à jour automatiques.

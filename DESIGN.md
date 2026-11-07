---
name: Arbalète
direction: Atmospheric Minimalism
version: "1.1"
colors:
  dark-background: "#111820"
  dark-sidebar: "#1C2833"
  dark-surface: "#273746"
  dark-surface-hover: "#304351"
  dark-text-primary: "#E8EDF2"
  dark-text-secondary: "#A1AEB9"
  dark-border: "#34424F"
  dark-accent: "#DCA173"
  dark-accent-hover: "#E7AC7D"
  dark-accent-active: "#BD8052"
  dark-success: "#95B49D"
  dark-warning: "#E3B46C"
  dark-error: "#E29A9A"
  light-background: "#F3F5F7"
  light-sidebar: "#E5EAF0"
  light-surface: "#FFFFFF"
  light-surface-hover: "#EEF1F5"
  light-text-primary: "#202B36"
  light-text-secondary: "#5D6A78"
  light-border: "#D9E0E7"
  light-accent: "#905D37"
  light-accent-hover: "#815331"
  light-accent-active: "#724A2C"
  light-success: "#4B7258"
  light-warning: "#87632C"
  light-error: "#AE4949"
  dark-workspace-personal: "#56B8C8"
  dark-workspace-development: "#8C91E8"
  dark-workspace-work: "#D99A69"
  dark-workspace-research: "#83A78D"
  light-workspace-personal: "#3491A0"
  light-workspace-development: "#757BE3"
  light-workspace-work: "#C27031"
  light-workspace-research: "#658F71"
typography:
  display:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontWeight: "600"
    fontSize: "28px"
  heading-1:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontWeight: "600"
    fontSize: "22px"
  heading-2:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontWeight: "600"
    fontSize: "18px"
  heading-3:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontWeight: "600"
    fontSize: "16px"
  body:
    fontFamily: "Inter, Segoe UI, sans-serif"
    fontWeight: "400"
    fontSize: "14px"
  body-small:
    fontFamily: "Inter, Segoe UI, sans-serif"
    fontWeight: "400"
    fontSize: "13px"
  label:
    fontFamily: "Inter, Segoe UI, sans-serif"
    fontWeight: "500"
    fontSize: "12px"
  caption:
    fontFamily: "Inter, Segoe UI, sans-serif"
    fontWeight: "400"
    fontSize: "11px"
  mono:
    fontFamily: "JetBrains Mono, Cascadia Mono, Consolas, monospace"
    fontWeight: "400"
    fontSize: "12px"
rounded:
  sm: "6px"
  button: "8px"
  md: "10px"
  card: "12px"
  floating: "14px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
  space-8: "32px"
  space-10: "40px"
  space-12: "48px"
dimensions:
  sidebar-expanded: "250px"
  sidebar-compact: "68px"
  control-bar: "48px"
  tab: "36px"
  button: "34px"
  search-field: "40px"
  border: "1px"
motion:
  hover-focus: "120ms"
  panel-open: "180ms"
  panel-close: "150ms"
  workspace-switch: "200ms"
  modal-open: "180ms"
  tab-reorder: "160ms"
  ease-standard: "ease-out"
  ease-enter: "cubic-bezier(0.16, 1, 0.3, 1)"
  ease-exit: "ease-in"
  ease-move: "cubic-bezier(0.2, 0.8, 0.2, 1)"
---
# Arbalète — Design System

> Référentiel officiel de conception et d'implémentation, version 1.1 (novembre 2026), direction artistique
> **Atmospheric Minimalism**. Repris du document « Arbalete_Design_System_Direction_Artistique_v1.0 » (ARB-85),
> avec les décisions du 2026-11-03 (barre de contrôle, barre latérale) et les contrastes corrigés (ARB-125).
>
> **État du code** : depuis ARB-34, les couleurs de l'interface viennent des tokens (palettes Dark / Light,
> accent Amber) et, depuis ARB-121, les polices Inter, Manrope et JetBrains Mono sont embarquées ; les composants de
> l'ancien brouillon restent à mettre en conformité dans l'epic EP-05 (ARB-122 composants…).

## Autorité

Ce document fait foi pour toute décision graphique ou UX. Si une proposition d'interface le contredit :
identifier le conflit, expliquer son impact, proposer une solution compatible, et ne modifier ce référentiel
qu'après validation.

## Vision

Arbalète est un environnement de travail personnel, pas une barre d'onglets au-dessus d'une page : la
navigation s'organise autour des espaces de travail, fluide, personnalisable et cohérente avec Windows 10/11.

Cinq piliers :
- **Atmosphère** : ambiances et profondeur visuelle plutôt qu'ornements.
- **Simplicité** : seuls les contrôles réellement utiles sont visibles.
- **Fluidité** : transitions naturelles, interactions sans rupture.
- **Contexte** : couleurs et espaces rendent la navigation compréhensible.
- **Discrétion** : le navigateur s'efface devant le contenu web.

**Signature** : une identité minérale et chaleureuse. Le contraste entre des surfaces froides et l'accent
**Amber** est la marque d'Arbalète. Amber signale les interactions et certains états actifs ; il ne devient
jamais la couleur dominante des surfaces.

## Colors

Palette sombre :

| Token | Valeur | Usage |
|---|---|---|
| Obsidian | `#111820` | Fond principal |
| Slate | `#1C2833` | Barre latérale |
| Graphite | `#273746` | Surfaces secondaires |
| Frost | `#E8EDF2` | Texte principal |
| Muted | `#A1AEB9` | Texte secondaire |
| Border | `#34424F` | Bordures discrètes |
| Amber | `#DCA173` | Accent (hover `#E7AC7D`, actif `#BD8052`) |
| Success / Warning / Error | `#95B49D` / `#E3B46C` / `#E29A9A` | États fonctionnels |

Palette claire :

| Token | Valeur | Usage |
|---|---|---|
| Cloud | `#F3F5F7` | Fond principal |
| Porcelain | `#FFFFFF` | Surfaces |
| Mist | `#E5EAF0` | Barre latérale |
| Ink | `#202B36` | Texte principal |
| Muted | `#5D6A78` | Texte secondaire |
| Border | `#D9E0E7` | Bordures |
| Amber | `#905D37` | Accent, plus sombre qu'en mode sombre (hover `#815331`, actif `#724A2C`) |
| Success / Warning / Error | `#4B7258` / `#87632C` / `#AE4949` | États fonctionnels |

Couleurs contextuelles des espaces, une variante par thème pour rester visibles sur la barre latérale :

| Espace | Sombre | Clair |
|---|---|---|
| Personal **Glacier** | `#56B8C8` | `#3491A0` |
| Development **Iris** | `#8C91E8` | `#757BE3` |
| Work **Amber** | `#D99A69` | `#C27031` |
| Research **Sage** | `#83A78D` | `#658F71` |
| Custom | configurable | configurable |

Règles :
- Le fond principal reste neutre ; la barre latérale a une surface légèrement distincte.
- Bordures discrètes ; les dégradés sont exceptionnels (jamais sur un bouton).
- Les couleurs d'espace distinguent les espaces sans remplacer les couleurs fonctionnelles.
- Toute couleur informative garde un contraste suffisant.

### Contrastes

Validés le 2026-11-03 (ARB-125), ratios WCAG 2.1 calculés sur les quatre fonds de chaque thème (fond,
barre latérale, surface, surface au survol). Seuils : 4,5:1 pour le texte (AA), 3:1 pour un repère non
textuel (anneau de focus, couleur d'espace).

| Élément | Sombre (minimum) | Clair (minimum) |
|---|---|---|
| Texte principal (Frost / Ink) | 8,71:1 | 11,89:1 |
| Texte secondaire (Muted) | 4,53:1 | 4,57:1 |
| Accent Amber en texte ou lien | 4,59:1 | 4,56:1 |
| Success / Warning / Error en texte | 4,54 / 5,38 / 4,55:1 | 4,51 / 4,51 / 4,51:1 |
| Anneau de focus (Amber) | 4,59:1 | 4,56:1 |
| Couleur d'espace sur la barre latérale | 5,23:1 | 3,03:1 |

Texte sur un bouton Amber : **Obsidian** en sombre (8,0:1 ; 9,0:1 au survol, 5,4:1 actif), **blanc** en
clair (5,5:1 ; 6,5:1 au survol, 7,7:1 actif). L'inverse échoue (blanc sur Amber sombre 2,2:1, Obsidian
sur Amber clair 3,2:1).

Règles qui en découlent :
- Les variantes hover et actif de l'accent sont des fonds de bouton, pas des couleurs de texte (Amber actif
  sombre ne donne que 3,1:1 en texte sur la surface au survol).
- `--color-focus` reprend l'accent du thème.
- Les bordures (`#34424F`, `#D9E0E7`) restent décoratives (1,0 à 1,7:1) : un champ ou un contrôle se
  repère par sa surface, son libellé et son focus, jamais par sa seule bordure.
- Toute nouvelle couleur de texte ou de repère est mesurée sur les quatre fonds avant d'entrer ici.

## Typography

| Police | Usage |
|---|---|
| Inter | Interface générale |
| Manrope | Titres et éléments de marque |
| JetBrains Mono | Données techniques, URL dans les panneaux techniques |

Polices sous licence OFL, embarquées localement (CSP `font-src 'self'`, aucun appel réseau), repli sur
Segoe UI et Cascadia Mono (ARB-121).

| Élément | Taille | Graisse |
|---|---|---|
| Display | 28 px | 600 |
| Heading 1 / 2 / 3 | 22 / 18 / 16 px | 600 |
| Body | 14 px | 400 |
| Body Small | 13 px | 400 |
| Label | 12 px | 500 |
| Caption | 11 px | 400 |

Lisibilité avant personnalité : pas de texte trop petit, pas de gras systématique, peu de majuscules.
Raccourcis affichés au format Windows (`Ctrl T`), jamais `⌘`. Vérifier le rendu à 125 % et 150 % de mise à
l'échelle Windows.

## Spacing & Dimensions

Grille de 4 px : `space-1` 4, `space-2` 8, `space-3` 12, `space-4` 16, `space-5` 20, `space-6` 24,
`space-8` 32, `space-10` 40, `space-12` 48.

| Élément | Dimension |
|---|---|
| Barre latérale étendue / compacte | 250 px / 68 px |
| Barre de contrôle (haut) | 48 px |
| Onglet (hauteur de navigation) | 36 px |
| Bouton standard | 34 px |
| Champ de recherche / adresse | 40 px |
| Bordure | 1 px |

Toutes les dimensions passent par les tokens. Les zones système, le redimensionnement et la taille de la
fenêtre Windows sont traités à part des dimensions internes des composants.

## Layout

Trois zones ; la surface de contenu garde toujours la priorité visuelle.

- **A — Barre latérale** : identité, sélecteur d'espace, navigation principale, onglets, favoris, actions
  secondaires.
- **B — Barre de contrôle**, en haut : précédent, suivant, recharger, adresse, sécurité, actions
  contextuelles, accès aux commandes. *Décision du 2026-11-03 : elle reste en haut ; l'adresse ne migre pas
  dans la barre latérale (ARB-31).* Fenêtre sans cadre, boutons Windows via `titleBarOverlay` alignés sur ses
  48 px (ARB-30).
- **C — Surface de contenu** : pages web, vues divisées, panneaux secondaires, états de chargement et d'erreur.

**Barre latérale** : *décision du 2026-11-03*, trois états au choix (ARB-123) : étendue (250 px, largeur
réglable dans des limites définies), compacte (68 px, icônes et infobulles), masquée et rappelée au survol du
bord gauche (ARB-33). Son état est conservé au redémarrage ; elle se pilote au clavier (Ctrl+Maj+B).

**Onglets** : verticaux, avec favicon, titre, indicateur de chargement, état actif, épinglé, indicateur sonore
et fermeture. États : Default, Hover, Active, Pinned, Loading, Muted, Error. L'onglet actif se reconnaît
sans fond fortement contrasté (ARB-124).

**Espaces** : chacun est un contexte indépendant avec nom, couleur, onglets, favoris, préférences éventuelles
et session persistante. Changer d'espace préserve les états de navigation.

## Elevation & Depth

Peu d'ombres : la profondeur vient des plans (fond < barre latérale < surfaces). Les panneaux flottants
(palette de commandes, menus, sélecteurs, dialogues) se détachent par une ombre douce et un rayon de 14 px,
sans multiplier les fenêtres. Ombres et niveaux de z-index sont des tokens (ARB-126).
Rappel technique : un élément HTML ne passe pas au-dessus de la page web (WebContentsView) sans la couche
d'overlays (EP-06, décision 0002).

## Shapes

Rayons : 6 px (petits contrôles), 8 px (boutons), 10 px (standard, cadre de page), 12 px (cartes),
14 px (panneaux flottants). Formes douces, pas de pilules partout.

## Components

Composants cibles : AppShell, Sidebar, WorkspaceSwitcher, TabItem, TabList, AddressBar, NavigationControls,
CommandBar, FloatingPanel, ContextMenu, Tooltip, Modal, Toast, SplitView, SettingsPanel.

- **Boutons** : variantes Primary, Secondary, Ghost, Icon, Destructive ; états Disabled, Hover, Focus,
  Active ; feedback immédiat ; aucun dégradé (ARB-122). Implémentation : `Button`, `IconButton` et `Input`
  (`components/ui/`, styles dans `design-system/controls.css`) ; Destructive prend la couleur d'erreur, sans token
  d'état dédié (survol et appui par mélange avec le texte principal).
- **Champs** : surface neutre, bordure discrète, focus identifiable, erreur explicite.
- **Panneaux flottants** : commande, menus, sélecteurs, dialogues, actions contextuelles.

Une seule implémentation par composant ; réutiliser l'existant avant d'en créer.

## Iconography

Lucide uniquement (`lucide-react`, déjà installé). Tailles 16 px (standard), 14 px (secondaire), 20 px
(importante) ; trait de 1,5 à 2 px. Une icône seule non explicite a une infobulle. Favicons des sites quand
ils existent. Ne jamais reproduire les icônes propriétaires d'autres navigateurs.

## Motion

| Interaction | Durée |
|---|---|
| Survol, focus | 120 ms |
| Ouverture / fermeture de panneau | 180 / 150 ms |
| Changement d'espace | 200 ms |
| Ouverture de modale | 180 ms |
| Réorganisation des onglets | 160 ms |

Courbes : standard `ease-out`, entrée `cubic-bezier(0.16, 1, 0.3, 1)`, sortie `ease-in`, déplacement
`cubic-bezier(0.2, 0.8, 0.2, 1)`. Respecter `prefers-reduced-motion` et permettre de réduire les animations
dans les paramètres (ARB-57). Aucune animation n'est indispensable à la compréhension d'une action.

## Themes

Modes Dark, Light et System ; System suit Windows via `nativeTheme`. Le changement s'applique sans
rechargement, à la fenêtre comme à la vue de la barre latérale. Le thème de l'interface ne modifie jamais
celui des sites.

Les composants consomment des variables sémantiques, jamais une valeur hexadécimale : `--color-background`,
`--color-surface`, `--color-surface-hover`, `--color-sidebar`, `--color-text-primary`,
`--color-text-secondary`, `--color-border`, `--color-accent`, `--color-accent-hover`, `--color-accent-active`,
`--color-focus`, `--color-success`, `--color-warning`, `--color-error`. Les valeurs de chaque thème sont celles
du front matter. Implémentation (ARB-34) : `arbalete-browser/src/renderer/src/design-system/tokens.css`, seul fichier
de l'interface qui contient des couleurs, palette choisie par `data-theme` sur `<html>` (sombre par défaut). Il ajoute
`--color-on-accent` (texte sur un fond Amber : Obsidian en sombre, blanc en clair), `--shadow-floating` (menus et
panneaux flottants) et les niveaux `--z-chrome`, `--z-menu`, `--z-sidebar`, `--z-overlay` ; `--color-focus` reprend
l'accent. Restent à définir : ombres et z-index complets (ARB-126), densité.

Personnalisation future, jamais au détriment de la cohérence : couleur par espace, largeur et densité de la
barre latérale, thème, raccourcis, animations.

## Electron & Windows

- Le design system ne concerne que l'interface React. Ne jamais styler l'intérieur des pages web ni modifier
  les sites visités : aucune règle CSS de l'interface ne doit les atteindre.
- Composants React séparés de la gestion des WebContentsView ; séparation stricte main / renderer ; IPC typé
  (voir les règles d'architecture de `CLAUDE.md`).
- Thème et préférences persistés dans la couche de configuration (ARB-59).
- Respecter le redimensionnement natif, le focus, les raccourcis, le DPI, le multi-écran, le mode sombre
  système et les états de fenêtre.

Arborescence cible (à adapter au dépôt, sans réorganisation inutile) : `design-system/` avec `tokens/`
(couleurs, typographie, espacements, dimensions, motion), `themes/` (sombre, clair, système), `components/`
(Button, IconButton, Tooltip, Modal, FloatingPanel, Input, Toast) et `layout/` (AppShell, Sidebar, Toolbar,
ContentArea) ; `features/` par domaine (workspaces, tabs, navigation, command-bar, split-view, settings).

## UX principles

| Principe | Exigence |
|---|---|
| Minimalisme fonctionnel | Aucun contrôle sans justification fonctionnelle |
| Prévisibilité | Des interactions aux résultats cohérents |
| Réversibilité | Actions destructives évitables ou annulables quand c'est possible |
| Continuité | Pas d'interruption ni de transition inutile |
| Persistance | Préférences et états utiles conservés |
| Accessibilité | Navigation clavier, focus visible, contrastes, libellés accessibles |
| Performance | Animations et graphismes ne ralentissent pas le moteur |

Montrer clairement ce qui n'est pas encore fonctionnel plutôt que des boutons morts.

## Originality

Arc est une référence **fonctionnelle et conceptuelle** (navigation spatiale, organisation contextuelle), pas
graphique. À ne pas reprendre : écrans pixel par pixel, logo, illustrations ou ressources d'Arc, compositions,
espacements ou comportements visuels distinctifs, toute identité suggérant une affiliation. À développer en
propre : iconographie, palette, espaces, composants, animations, palette de commandes,
typographie. Le logo propre à Arbalète est livré (ARB-127) : sources dans `branding/`. Une vérification juridique reste recommandée avant toute commercialisation.

## Before building an interface

1. Identifier les composants existants et vérifier les tokens disponibles.
2. Définir les états interactifs et le comportement Dark / Light.
3. Vérifier la navigation clavier et la densité minimale.
4. Implémenter, puis vérifier états et interactions dans les deux thèmes.
5. Documenter les composants réutilisables et toute évolution de ce référentiel.

Contrôle qualité : cohérence graphique, tokens, Dark et Light, états interactifs, navigation clavier et
desktop responsive sont **obligatoires**, comme les contrastes du tableau ci-dessus ; performance et
accessibilité sont **à valider** (ARB-128).

## Acceptance criteria

- Toutes les couleurs sont centralisées ; les composants principaux utilisent les tokens.
- Dark, Light et System fonctionnent.
- La barre latérale offre ses modes ; les éléments de navigation partagent une identité commune.
- Les états interactifs sont homogènes ; les espaces peuvent porter leur couleur.
- Les animations respectent les règles ci-dessus ; l'interface est utilisable au clavier.
- Aucune règle CSS de l'interface ne fuit dans les pages web.

## Do's and Don'ts

- **Faire** : variables sémantiques pour toute couleur ; tester sombre et clair ; Amber réservé aux
  interactions et états actifs.
- **Ne pas** : valeurs hexadécimales dispersées ou styles inline injustifiés ; nouvelle dépendance UI sans
  justification ; deux implémentations d'un même composant ; symboles macOS ; dégradés sur les contrôles ;
  menu au-dessus de la page sans la couche d'overlays.

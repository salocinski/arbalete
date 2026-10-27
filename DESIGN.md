---
name: Arbalète
colors:
  accent: "#a78bfa"
  accent-strong: "#8064dc"
  accent-soft: "rgba(167,139,250,.14)"
  dark-app-bg: "#101116"
  dark-sidebar-bg: "#15161d"
  dark-panel: "#1b1c25"
  dark-panel-hover: "#242631"
  dark-text: "#ececf4"
  dark-muted: "#858797"
  light-app-bg: "#f5f5f9"
  light-sidebar-bg: "#ededf4"
  light-panel: "#ffffff"
  light-panel-hover: "#e5e5ee"
  light-text: "#242431"
  light-muted: "#6e7080"
  secure: "#70c5a2"
  favorite: "#f6d78c"
  workspace-dev: "#a78bfa"
  workspace-personal: "#5eead4"
  workspace-research: "#fbbf24"
typography:
  display:
    fontFamily: "Segoe UI Variable Display, Segoe UI, sans-serif"
    fontWeight: "700"
    fontSize: "16px"
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontWeight: "400"
    fontSize: "12px"
  label:
    fontFamily: "Segoe UI, sans-serif"
    fontWeight: "700"
    fontSize: "9px"
  mono:
    fontFamily: "Cascadia Mono, Consolas, monospace"
    fontWeight: "400"
    fontSize: "11px"
rounded:
  sm: "6px"
  md: "8px"
  lg: "11px"
  xl: "14px"
  frame: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  sidebar-open: "252px"
  sidebar-collapsed: "68px"
---
# Arbalète

> Brouillon établi à partir de `styles.css` (prototype 0.1) et de la cible « Arc ».
> À affiner avec `/design-consultation` (choisir **Update**) avant la refonte EP-05.

## Overview

Arbalète est une surface **OPERATE** : on y travaille toute la journée. L'interface doit s'effacer devant
les pages web, rester calme, et porter son identité dans les détails (accent violet, barre latérale, cadre
de page). Référence ergonomique : **Arc**. Plateforme : **Windows 10/11** uniquement.

Principes :
- La page web est le sujet ; le « chrome » du navigateur est un cadre discret autour d'elle.
- Tout tient dans la barre latérale (cible EP-05) : adresse, navigation, favoris, onglets, espaces.
- Chaque espace de travail a sa couleur, qui teinte la barre latérale.
- Sombre par défaut, clair complet, mode système suivi via `nativeTheme`.

## Colors

- **Accent** violet (`accent`) : onglet actif, focus, actions principales. Une seule couleur d'accent à la fois :
  quand un espace est actif, sa couleur remplace l'accent dans la barre latérale.
- **Neutres** légèrement teintés vers le violet, jamais de gris pur.
- **Sémantiques** : `secure` (cadenas HTTPS), `favorite` (étoile). Elles ne servent jamais de décoration.
- Toutes les couleurs passent par des variables CSS. Aujourd'hui une partie est écrite en dur dans
  `styles.css`, ce qui casse le thème clair (ticket EP-05 « Compléter le thème clair »).

## Typography

Polices système Windows, pas de police web : démarrage instantané, rendu ClearType natif.
- `display` : nom de marque, titres de panneaux.
- `body` : onglets, éléments de navigation, barre d'adresse.
- `label` : en-têtes de section en capitales (`ONGLETS`), interlettrage 1,2 px.
- `mono` : URL dans les panneaux techniques, raccourcis.
Raccourcis affichés au format Windows (`Ctrl T`), jamais `⌘`.

## Layout

État actuel (prototype) : barre latérale à gauche, barre d'outils + barre d'adresse en haut, barre d'état en bas.

Cible Arc (EP-05) :
- Fenêtre sans cadre, boutons Windows via `titleBarOverlay`.
- Barre latérale de 252 px (repliée 68 px, ou masquée et rappelée au survol du bord gauche) contenant, de haut
  en bas : barre d'adresse et navigation, favoris en grille, onglets épinglés, onglets du jour, sélecteur d'espaces.
- Plus de barre d'outils haute ni de barre d'état : l'URL survolée s'affiche en surimpression.
- La page web occupe le reste, dans un cadre à coins arrondis (`frame`) avec une marge de 8 px.

## Elevation & Depth

Peu d'ombres. La profondeur vient des plans : fond de fenêtre < barre latérale < cadre de page.
Les menus et palettes flottent avec une ombre décalée et floue (`0 12px 30px`), jamais un halo coloré.
Rappel technique : un élément HTML ne peut pas passer au-dessus de la page web (WebContentsView) sans la
couche d'overlays (EP-06).

## Shapes

Rayons : 6 px (petits contrôles), 8 px (onglets, boutons), 11 px (barre d'adresse), 14 px (cartes),
10 px (cadre de page). Formes douces, pas de pilules partout.

## Components

- **Onglet** : 35 px de haut, favicon 14 px, titre tronqué, fermeture visible au survol ou si actif ;
  actif = fond `panel-hover` + filet d'accent à gauche.
- **Barre d'adresse** : 36 px, icône de sécurité, champ, étoile de favori ; focus = bordure accent + halo léger.
- **Sélecteur d'espace** : pastille de couleur + nom + chevron.
- **Bouton icône** : 30 × 30 px, transparent, fond au survol.

## Do's and Don'ts

- **Faire** : variables CSS pour toute couleur ; tester sombre et clair ; vérifier la lisibilité avec la
  mise à l'échelle Windows à 125 % et 150 %.
- **Faire** : montrer clairement ce qui n'est pas encore fonctionnel plutôt que des boutons morts.
- **Ne pas** : afficher de symboles macOS ; ajouter des animations sur chaque survol ; dégradés violet-bleu.
- **Ne pas** : placer un menu au-dessus de la zone de page sans passer par la couche d'overlays.

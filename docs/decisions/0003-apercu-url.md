# 0003 — Aperçu de l'adresse d'un lien survolé : une petite vue native dédiée

- **Statut** : acceptée (ARB-36, EP-05)
- **Date** : 2026-11-09
- **Concerne** : aperçu d'URL au survol (ARB-36) ; toute bulle non modale posée sur la page (infobulles d'ARB-126)

## Contexte

Arc n'a pas de barre d'état : l'adresse d'un lien survolé s'affiche dans une bulle au bas de la page. La page est une
`WebContentsView`, couche native au-dessus du HTML de la fenêtre : une bulle en HTML serait masquée (règle d'architecture 4).
Chromium annonce l'adresse survolée par l'évènement `update-target-url` de la page.

## Options

| Option | Pour | Contre |
|---|---|---|
| **A. Petite vue native dédiée** | Bulle sur la page, comme Arc et Chrome ; ne bloque que sa propre surface | Une vue de plus, un processus de rendu (de l'ordre de 70 Mo, mesure de la décision 0002), créé seulement au premier survol |
| B. Vue de la barre latérale (décision 0002, A2) | Aucun processus de plus | Vue transparente en `setBounds` rectangulaire : barre ouverte ou épinglée, la bulle exigerait de couvrir toute la hauteur jusqu'à la bulle et bloquerait les clics de la page. La 0002 écarte déjà les bulles d'aide |
| C. Barre de contrôle | Aucun coût natif | L'adresse apparaît en haut, loin de Arc et du lien survolé |

## Décision

Option A. Une `WebContentsView` sans interface React, sans preload, sans IPC, de 28 px de haut :

- chargée une fois d'un document `data:` statique (CSP `default-src 'none'`, aucun script) ; le processus principal y écrit
  le texte et le thème par `executeJavaScript` ; elle ne navigue pas et n'ouvre pas de fenêtre ;
- créée au premier survol, ajoutée sous la vue de la barre latérale puis retirée dès que le survol cesse, que l'onglet change
  ou que la page navigue ;
- au bas de la page, à gauche ; sous la souris, elle passe à droite (et inversement), comme Chrome ;
- texte filtré : caractères de contrôle et marques bidirectionnelles retirés, 2 000 caractères au plus ;
- couleurs jumelles de `--color-surface`, `--color-text-primary` et `--color-border` (test dans `apercuUrl.test.ts`).

## Limites acceptées

- shortcut : largeur de la bulle estimée (7 px par caractère, 60 % de la page au plus), pas mesurée ; mesurer le texte dans
  la vue si une police large coupe trop tôt.
- shortcut : police de repli Segoe UI, la vue ne charge pas Inter.
- L'aperçu web (`npm run dev:web`) n'a pas de page native : il ne montre pas la bulle.
- Une bulle de plus (infobulle, toast) passerait par ARB-126 ; cette vue ne sert qu'à l'adresse survolée.

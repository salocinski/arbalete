# Changelog

Toutes les évolutions notables d'Arbalète. Versions à 4 segments (`MAJEUR.MINEUR.CORRECTIF.MICRO`), gérées par `/ship`.

## [0.2.1.0] - 2026-11-02

### Corrigé
- Au démarrage, le clavier va bien à la page de l'onglet : on peut taper ou faire défiler tout de suite, sans que la
  barre latérale masquée garde le focus.
- La barre latérale se rouvre quand la souris revient vite au bord gauche juste après l'avoir quittée.

### Modifié
- L'interface est découpée en vues et composants (fenêtre, barre latérale, barre d'outils, onglets…), sans changement
  visible. Les prochaines évolutions de la barre et des onglets s'appuieront dessus.
- Les tests vérifient que la page de l'onglet a le focus au démarrage, et les tests de développement attendent que
  l'onglet ait chargé son adresse avant de commencer.

## [0.2.0.0] - 2026-11-02

### Modifié
- La barre latérale disparaît : à l'ouverture de la fenêtre, la page occupe toute la largeur. Approcher la souris du
  bord gauche fait apparaître la barre par-dessus la page, sans la déplacer ; elle se retire quand la souris la quitte
  ou au clic dans la page ou la barre d'outils. Le menu des espaces ouvert la garde affichée.
- Le bouton de repli devient un bouton d'épingle, dans la barre et dans la barre d'outils. Épinglée, la barre reste
  ouverte et la page lui laisse sa place. Ctrl+Maj+B épingle ou libère la barre, même quand le focus est dans une page.
- Le thème choisi s'applique ensemble à la fenêtre et à la barre latérale.
- Ctrl+T, Ctrl+W et Alt+flèches fonctionnent aussi quand le focus est dans la barre latérale.

### Ajouté
- Les tests C31 à C35 et C9 couvrent la barre masquée à l'ouverture, le survol, le retrait, l'épinglage, Ctrl+Maj+B, le
  verrouillage de la vue de la barre et le thème partagé.

## [0.1.5.0] - 2026-11-01

### Modifié
- La barre latérale s'ouvre repliée : à l'ouverture de la fenêtre, seule la bande d'icônes est visible et la page
  prend la largeur libérée. Le bouton en haut de la barre et Ctrl+Maj+B la déploient toujours.

### Ajouté
- Les tests C31 et C32 vérifient la barre repliée à l'ouverture et l'aller-retour avec Ctrl+Maj+B ; C18 la vérifie
  aussi en mode développement.

## [0.1.4.0] - 2026-11-01

### Corrigé
- En développement (`npm run dev`), F12 ouvre et ferme les outils de développement de l'interface où que soit le
  focus : dans la page de l'onglet comme dans l'interface. Jusqu'ici, F12 ne faisait rien au démarrage, quand le
  focus est dans la page. La page ne reçoit plus F12, même maintenue, et un appui long ne fait plus clignoter les
  outils de développement.

### Ajouté
- Les tests C28 à C30 couvrent F12 depuis un onglet, les autres touches et la répétition automatique, et vérifient
  que la page ne reçoit pas F12.

## [0.1.3.0] - 2026-11-01

### Modifié
- Plus de menu d'application : dans l'app construite, Ctrl+Maj+I n'ouvre plus les outils de développement de
  l'interface et Ctrl+R ne la recharge plus. En développement, F12 ouvre toujours ces outils. Le zoom au clavier et
  F11 disparaissent avec ce menu ; ils reviendront, gérés par Arbalète (ARB-107).
- Une page ne peut plus ouvrir que des adresses web dans un nouvel onglet : un lien ou un `window.open` vers
  `file://`, `about:blank` ou un schéma inconnu n'ouvre rien.
- Les pages ne peuvent plus noyer le navigateur sous les onglets : une page en ouvre au plus 5 par 10 secondes,
  toutes les pages réunies 20, et plus aucun au-delà de 50 onglets ouverts. L'utilisateur peut toujours en ouvrir
  depuis l'interface.

### Ajouté
- Les tests automatisés couvrent ces protections : absence de menu, F12 en build et en développement, schémas
  refusés, quotas par onglet et global, fenêtre de 10 secondes et plafond de 50 onglets (C19 à C27).

## [0.1.2.0] - 2026-11-01

### Modifié
- L'interface d'Arbalète est verrouillée : seule sa propre page peut piloter le navigateur. Une page web qui
  obtiendrait le pont `window.arbalete`, un iframe ou une autre fenêtre voit ses commandes refusées.
- La fenêtre de l'interface ne navigue plus : un lien glissé sur la barre latérale ou un script ne peut plus la
  remplacer par une autre page, ni ouvrir de nouvelle fenêtre.
- L'interface construite applique une Content-Security-Policy stricte : aucun script ou style inline, aucune
  ressource externe. Le serveur de développement garde une politique assouplie pour le rechargement à chaud.
- Une app empaquetée ignore `ELECTRON_RENDERER_URL` : elle charge toujours son interface embarquée.

### Ajouté
- Les tests automatisés couvrent ce verrouillage : CSP du build, appels refusés depuis une autre page ou un autre
  fichier local, fenêtre qui ne navigue pas, et mode développement servi par Vite (`tests/developpement.spec.ts`).

## [0.1.1.0] - 2026-10-31

### Modifié
- Arbalète tourne sur Electron 45.1.0 (Chromium et Node 24 à jour). Electron 42 n'était plus maintenu ; la
  version d'Electron est désormais épinglée exactement dans `package.json`.
- Outillage de build à jour : electron-vite 6, Vite 8 et @vitejs/plugin-react 6.
- L'installation demande une étape de plus : `npx install-electron` après `npm install` (ou `npm ci`), car
  `npm install` ne télécharge plus le binaire d'Electron. Sans elle, `npm run dev` échoue.

### Ajouté
- `npm run test:smoke` vérifie l'app construite sous Windows : démarrage, barre d'adresse, précédent/suivant,
  onglets, liens qui ouvrent un onglet, schémas non web refusés, permissions refusées, repli de la barre
  latérale, bouton Recharger et placement de la page au redimensionnement.
- Mises à jour hebdomadaires des dépendances par Dependabot, avec Electron dans son propre groupe.
- Licence GPL-3.0-or-later, README, guide de contribution, code de conduite (Contributor Covenant 2.1) et
  politique de sécurité.

## [0.1.0.0] - 2026-10-27

### Ajouté
- Prototype Electron + React + TypeScript : navigation Chromium réelle (WebContentsView), onglets,
  barre latérale repliable, thèmes système/sombre/clair.
- Aperçu navigateur de l'interface (`npm run dev:web`, API simulée) pour tester l'UI hors Electron.
- Outillage gstack : `CLAUDE.md` (contexte, commandes, cycle de travail), `DESIGN.md`, `VERSION`, `CHANGELOG.md`.
- `.gitignore`, `.gitattributes` (LF), `package-lock.json`.

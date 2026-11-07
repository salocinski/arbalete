# Arbalète

**Un navigateur Web libre pour Windows, pensé pour la productivité.**
Barre latérale, espaces de travail, organisation des onglets : une ergonomie inspirée d'Arc, dans un
projet communautaire sous licence GPL-3.0.

> **Statut : en développement (0.12).** La navigation, les onglets, la restauration de session, l'historique et les
> thèmes Dark, Light et System fonctionnent, mais Arbalète n'est pas encore prêt pour un usage quotidien.
> Favoris, espaces de travail, téléchargements et extensions sont en cours de construction. Détails techniques :
> [README de l'application](arbalete-browser/README.md).

## Objectifs

- **Ergonomie** : barre latérale rétractable, espaces de travail avec leur couleur, palette de commandes (Ctrl+K).
- **Productivité** : organisation des onglets, onglets épinglés, raccourcis clavier fiables.
- **Fiabilité** : un vrai navigateur pour tous les jours, pas une maquette.
- **Sécurité** : les bonnes pratiques d'Electron et de Chromium appliquées dès le départ.
- **Extensions Chrome** : compatibilité visée, en cours d'évaluation.

## Démarrer

Prérequis : Windows 10/11, [Node.js LTS](https://nodejs.org), Git.

```powershell
git clone https://github.com/salocinski/arbalete.git
cd arbalete\arbalete-browser
npm install
npx install-electron   # télécharge le binaire Electron, que npm install ne récupère plus
npm run dev
```

`npx install-electron` est à relancer après chaque `npm ci` ou mise à jour d'Electron : sans le binaire,
`npm run dev` échoue.

| Commande | Rôle |
|---|---|
| `npm run dev` | Lancer Arbalète (Electron) |
| `npm run dev:web` | Aperçu de l'interface dans un navigateur, sur http://localhost:5180 |
| `npm run typecheck` | Vérification TypeScript |
| `npm run build` | Build de production |
| `npm run test:unit` | Tests unitaires (couche de données, design tokens, polices, composants de base) |
| `npm run test:smoke` | Test automatisé de l'app construite (Playwright) |

## Technologies

Electron (Chromium), React, TypeScript, Vite.

## Contribuer

Les contributions sont bienvenues : code, tests, design, documentation, signalements de bugs.
Lis le [guide de contribution](CONTRIBUTING.md) et le [code de conduite](CODE_OF_CONDUCT.md).
Pour une faille de sécurité, suis la [politique de sécurité](SECURITY.md), pas une issue publique.

## Licence

Arbalète est un logiciel libre distribué sous licence **GNU GPL v3.0 ou ultérieure** (voir [LICENSE](LICENSE)).
Vous pouvez l'utiliser, l'étudier, le modifier et le redistribuer. Toute version modifiée distribuée doit
rester sous la même licence, avec son code source.

## Mention

Arbalète est un projet indépendant. Il n'est ni affilié, ni approuvé par The Browser Company ;
« Arc » est une marque de son propriétaire.

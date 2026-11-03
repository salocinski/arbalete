// Lance les tests unitaires (src/**/*.test.ts) sous le Node embarqué par Electron : node:sqlite y est la version
// livrée avec Arbalète (décision 0001). Node y retire les types TypeScript à l'exécution.
import { spawnSync } from 'node:child_process'
import { globSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

// Depuis la racine du projet, quel que soit le dossier d'appel ; aucun fichier trouvé est un échec, pas un succès vide.
const racine = fileURLToPath(new URL('..', import.meta.url))
const fichiers = globSync('src/**/*.test.ts', { cwd: racine })
if (fichiers.length === 0) {
  console.error('Aucun test unitaire trouvé (src/**/*.test.ts).')
  process.exit(1)
}

const resultat = spawnSync(
  electron,
  ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--test', ...fichiers],
  { cwd: racine, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
)
process.exit(resultat.status ?? 1)

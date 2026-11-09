import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict'
import { globSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Garde-fous des design tokens (ARB-34) : les couleurs ne vivent que dans tokens.css, les deux palettes définissent
// les mêmes variables, et le fond natif de la fenêtre suit --color-background.

const racine = fileURLToPath(new URL('../../../..', import.meta.url))
const lire = (chemin: string) => readFileSync(racine + chemin, 'utf8')
const tokens = lire('src/renderer/src/design-system/tokens.css')
const HEX = /(?<![\w&])#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/g

function bloc(selecteur: string): Map<string, string> {
  const debut = tokens.indexOf(selecteur + ' {')
  ok(debut >= 0, `bloc ${selecteur} introuvable`)
  const corps = tokens.slice(debut, tokens.indexOf('}', debut))
  return new Map([...corps.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}
const sombre = bloc(":root[data-theme='dark']")
const clair = bloc(":root[data-theme='light']")

test('aucune valeur hexadécimale hors de tokens.css', () => {
  const fichiers = globSync('src/renderer/src/**/*.{css,tsx,ts}', { cwd: racine })
    .filter((f) => !f.replaceAll('\\', '/').endsWith('design-system/tokens.css') && !f.endsWith('.test.ts'))
  ok(fichiers.some((f) => f.endsWith('styles.css')), 'styles.css doit être analysé')
  const fautes = fichiers.flatMap((f) => (lire(f).match(HEX) ?? []).map((hex) => `${f} : ${hex}`))
  deepStrictEqual(fautes, [])
})

test('les palettes sombre et claire définissent les mêmes variables', () => {
  deepStrictEqual([...clair.keys()].sort(), [...sombre.keys()].sort())
  for (const nom of ['--color-background', '--color-surface', '--color-sidebar', '--color-text-primary',
    '--color-text-secondary', '--color-border', '--color-accent', '--color-accent-hover', '--color-accent-active',
    '--color-focus', '--color-success', '--color-warning', '--color-error']) {
    ok(sombre.has(nom), `${nom} manque`)
  }
  // Sans data-theme (avant le premier rendu), la palette sombre s'applique.
  ok(tokens.includes(":root,\n:root[data-theme='dark'] {"), 'la palette sombre doit être celle par défaut')
})

test('le fond natif de la fenêtre suit --color-background de chaque thème', () => {
  const fond = /const FOND_FENETRE = \{ dark: '(#\w+)', light: '(#\w+)' \}/.exec(lire('src/main/index.ts'))
  ok(fond, 'FOND_FENETRE introuvable dans src/main/index.ts')
  strictEqual(fond[1].toLowerCase(), sombre.get('--color-background')?.toLowerCase())
  strictEqual(fond[2].toLowerCase(), clair.get('--color-background')?.toLowerCase())
})

test('les boutons Windows (titleBarOverlay) suivent les tokens de chaque thème et la hauteur de la barre de contrôle', () => {
  const principal = lire('src/main/index.ts')
  const symboles = /const SYMBOLES_FENETRE = \{ dark: '(#\w+)', light: '(#\w+)' \}/.exec(principal)
  ok(symboles, 'SYMBOLES_FENETRE introuvable dans src/main/index.ts')
  strictEqual(symboles[1].toLowerCase(), sombre.get('--color-text-primary')?.toLowerCase())
  strictEqual(symboles[2].toLowerCase(), clair.get('--color-text-primary')?.toLowerCase())
  const hauteur = /const HAUTEUR_BARRE_CONTROLE = (\d+)/.exec(principal)
  ok(hauteur, 'HAUTEUR_BARRE_CONTROLE introuvable dans src/main/index.ts')
  strictEqual(`${hauteur[1]}px`, tokens.match(/--size-control-bar:\s*(\w+);/)?.[1])
})

test('le cadre de page (ARB-32) a une marge de --space-2 et le rayon --radius-md, jumeau de RAYON_PAGE', () => {
  const rayon = /const RAYON_PAGE = (\d+)/.exec(lire('src/main/index.ts'))
  ok(rayon, 'RAYON_PAGE introuvable dans src/main/index.ts')
  strictEqual(`${rayon[1]}px`, tokens.match(/--radius-md:\s*(\w+);/)?.[1])
  ok(/view\.setBorderRadius\(RAYON_PAGE\)/.test(lire('src/main/index.ts')), 'chaque vue web doit être arrondie')
  const cadre = /\.web-content \{([^}]*)\}/.exec(lire('src/renderer/src/styles.css'))?.[1] ?? ''
  ok(/inset: 0 var\(--space-2\) var\(--space-2\)/.test(cadre), 'marge de --space-2 sur les côtés et en bas')
  ok(/border-radius: var\(--radius-md\)/.test(cadre), 'coins en --radius-md')
})

test('la barre de contrôle déplace la fenêtre, ses boutons et champs non', () => {
  const styles = lire('src/renderer/src/styles.css')
  ok(/\.toolbar \{[^}]*-webkit-app-region: drag/.test(styles), 'la barre de contrôle doit être une zone de déplacement')
  ok(/\.toolbar button, \.toolbar input[^{]*\{ -webkit-app-region: no-drag/.test(styles), 'ses contrôles doivent rester cliquables')
})

test('les polices embarquées couvrent les familles des tokens, fichiers présents', () => {
  const polices = lire('src/renderer/src/design-system/fonts.css')
  const declarees = new Set([...polices.matchAll(/font-family: '([^']+)'/g)].map((m) => m[1]))
  for (const nom of ['--font-ui', '--font-display', '--font-mono']) {
    const famille = tokens.match(new RegExp(`${nom}:\\s*'?([^,']+)'?,`))?.[1]?.trim()
    ok(famille && declarees.has(famille), `${nom} : la famille ${famille} n'a pas de @font-face`)
  }
  const fichiers = [...polices.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1])
  strictEqual(fichiers.length, 6)
  for (const f of fichiers) ok(globSync(`node_modules/${f}`, { cwd: racine }).length === 1, `${f} introuvable`)
})

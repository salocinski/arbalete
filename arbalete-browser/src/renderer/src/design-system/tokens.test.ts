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

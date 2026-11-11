import { deepStrictEqual, ok } from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { COULEURS_ESPACE } from '../../../shared/espaces.ts'

// Palette de choix des couleurs d'espace (ARB-134) : chaque couleur a une variante dans chaque thème, et chacune reste un
// repère visible (3:1, seuil WCAG d'un élément non textuel) sur la barre latérale de son thème.

const tokens = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8')

function palette(selecteur: string): Map<string, string> {
  const debut = tokens.indexOf(selecteur + ' {')
  ok(debut >= 0, `bloc ${selecteur} introuvable`)
  const corps = tokens.slice(debut, tokens.indexOf('}', debut))
  return new Map([...corps.matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6});/g)].map((m) => [m[1], m[2]]))
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a: string, b: string) => {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (clair + 0.05) / (sombre + 0.05)
}

for (const [theme, selecteur] of [['sombre', ":root[data-theme='dark']"], ['clair', ":root[data-theme='light']"]] as const) {
  const couleurs = palette(selecteur)
  test(`thème ${theme} : une variante par couleur d'espace, pas d'orphelin, 3:1 sur la barre latérale`, () => {
    const definies = [...couleurs.keys()].filter((nom) => nom.startsWith('--color-workspace-')).map((nom) => nom.slice('--color-workspace-'.length))
    deepStrictEqual(definies.sort(), [...COULEURS_ESPACE].sort())
    const barre = couleurs.get('--color-sidebar')
    ok(barre, '--color-sidebar manque')
    for (const nom of COULEURS_ESPACE) {
      const ratio = contraste(couleurs.get(`--color-workspace-${nom}`) as string, barre)
      ok(ratio >= 3, `${nom} : ${ratio.toFixed(2)}:1 sur la barre (${theme})`)
    }
  })
}

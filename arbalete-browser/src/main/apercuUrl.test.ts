import { deepStrictEqual, match, ok, strictEqual } from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { COULEURS_APERCU, HAUTEUR_APERCU, pageApercu, placerApercu, scriptApercu, texteApercu } from './apercuUrl.ts'

// Aperçu de l'adresse d'un lien survolé (ARB-36) : texte affiché, géométrie de la bulle, document de la vue.

test('texteApercu garde l’adresse, retire contrôles et marques bidirectionnelles, coupe les adresses géantes', () => {
  strictEqual(texteApercu('https://exemple.fr/a?b=1#c'), 'https://exemple.fr/a?b=1#c')
  strictEqual(texteApercu('  https://exemple.fr/‮fdp.exe\u0000\n'), 'https://exemple.fr/fdp.exe')
  strictEqual(texteApercu(''), '')
  strictEqual(texteApercu(undefined), '')
  strictEqual(texteApercu(42), '')
  const longue = texteApercu('https://exemple.fr/' + 'a'.repeat(5000))
  strictEqual(longue.length, 2001)
  ok(longue.endsWith('…'))
})

test('placerApercu pose la bulle au bas de la page, à gauche ou à droite, sans en sortir', () => {
  const page = { x: 8, y: 48, width: 1000, height: 600 }
  const gauche = placerApercu(page, 'https://exemple.fr', 'gauche')
  deepStrictEqual(gauche, { x: 16, y: 48 + 600 - 8 - HAUTEUR_APERCU, width: 18 * 7 + 26, height: HAUTEUR_APERCU })
  const droite = placerApercu(page, 'https://exemple.fr', 'droite')
  strictEqual(droite.x + droite.width, page.x + page.width - 8)
  strictEqual(droite.y, gauche.y)
  // Adresse longue : plafonnée à 60 % de la page.
  strictEqual(placerApercu(page, 'a'.repeat(1000), 'gauche').width, 600)
  // Page minuscule : jamais plus large que la page moins ses marges.
  const etroite = placerApercu({ x: 0, y: 0, width: 40, height: 100 }, 'x', 'gauche')
  ok(etroite.width <= 24)
})

test('scriptApercu échappe le texte : une adresse ne peut pas sortir de la chaîne', () => {
  const script = scriptApercu('"; alert(1); //', 'light')
  strictEqual(script, 'document.body.className="light";document.getElementById(\'t\').textContent="\\"; alert(1); //"')
})

test('pageApercu : data URL sans script, CSP restrictive, une classe par thème', () => {
  const adresse = pageApercu()
  ok(adresse.startsWith('data:text/html;charset=utf-8,'))
  const html = decodeURIComponent(adresse.slice('data:text/html;charset=utf-8,'.length))
  ok(!/<script/i.test(html))
  match(html, /Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"/)
  match(html, /body\.dark\{/)
  match(html, /body\.light\{/)
})

// Les couleurs de la bulle sont les jumelles des tokens (--color-surface, --color-text-primary, --color-border).
test('les couleurs de la bulle suivent les tokens de chaque thème', () => {
  const racine = fileURLToPath(new URL('../..', import.meta.url))
  const tokens = readFileSync(racine + 'src/renderer/src/design-system/tokens.css', 'utf8')
  const palette = (selecteur: string) => {
    const debut = tokens.indexOf(selecteur + ' {')
    ok(debut >= 0, `bloc ${selecteur} introuvable`)
    return new Map([...tokens.slice(debut, tokens.indexOf('}', debut)).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().toLowerCase()]))
  }
  for (const [nom, bloc] of [['dark', palette(":root[data-theme='dark']")], ['light', palette(":root[data-theme='light']")]] as const) {
    strictEqual(COULEURS_APERCU[nom].fond.toLowerCase(), bloc.get('--color-surface'))
    strictEqual(COULEURS_APERCU[nom].texte.toLowerCase(), bloc.get('--color-text-primary'))
    strictEqual(COULEURS_APERCU[nom].bord.toLowerCase(), bloc.get('--color-border'))
  }
})

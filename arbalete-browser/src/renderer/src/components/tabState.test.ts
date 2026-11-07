import { deepEqual, ok } from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { etatsOnglet, iconeFavicon, iconeSonore } from './tabState.ts'

const base = { id: 't', title: 'T', url: 'https://a.test', isLoading: false, canGoBack: false, canGoForward: false }

test('un onglet ordinaire n’a aucun état, un onglet actif a Active', () => {
  deepEqual(etatsOnglet(base, false), [])
  deepEqual(etatsOnglet(base, true), ['active'])
})

test('les états se cumulent dans un ordre stable', () => {
  deepEqual(etatsOnglet({ ...base, pinned: true, isLoading: true, muted: true, error: true }, true), ['active', 'pinned', 'loading', 'muted', 'error'])
})

// Value: protects=précédences d'icône du favicon et de l'indicateur sonore; fails_when=l'erreur ne l'emporte plus sur
// le chargement ou le muet sur le son; why_new=aucun test ne couvre ces branches; seam=none; no_claim=le rendu React.
test('l’erreur l’emporte sur le chargement et le muet sur le son', () => {
  deepEqual(iconeFavicon(base), 'generique')
  deepEqual(iconeFavicon({ ...base, isLoading: true }), 'chargement')
  deepEqual(iconeFavicon({ ...base, isLoading: true, error: true }), 'erreur')
  deepEqual(iconeSonore(base), null)
  deepEqual(iconeSonore({ ...base, audible: true }), 'son')
  deepEqual(iconeSonore({ ...base, audible: true, muted: true }), 'muet')
})

// Garde-fous visuels (ARB-124) : les sept états existent dans la feuille de style, sans valeur de couleur en dur.
const css = readFileSync(fileURLToPath(new URL('../styles.css', import.meta.url)), 'utf8')

test('la feuille de style définit Hover, Active, Pinned, Loading, Muted et Error', () => {
  for (const motif of ['.tab-item:hover', '.tab-item--active', '.tab-pin', '.tab-item--loading', '.tab-item--muted', '.tab-item--error', '.tab-audio'])
    ok(css.includes(motif), `${motif} manque`)
})

test('la réorganisation dure 160 ms par token et prefers-reduced-motion coupe les transitions', () => {
  ok(/\.tab-item \{[^}]*transform var\(--duration-tab-reorder\)/.test(css), 'transition de réorganisation manquante')
  ok(/prefers-reduced-motion: reduce[^}]*transition: none !important/.test(css), 'réduction des animations manquante')
})

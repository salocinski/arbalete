import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { palierZoom, sensDuZoom } from './zoom.ts'

// Zoom de la page de l'onglet actif (ARB-107) : geste reconnu selon la touche, palier suivant.

const touche = (key: string, plus: Partial<{ code: string, control: boolean, alt: boolean, meta: boolean }> = {}) =>
  ({ key, control: true, alt: false, meta: false, ...plus })

test('Ctrl+=, Ctrl++, Ctrl+- et Ctrl+0 (chiffres du clavier ou pavé numérique) sont des gestes de zoom', () => {
  strictEqual(sensDuZoom(touche('=')), 'plus')
  strictEqual(sensDuZoom(touche('+')), 'plus')
  strictEqual(sensDuZoom(touche('-')), 'moins')
  strictEqual(sensDuZoom(touche('0')), 'zero')
  strictEqual(sensDuZoom(touche('Add', { code: 'NumpadAdd' })), 'plus')
  strictEqual(sensDuZoom(touche('Subtract', { code: 'NumpadSubtract' })), 'moins')
  strictEqual(sensDuZoom(touche('Insert', { code: 'Numpad0' })), 'zero')
})

test('sans Ctrl, avec AltGr (Ctrl+Alt) ou avec Meta, ou pour une autre touche, ce n\'est pas un zoom', () => {
  strictEqual(sensDuZoom(touche('=', { control: false })), undefined)
  strictEqual(sensDuZoom(touche('=', { alt: true })), undefined)
  strictEqual(sensDuZoom(touche('-', { meta: true })), undefined)
  strictEqual(sensDuZoom(touche('a')), undefined)
  strictEqual(sensDuZoom(touche('à')), undefined)
})

test('palierZoom suit les paliers de Chrome, revient à 100 % et reste dans 25 %-500 %', () => {
  deepStrictEqual([1, 1.1, 1.25, 1.5].map((f) => palierZoom(f, 'plus')), [1.1, 1.25, 1.5, 1.75])
  deepStrictEqual([1, 0.9, 0.8, 0.75].map((f) => palierZoom(f, 'moins')), [0.9, 0.8, 0.75, 0.67])
  strictEqual(palierZoom(2.5, 'zero'), 1)
  strictEqual(palierZoom(5, 'plus'), 5)
  strictEqual(palierZoom(0.25, 'moins'), 0.25)
  // Un facteur issu de la puissance de 1,2 de Chromium (1,2 ^ 1 = 1,2) passe au palier voisin, pas à lui-même.
  strictEqual(palierZoom(1.2, 'plus'), 1.25)
  strictEqual(palierZoom(1.2, 'moins'), 1.1)
  // Un palier atteint à 0,1 % près compte pour ce palier.
  strictEqual(palierZoom(1.0004, 'plus'), 1.1)
  strictEqual(palierZoom(1.0004, 'moins'), 0.9)
})

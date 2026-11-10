import { strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { numeroDOnglet, ongletNumero, ongletRelatif, pasDOnglet, rechargement } from './navigationClavier.ts'

// Changement d'onglet au clavier (ARB-19) et rechargement (ARB-21).

const touche = (key: string, plus: Partial<{ code: string, control: boolean, alt: boolean, meta: boolean, shift: boolean }> = {}) =>
  ({ key, code: key, control: false, alt: false, meta: false, shift: false, ...plus })
const ctrl = (key: string, plus = {}) => touche(key, { control: true, ...plus })

test('Ctrl+Tab et Ctrl+PageDown avancent, Ctrl+Maj+Tab et Ctrl+PageUp reculent', () => {
  strictEqual(pasDOnglet(ctrl('Tab')), 1)
  strictEqual(pasDOnglet(ctrl('PageDown')), 1)
  strictEqual(pasDOnglet(ctrl('Tab', { shift: true })), -1)
  strictEqual(pasDOnglet(ctrl('PageUp')), -1)
})

test('sans Ctrl, avec AltGr ou Meta, ou Ctrl+Maj+PageUp (déplacement), ce n\'est pas un changement d\'onglet', () => {
  strictEqual(pasDOnglet(touche('Tab')), undefined)
  strictEqual(pasDOnglet(ctrl('Tab', { alt: true })), undefined)
  strictEqual(pasDOnglet(ctrl('Tab', { meta: true })), undefined)
  strictEqual(pasDOnglet(ctrl('PageUp', { shift: true })), undefined)
  strictEqual(pasDOnglet(ctrl('PageDown', { shift: true })), undefined)
  strictEqual(pasDOnglet(ctrl('a')), undefined)
})

test('Ctrl+1…9 se lit sur la touche physique, y compris sur un AZERTY et au pavé numérique', () => {
  strictEqual(numeroDOnglet(ctrl('&', { code: 'Digit1' })), 1)
  strictEqual(numeroDOnglet(ctrl('9', { code: 'Digit9' })), 9)
  strictEqual(numeroDOnglet(ctrl('3', { code: 'Numpad3' })), 3)
  strictEqual(numeroDOnglet(ctrl('0', { code: 'Digit0' })), undefined)
  strictEqual(numeroDOnglet(ctrl('1', { code: 'Digit1', shift: true })), undefined)
  strictEqual(numeroDOnglet(ctrl('1', { code: 'Digit1', alt: true })), undefined)
  strictEqual(numeroDOnglet(touche('1', { code: 'Digit1' })), undefined)
})

test('F5 et Ctrl+R rechargent, Ctrl+F5, Maj+F5 et Ctrl+Maj+R rechargent sans cache', () => {
  strictEqual(rechargement(touche('F5'), 'f5'), 'normal')
  strictEqual(rechargement(ctrl('r'), 'r'), 'normal')
  strictEqual(rechargement(ctrl('F5'), 'f5'), 'sans-cache')
  strictEqual(rechargement(touche('F5', { shift: true }), 'f5'), 'sans-cache')
  strictEqual(rechargement(ctrl('F5', { shift: true }), 'f5'), 'sans-cache')
  strictEqual(rechargement(ctrl('R', { shift: true }), 'r'), 'sans-cache')
})

test('Alt+F5, Meta, R sans Ctrl ou une autre lettre ne rechargent pas', () => {
  strictEqual(rechargement(touche('F5', { alt: true }), 'f5'), undefined)
  strictEqual(rechargement(touche('F5', { meta: true }), 'f5'), undefined)
  strictEqual(rechargement(touche('r'), 'r'), undefined)
  strictEqual(rechargement(ctrl('t'), 't'), undefined)
  strictEqual(rechargement(ctrl('r', { alt: true }), 'r'), undefined)
})

test('ongletRelatif boucle dans l\'ordre affiché et ne fait rien avec un seul onglet', () => {
  const ids = ['a', 'b', 'c']
  strictEqual(ongletRelatif(ids, 'a', 1), 'b')
  strictEqual(ongletRelatif(ids, 'c', 1), 'a')
  strictEqual(ongletRelatif(ids, 'a', -1), 'c')
  strictEqual(ongletRelatif(['a'], 'a', 1), null)
  strictEqual(ongletRelatif([], null, 1), null)
  strictEqual(ongletRelatif(ids, 'inconnu', 1), 'a')
})

test('ongletNumero vise le n-ième onglet, le dernier pour 9, et rien au-delà', () => {
  const ids = ['a', 'b', 'c']
  strictEqual(ongletNumero(ids, 1), 'a')
  strictEqual(ongletNumero(ids, 3), 'c')
  strictEqual(ongletNumero(ids, 5), null)
  strictEqual(ongletNumero(ids, 9), 'c')
  strictEqual(ongletNumero([], 9), null)
})

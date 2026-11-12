import assert from 'node:assert/strict'
import { test } from 'node:test'
import { entreeMenuPageValide } from '../shared/menuPage.ts'
import { entreesMenuPage, type ContexteMenuPage } from './menuPage.ts'

const base: ContexteMenuPage = { lien: '', image: '', texteSelectionne: false, peutReculer: false, peutAvancer: false, inspecter: false }

test('page nue : seulement Recharger', () => {
  assert.deepEqual(entreesMenuPage(base), ['recharger'])
})

test('page avec historique : Précédent et Suivant précèdent Recharger', () => {
  assert.deepEqual(entreesMenuPage({ ...base, peutReculer: true, peutAvancer: true }), ['retour', 'avancer', 'recharger'])
})

test('lien web : ouvrir et copier l’adresse, sans navigation', () => {
  assert.deepEqual(entreesMenuPage({ ...base, lien: 'https://exemple.test/a', peutReculer: true }), ['ouvrir-lien', 'copier-lien'])
})

test('lien image : ouvrir, copier l’adresse, enregistrer l’image', () => {
  assert.deepEqual(entreesMenuPage({ ...base, lien: 'http://a.test/', image: 'https://a.test/i.png' }), ['ouvrir-lien', 'copier-lien', 'enregistrer-image'])
})

test('adresses non web refusées', () => {
  for (const adresse of ['javascript:alert(1)', 'data:text/html,x', 'blob:https://a.test/x', 'file:///c:/x', 'mailto:a@b.test']) {
    assert.deepEqual(entreesMenuPage({ ...base, lien: adresse, image: adresse }), ['recharger'], adresse)
  }
})

test('sélection : Copier', () => {
  assert.deepEqual(entreesMenuPage({ ...base, texteSelectionne: true }), ['copier'])
})

test('Inspecter s’ajoute en dernier quand il est permis', () => {
  assert.deepEqual(entreesMenuPage({ ...base, inspecter: true }), ['recharger', 'inspecter'])
})

test('entrée inconnue ou héritée refusée', () => {
  assert.equal(entreeMenuPageValide('recharger'), true)
  for (const v of ['toString', '__proto__', 42, undefined]) assert.equal(entreeMenuPageValide(v), false)
})

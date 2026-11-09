import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ongletVoisin } from './voisin.ts'

test('fermer le 2e sur 4 active le 3e', () => {
  assert.equal(ongletVoisin(['a', 'b', 'c', 'd'], 'b'), 'c')
})

test('fermer le dernier active le précédent', () => {
  assert.equal(ongletVoisin(['a', 'b', 'c'], 'c'), 'b')
})

test('fermer le premier active le suivant', () => {
  assert.equal(ongletVoisin(['a', 'b'], 'a'), 'b')
})

test('le seul onglet fermé ne laisse aucun voisin', () => {
  assert.equal(ongletVoisin(['a'], 'a'), null)
})

test('un onglet inconnu retombe sur le dernier', () => {
  assert.equal(ongletVoisin(['a', 'b'], 'z'), 'b')
})

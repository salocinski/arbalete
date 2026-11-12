import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fusionnerOrdre, ordreApresDeplacementOnglet, reordonnerOnglets } from './ordreOnglets.ts'

test('la Map réordonnée garde les enregistrements, les onglets des autres espaces et l’ordre voulu', () => {
  const onglets = new Map([['a', { espace: 1 }], ['x', { espace: 2 }], ['b', { espace: 1 }], ['c', { espace: 1 }]])
  const apres = reordonnerOnglets(onglets, ['a', 'b', 'c'], 'c', 0)
  assert.deepEqual([...apres.keys()], ['c', 'x', 'a', 'b'])
  assert.equal(apres.get('x'), onglets.get('x'))
  assert.deepEqual([...onglets.keys()], ['a', 'x', 'b', 'c']) // l'entrée n'est pas modifiée
})

test('la Map est inchangée pour un onglet d’un autre espace ou un index aberrant', () => {
  const onglets = new Map([['a', 1], ['x', 2], ['b', 3]])
  assert.deepEqual([...reordonnerOnglets(onglets, ['a', 'b'], 'x', 0).keys()], ['a', 'x', 'b'])
  assert.deepEqual([...reordonnerOnglets(onglets, ['a', 'b'], 'a', 9).keys()], ['a', 'x', 'b'])
  assert.deepEqual([...reordonnerOnglets(onglets, [], 'a', 0).keys()], ['a', 'x', 'b'])
})

test('un onglet déposé prend l’index de la cible, vers le bas comme vers le haut', () => {
  assert.deepEqual(ordreApresDeplacementOnglet(['a', 'b', 'c', 'd'], 'a', 2), ['b', 'c', 'a', 'd'])
  assert.deepEqual(ordreApresDeplacementOnglet(['a', 'b', 'c', 'd'], 'd', 1), ['a', 'd', 'b', 'c'])
})

test('onglet inconnu, index aberrant ou sur place : ordre inchangé', () => {
  const ids = ['a', 'b', 'c']
  for (const [id, index] of [['z', 0], ['a', 3], ['a', -1], ['a', 1.5], ['b', 1], ['a', NaN]] as const)
    assert.deepEqual(ordreApresDeplacementOnglet(ids, id, index), ids)
})

test('les onglets des autres espaces gardent leur place', () => {
  assert.deepEqual(fusionnerOrdre(['a', 'x', 'b', 'y', 'c'], ['a', 'b', 'c'], ['c', 'a', 'b']), ['c', 'x', 'a', 'y', 'b'])
})

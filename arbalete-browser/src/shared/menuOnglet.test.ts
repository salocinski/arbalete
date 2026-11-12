import test from 'node:test'
import assert from 'node:assert/strict'
import { estActionOnglet, ongletsAFermer } from './menuOnglet.ts'

test('seules les actions de la liste sont reconnues', () => {
  assert.equal(estActionOnglet('dupliquer'), true)
  assert.equal(estActionOnglet('fermer-autres'), true)
  assert.equal(estActionOnglet('supprimer'), false)
  assert.equal(estActionOnglet(1), false)
  assert.equal(estActionOnglet(undefined), false)
})

test('fermer les autres garde l’onglet du menu et les onglets épinglés', () => {
  const onglets = [{ id: 'a' }, { id: 'b', pinned: true }, { id: 'c' }, { id: 'd' }]
  assert.deepEqual(ongletsAFermer(onglets, 'c'), ['a', 'd'])
  assert.deepEqual(ongletsAFermer([{ id: 'a' }], 'a'), [])
})

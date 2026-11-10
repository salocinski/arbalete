import assert from 'node:assert/strict'
import { test } from 'node:test'
import { depiler, empiler, FERMES_MAX } from './ongletsFermes.ts'

test('le dernier onglet fermé est rouvert en premier', () => {
  const pile = empiler(empiler([], 'https://a.test/'), 'https://b.test/')
  const premier = depiler(pile)
  assert.equal(premier?.url, 'https://b.test/')
  assert.equal(depiler(premier!.reste)?.url, 'https://a.test/')
})

test('une pile vide ne rouvre rien', () => {
  assert.equal(depiler([]), undefined)
})

test('la pile oublie les plus anciens au-delà de la limite', () => {
  let pile: string[] = []
  for (let i = 0; i < FERMES_MAX + 3; i++) pile = empiler(pile, `https://site${i}.test/`)
  assert.equal(pile.length, FERMES_MAX)
  assert.equal(pile[0], 'https://site3.test/')
})

test('about:blank et les schémas non web ne sont pas gardés', () => {
  for (const url of ['about:blank', 'javascript:alert(1)', 'data:text/html,x', '']) {
    assert.deepEqual(empiler([], url), [])
  }
  assert.deepEqual(empiler([], 'file:///C:/page.html'), ['file:///C:/page.html'])
})

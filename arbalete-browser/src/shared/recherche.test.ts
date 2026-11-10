import { strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { compteur } from './recherche.ts'

test('le compteur est vide sans texte ni résultat, « n/total » avec des résultats, « Aucun résultat » sinon', () => {
  strictEqual(compteur('', { active: 1, total: 3 }), '')
  strictEqual(compteur('abc', null), '')
  strictEqual(compteur('abc', { active: 3, total: 12 }), '3/12')
  strictEqual(compteur('abc', { active: 0, total: 0 }), 'Aucun résultat')
})

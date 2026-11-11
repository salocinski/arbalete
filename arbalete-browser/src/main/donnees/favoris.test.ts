import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { ouvrirBase } from './base.ts'
import { basculerFavori, estFavori } from './favoris.ts'
import { LONGUEUR_MAX_TITRE } from './historique.ts'

// Tests unitaires des favoris (ARB-47).

test('basculer ajoute puis retire le favori', () => {
  const db = ouvrirBase(':memory:')
  strictEqual(estFavori(db, 'https://example.com/'), false)
  strictEqual(basculerFavori(db, 'https://example.com/', 'Exemple', 1000), true)
  strictEqual(estFavori(db, 'https://example.com/'), true)
  deepStrictEqual(db.prepare('SELECT url, titre, date FROM favori').all().map((ligne) => ({ ...ligne })),
    [{ url: 'https://example.com/', titre: 'Exemple', date: 1000 }])
  strictEqual(basculerFavori(db, 'https://example.com/', 'Exemple'), false)
  strictEqual(estFavori(db, 'https://example.com/'), false)
})

test('un favori ne concerne que son adresse', () => {
  const db = ouvrirBase(':memory:')
  basculerFavori(db, 'https://example.com/a', 'A')
  strictEqual(estFavori(db, 'https://example.com/b'), false)
  strictEqual(estFavori(db, 'https://example.com/'), false)
})

test('le titre est tronqué', () => {
  const db = ouvrirBase(':memory:')
  basculerFavori(db, 'https://example.com/', 'x'.repeat(LONGUEUR_MAX_TITRE + 10))
  strictEqual((db.prepare('SELECT titre FROM favori').get() as { titre: string }).titre.length, LONGUEUR_MAX_TITRE)
})

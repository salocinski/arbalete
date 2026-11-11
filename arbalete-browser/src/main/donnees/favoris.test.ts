import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { ouvrirBase } from './base.ts'
import { FAVORIS_GRILLE_MAX, basculerFavori, estFavori, favorisGrille } from './favoris.ts'
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

test('la grille garde les 8 premiers favoris, dans leur ordre d’ajout', () => {
  const db = ouvrirBase(':memory:')
  for (let i = 1; i <= 10; i++) basculerFavori(db, `https://example.com/${i}`, `Page ${i}`, 1000 + i)
  const grille = favorisGrille(db)
  strictEqual(grille.length, FAVORIS_GRILLE_MAX)
  deepStrictEqual(grille[0], { url: 'https://example.com/1', titre: 'Page 1' })
  strictEqual(grille[7].url, 'https://example.com/8')
  basculerFavori(db, 'https://example.com/1', 'Page 1')
  strictEqual(favorisGrille(db)[0].url, 'https://example.com/2')
})

test('à date égale, la grille garde l’ordre d’ajout (id)', () => {
  const db = ouvrirBase(':memory:')
  for (const nom of ['c', 'a', 'b']) basculerFavori(db, `https://example.com/${nom}`, nom, 5000)
  deepStrictEqual(favorisGrille(db).map((f) => f.titre), ['c', 'a', 'b'])
})

test('le titre est tronqué', () => {
  const db = ouvrirBase(':memory:')
  basculerFavori(db, 'https://example.com/', 'x'.repeat(LONGUEUR_MAX_TITRE + 10))
  strictEqual((db.prepare('SELECT titre FROM favori').get() as { titre: string }).titre.length, LONGUEUR_MAX_TITRE)
})

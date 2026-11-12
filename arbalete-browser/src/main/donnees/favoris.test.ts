import { DatabaseSync } from 'node:sqlite'
import { MIGRATIONS, appliquerMigrations } from './migrations.ts'
import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict'
import { test } from 'node:test'
import { ouvrirBase } from './base.ts'
import { FAVORIS_GRILLE_MAX, basculerFavori, creerDossier, deplacerFavori, estFavori, favorisGrille, listerFavoris, renommerDossier, retirerFavori, supprimerDossier } from './favoris.ts'
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

// Panneau des favoris et dossiers (ARB-48).

test('créer, renommer et ranger un favori dans un dossier', () => {
  const db = ouvrirBase(':memory:')
  basculerFavori(db, 'https://example.com/a', 'A', 1)
  const dossier = creerDossier(db, '  Travail ')
  const [{ id }] = listerFavoris(db).favoris
  strictEqual(renommerDossier(db, dossier, 'Boulot'), true)
  strictEqual(deplacerFavori(db, id, dossier), true)
  deepStrictEqual(listerFavoris(db), {
    dossiers: [{ id: dossier, nom: 'Boulot' }],
    favoris: [{ id, url: 'https://example.com/a', titre: 'A', dossier }]
  })
  strictEqual(deplacerFavori(db, id, null), true)
  strictEqual(listerFavoris(db).favoris[0].dossier, null)
})

test('un nom de dossier vide ou trop long est refusé, un dossier ou un favori inconnu ne change rien', () => {
  const db = ouvrirBase(':memory:')
  throws(() => creerDossier(db, '   '))
  throws(() => creerDossier(db, 'x'.repeat(61)))
  throws(() => creerDossier(db, 3))
  const dossier = creerDossier(db, 'D')
  throws(() => renommerDossier(db, dossier, ''))
  strictEqual(renommerDossier(db, 999, 'X'), false)
  basculerFavori(db, 'https://example.com/a', 'A')
  const [{ id }] = listerFavoris(db).favoris
  strictEqual(deplacerFavori(db, id, 999), false)
  strictEqual(deplacerFavori(db, 999, dossier), false)
  strictEqual(listerFavoris(db).favoris[0].dossier, null)
})

test('supprimer un dossier garde ses favoris, à la racine', () => {
  const db = ouvrirBase(':memory:')
  basculerFavori(db, 'https://example.com/a', 'A')
  const dossier = creerDossier(db, 'D')
  deplacerFavori(db, listerFavoris(db).favoris[0].id, dossier)
  strictEqual(supprimerDossier(db, dossier), true)
  strictEqual(supprimerDossier(db, dossier), false)
  deepStrictEqual(listerFavoris(db).dossiers, [])
  strictEqual(estFavori(db, 'https://example.com/a'), true)
  strictEqual(listerFavoris(db).favoris[0].dossier, null)
})

test('retirer un favori par id', () => {
  const db = ouvrirBase(':memory:')
  basculerFavori(db, 'https://example.com/a', 'A')
  strictEqual(retirerFavori(db, listerFavoris(db).favoris[0].id), true)
  strictEqual(estFavori(db, 'https://example.com/a'), false)
  strictEqual(retirerFavori(db, 1), false)
})

test('la migration 7 garde les favoris d\'une base au schéma 6, à la racine', () => {
  const db = new DatabaseSync(':memory:')
  appliquerMigrations(db, MIGRATIONS.slice(0, 6))
  db.prepare('INSERT INTO favori (url, titre, date) VALUES (?, ?, ?)').run('https://a.fr/', 'A', 1)
  appliquerMigrations(db, MIGRATIONS)
  deepStrictEqual(listerFavoris(db), { dossiers: [], favoris: [{ id: 1, url: 'https://a.fr/', titre: 'A', dossier: null }] })
})

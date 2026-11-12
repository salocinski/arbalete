import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import type { Telechargement } from '../../shared/telechargements.ts'
import { ouvrirBase } from './base.ts'
import { apresArret, creerTelechargement, dernierId, lireTelechargements, majTelechargement, retirerTelechargement } from './telechargements.ts'

// Tests unitaires de l'historique des téléchargements (ARB-55).

const exemple = (id: number, champs: Partial<Telechargement> = {}): Telechargement => ({
  id, url: `https://example.com/${id}.zip`, nom: `${id}.zip`, chemin: `C:\\Downloads\\${id}.zip`,
  total: 100, recu: 0, etat: 'en-cours', date: 1000 + id, ...champs
})

test('un téléchargement créé puis mis à jour est relu, le plus récent en premier', () => {
  const db = ouvrirBase(':memory:')
  creerTelechargement(db, exemple(1))
  creerTelechargement(db, exemple(2))
  majTelechargement(db, 1, { recu: 100, total: 100, etat: 'termine' })
  deepStrictEqual(lireTelechargements(db).map((t) => [t.id, t.recu, t.etat]), [[2, 0, 'en-cours'], [1, 100, 'termine']])
})

test('un état inconnu en base est relu comme interrompu', () => {
  const db = ouvrirBase(':memory:')
  creerTelechargement(db, exemple(1))
  db.exec('PRAGMA ignore_check_constraints = ON')
  db.exec("UPDATE telechargement SET etat = 'bizarre'")
  strictEqual(lireTelechargements(db)[0].etat, 'interrompu')
})

test('l’historique refuse un état hors liste', () => {
  const db = ouvrirBase(':memory:')
  let refus = false
  try {
    creerTelechargement(db, exemple(1, { etat: 'bizarre' as never }))
  } catch {
    refus = true
  }
  strictEqual(refus, true)
})

test('retirer une ligne garde les téléchargements actifs', () => {
  const db = ouvrirBase(':memory:')
  creerTelechargement(db, exemple(1, { etat: 'en-cours' }))
  creerTelechargement(db, exemple(2, { etat: 'en-pause' }))
  creerTelechargement(db, exemple(3, { etat: 'termine' }))
  creerTelechargement(db, exemple(4, { etat: 'annule' }))
  for (const id of [1, 2, 3, 4]) retirerTelechargement(db, id)
  deepStrictEqual(lireTelechargements(db).map((t) => t.id), [2, 1])
})

test('après un arrêt, un téléchargement actif devient interrompu et le plus ancien terminé est oublié', () => {
  const db = ouvrirBase(':memory:')
  creerTelechargement(db, exemple(1, { etat: 'termine' }))
  creerTelechargement(db, exemple(2, { etat: 'en-cours' }))
  creerTelechargement(db, exemple(3, { etat: 'en-pause' }))
  apresArret(db, 2)
  deepStrictEqual(lireTelechargements(db).map((t) => [t.id, t.etat]), [[3, 'interrompu'], [2, 'interrompu']])
})

// Value: protects=dernierId donne le plus grand id (0 si vide); fails_when=la requête ignore une ligne ou renvoie null; why_new=seul charger() le lisait, par l'historique complet; seam=none; no_claim=une table énorme.
test('dernierId donne le plus grand id de l’historique, 0 s’il est vide', () => {
  const db = ouvrirBase(':memory:')
  strictEqual(dernierId(db), 0)
  creerTelechargement(db, exemple(7))
  creerTelechargement(db, exemple(3))
  strictEqual(dernierId(db), 7)
})

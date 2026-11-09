import { deepEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { ouvrirBase } from './base.ts'
import { ecrireBarre, ecrirePreference, ecrireTheme, lireBarre, lirePreference, lireTheme } from './preferences.ts'
import { noterFermetureNormale, noterOuverture } from './fermeture.ts'

// Tests unitaires des préférences (ARB-59).

test('sans choix enregistré, le thème est « system »', () => {
  strictEqual(lireTheme(ouvrirBase(':memory:')), 'system')
})

test('le thème choisi est relu, et le dernier choix l’emporte', () => {
  const db = ouvrirBase(':memory:')
  ecrireTheme(db, 'dark')
  strictEqual(lireTheme(db), 'dark')
  ecrireTheme(db, 'light')
  strictEqual(lireTheme(db), 'light')
  ecrireTheme(db, 'system')
  strictEqual(lireTheme(db), 'system')
})

test('une valeur inconnue en base donne « system »', () => {
  const db = ouvrirBase(':memory:')
  for (const valeur of ['', 'sepia', 'DARK', '{"theme":"dark"}']) {
    ecrirePreference(db, 'theme', valeur)
    strictEqual(lireTheme(db), 'system', valeur)
  }
})

test('sans choix enregistré, la barre est masquée, étendue à 252 px', () => {
  deepEqual(lireBarre(ouvrirBase(':memory:')), { open: false, pinned: false, compact: false, width: 252 })
})

test('mode et largeur de la barre sont relus ; épinglée, elle démarre ouverte', () => {
  const db = ouvrirBase(':memory:')
  ecrireBarre(db, { open: true, pinned: true, compact: true, width: 320 })
  deepEqual(lireBarre(db), { open: true, pinned: true, compact: true, width: 320 })
  ecrireBarre(db, { open: false, pinned: false, compact: true, width: 252 })
  deepEqual(lireBarre(db), { open: false, pinned: false, compact: true, width: 252 })
})

test('une largeur illisible en base est bornée ou remplacée par 252', () => {
  const db = ouvrirBase(':memory:')
  for (const [valeur, attendu] of [['10', 200], ['9999', 400], ['large', 252], ['', 200]] as const) {
    ecrirePreference(db, 'barre.largeur', valeur)
    strictEqual(lireBarre(db).width, attendu, valeur)
  }
})

test('les préférences ne se mêlent pas aux notes de l’état de l’application', () => {
  const db = ouvrirBase(':memory:')
  ecrirePreference(db, 'theme', 'dark')
  strictEqual(noterOuverture(db), false)
  noterFermetureNormale(db)
  strictEqual(lirePreference(db, 'theme'), 'dark')
  strictEqual(lirePreference(db, 'inconnue'), undefined)
})

import { strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { ouvrirBase } from './base.ts'
import { ecrirePreference, ecrireTheme, lirePreference, lireTheme } from './preferences.ts'
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

test('les préférences ne se mêlent pas aux notes de l’état de l’application', () => {
  const db = ouvrirBase(':memory:')
  ecrirePreference(db, 'theme', 'dark')
  strictEqual(noterOuverture(db), false)
  noterFermetureNormale(db)
  strictEqual(lirePreference(db, 'theme'), 'dark')
  strictEqual(lirePreference(db, 'inconnue'), undefined)
})

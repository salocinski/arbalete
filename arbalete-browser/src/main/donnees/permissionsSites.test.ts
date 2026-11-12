import { strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { ouvrirBase } from './base.ts'
import { ecrirePreference } from './preferences.ts'
import { ecrirePermissionSite, lirePermissionSite } from './permissionsSites.ts'

// Tests unitaires des permissions mémorisées par site (ARB-15).

test('sans choix enregistré, rien n’est lu', () => {
  strictEqual(lirePermissionSite(ouvrirBase(':memory:'), 'exemple.fr', 'micro'), undefined)
})

test('le choix est relu par site et par permission, sans déborder', () => {
  const db = ouvrirBase(':memory:')
  ecrirePermissionSite(db, 'exemple.fr', 'micro', 'autoriser')
  ecrirePermissionSite(db, 'exemple.fr', 'camera', 'refuser')
  strictEqual(lirePermissionSite(db, 'exemple.fr', 'micro'), 'autoriser')
  strictEqual(lirePermissionSite(db, 'exemple.fr', 'camera'), 'refuser')
  strictEqual(lirePermissionSite(db, 'autre.fr', 'micro'), undefined)
  ecrirePermissionSite(db, 'exemple.fr', 'micro', 'refuser')
  strictEqual(lirePermissionSite(db, 'exemple.fr', 'micro'), 'refuser')
})

test('une valeur aberrante en base est ignorée', () => {
  const db = ouvrirBase(':memory:')
  ecrirePreference(db, 'permission.exemple.fr.micro', 'peut-etre')
  strictEqual(lirePermissionSite(db, 'exemple.fr', 'micro'), undefined)
})

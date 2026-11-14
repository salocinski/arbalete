import { strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { ouvrirBase } from './base.ts'
import { ecrirePreference } from './preferences.ts'
import { autoriserPopups, popupsAutorises } from './popupsSites.ts'

// Tests unitaires des sites autorisés à ouvrir des pop-ups sans geste (ARB-108).

test('sans choix enregistré, les pop-ups restent bloquées', () => {
  strictEqual(popupsAutorises(ouvrirBase(':memory:'), 'exemple.fr'), false)
})

test('l’autorisation est relue par hôte, sans déborder', () => {
  const db = ouvrirBase(':memory:')
  autoriserPopups(db, 'exemple.fr')
  autoriserPopups(db, 'exemple.fr')
  strictEqual(popupsAutorises(db, 'exemple.fr'), true)
  strictEqual(popupsAutorises(db, 'autre.fr'), false)
})

test('une valeur aberrante en base est ignorée', () => {
  const db = ouvrirBase(':memory:')
  ecrirePreference(db, 'popup.exemple.fr', 'peut-etre')
  strictEqual(popupsAutorises(db, 'exemple.fr'), false)
})

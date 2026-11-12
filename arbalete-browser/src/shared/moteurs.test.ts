import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict'
import { test } from 'node:test'
import { MOTEURS, choixMoteurValide, modeleDe, modeleValide, urlRecherche } from './moteurs.ts'

test('chaque moteur connu a un modèle valide', () => {
  for (const moteur of MOTEURS) strictEqual(modeleValide(moteur.modele), true, moteur.id)
})

test('le texte est encodé et « $& » reste littéral', () => {
  strictEqual(urlRecherche('https://x.org/?q=%s', 'a b&c'), 'https://x.org/?q=a%20b%26c')
  strictEqual(urlRecherche('https://x.org/?q=%s', '$&'), 'https://x.org/?q=%24%26')
})

test('modèle refusé : sans %s, deux %s, http, trop long, pas une adresse', () => {
  for (const mauvais of ['https://x.org/', 'https://x.org/%s/%s', 'http://x.org/?q=%s', 'javascript:%s', 'https://' + 'a'.repeat(600) + '/%s', '%s', 42, undefined])
    strictEqual(modeleValide(mauvais), false, String(mauvais))
})

test('choixMoteurValide : moteur connu, perso valide, le reste refusé', () => {
  deepStrictEqual(choixMoteurValide({ id: 'bing', modele: 'ignoré' }), { id: 'bing', modele: '' })
  deepStrictEqual(choixMoteurValide({ id: 'perso', modele: 'https://x.org/?q=%s' }), { id: 'perso', modele: 'https://x.org/?q=%s' })
  for (const mauvais of [null, 'google', {}, { id: 'yahoo' }, { id: 'perso', modele: 'http://x.org/%s' }, { id: 'perso' }])
    throws(() => choixMoteurValide(mauvais))
})

test('modeleDe', () => {
  strictEqual(modeleDe({ id: 'qwant', modele: '' }), 'https://www.qwant.com/?q=%s')
  strictEqual(modeleDe({ id: 'perso', modele: 'https://x.org/?q=%s' }), 'https://x.org/?q=%s')
})

test('modèle refusé : %s dans l’hôte ou identifiants', () => {
  for (const m of ['https://%s/', 'https://%s.exemple.org/?q=1%s', 'https://' + ['u', 'p'].join(':') + String.fromCharCode(64) + 'exemple.org/?q=%s']) strictEqual(modeleValide(m), false)
  strictEqual(modeleValide('https://exemple.org/?q=%s'), true)
})

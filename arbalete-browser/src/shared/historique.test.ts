import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { debutEffacement, grouperParJour, libelleJour } from './historique.ts'

// Tests unitaires du regroupement par jour du panneau Historique (ARB-52).

const heure = (annee: number, mois: number, jour: number, h = 12) => new Date(annee, mois - 1, jour, h).getTime()
const maintenant = heure(2026, 11, 12, 9)

test('aujourd’hui et hier portent leur nom, minuit compris', () => {
  strictEqual(libelleJour(heure(2026, 11, 12, 0), maintenant), 'Aujourd’hui')
  strictEqual(libelleJour(heure(2026, 11, 11, 23), maintenant), 'Hier')
})

test('un autre jour s’écrit en toutes lettres, avec l’année hors de l’année en cours', () => {
  strictEqual(libelleJour(heure(2026, 11, 3), maintenant), 'mardi 3 novembre')
  strictEqual(libelleJour(heure(2025, 12, 31), maintenant), 'mercredi 31 décembre 2025')
})

test('les visites se regroupent par jour dans l’ordre reçu', () => {
  const visite = (url: string, date: number) => ({ url, titre: '', date })
  const a = visite('https://a.test/', heure(2026, 11, 12, 8))
  const b = visite('https://b.test/', heure(2026, 11, 12, 7))
  const c = visite('https://c.test/', heure(2026, 11, 11, 20))
  deepStrictEqual(grouperParJour([a, b, c], maintenant), [
    { jour: 'Aujourd’hui', visites: [a, b] },
    { jour: 'Hier', visites: [c] }
  ])
  deepStrictEqual(grouperParJour([], maintenant), [])
})

test('un jour dans le futur s’écrit en toutes lettres, jamais « Hier »', () => {
  strictEqual(libelleJour(heure(2026, 11, 14), maintenant), 'samedi 14 novembre')
})

test('le début de l’effacement remonte d’une heure, d’un jour, d’une semaine, ou à zéro', () => {
  strictEqual(debutEffacement('heure', 10_000_000), 10_000_000 - 3_600_000)
  strictEqual(debutEffacement('jour', 100_000_000), 100_000_000 - 86_400_000)
  strictEqual(debutEffacement('semaine', 1_000_000_000), 1_000_000_000 - 7 * 86_400_000)
  strictEqual(debutEffacement('tout', 1_000_000_000), 0)
})

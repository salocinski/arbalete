import { strictEqual } from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
import { creerEcritureDifferee } from './ecritureDifferee.ts'

// Tests unitaires de l'écriture différée de la session (ARB-44), sur une horloge simulée.

beforeEach(() => {
  mock.timers.reset()
  mock.timers.enable({ apis: ['setTimeout', 'Date'] })
})

function compteur() {
  const appels = { n: 0 }
  return { appels, ecrire: () => { appels.n++ } }
}

test('des demandes rapprochées ne donnent qu’une écriture, après le délai', () => {
  const { appels, ecrire } = compteur()
  const ecriture = creerEcritureDifferee(ecrire, 1000, 5000)
  ecriture.demander()
  mock.timers.tick(600)
  ecriture.demander()
  mock.timers.tick(600)
  ecriture.demander()
  strictEqual(appels.n, 0)
  mock.timers.tick(999)
  strictEqual(appels.n, 0)
  mock.timers.tick(1)
  strictEqual(appels.n, 1)
  mock.timers.tick(10_000)
  strictEqual(appels.n, 1)
})

test('des demandes sans pause écrivent au plus tard après l’attente maximale', () => {
  const { appels, ecrire } = compteur()
  const ecriture = creerEcritureDifferee(ecrire, 1000, 5000)
  for (let i = 0; i < 10; i++) {
    ecriture.demander()
    mock.timers.tick(500)
  }
  // Première demande à 0, écriture à 5000 ; les demandes suivantes repartent d'une attente neuve.
  strictEqual(appels.n, 1)
})

test('vider écrit tout de suite ce qui attend, une seule fois', () => {
  const { appels, ecrire } = compteur()
  const ecriture = creerEcritureDifferee(ecrire, 1000, 5000)
  ecriture.demander()
  ecriture.vider()
  strictEqual(appels.n, 1)
  mock.timers.tick(10_000)
  strictEqual(appels.n, 1)
})

test('vider sans demande en attente n’écrit rien', () => {
  const { appels, ecrire } = compteur()
  const ecriture = creerEcritureDifferee(ecrire, 1000, 5000)
  ecriture.vider()
  ecriture.demander()
  mock.timers.tick(1000)
  ecriture.vider()
  strictEqual(appels.n, 1)
})

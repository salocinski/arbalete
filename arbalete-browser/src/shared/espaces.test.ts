import { deepEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { COULEURS_ESPACE, ESPACES_INITIAUX, champsNouvelEspace, ordreApresDeplacement, type Espace } from './espaces.ts'

// Tests unitaires des fonctions pures de gestion des espaces (ARB-62).

const espaces = (n: number): Espace[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, nom: `E${i}`, couleur: 'personal', icone: '◆' }))

test('un nouvel espace prend la couleur et l’icône suivantes de la liste, en boucle', () => {
  const trois = champsNouvelEspace(espaces(ESPACES_INITIAUX.length), 'Travail')
  strictEqual(trois.nom, 'Travail')
  strictEqual(trois.couleur, COULEURS_ESPACE[ESPACES_INITIAUX.length % COULEURS_ESPACE.length])
  // Au-delà de la dernière couleur, la liste recommence : la couleur reste un token connu.
  for (const n of [0, 1, 4, 5, 17]) strictEqual(COULEURS_ESPACE.includes(champsNouvelEspace(espaces(n), 'x').couleur), true, String(n))
  strictEqual(champsNouvelEspace(espaces(4), 'x').couleur, COULEURS_ESPACE[0])
})

test('décaler un espace échange sa place avec son voisin et s’arrête aux bords', () => {
  deepEqual(ordreApresDeplacement([1, 2, 3], 2, -1), [2, 1, 3])
  deepEqual(ordreApresDeplacement([1, 2, 3], 2, 1), [1, 3, 2])
  deepEqual(ordreApresDeplacement([1, 2, 3], 1, -1), [1, 2, 3])
  deepEqual(ordreApresDeplacement([1, 2, 3], 3, 1), [1, 2, 3])
  deepEqual(ordreApresDeplacement([1, 2, 3], 99, 1), [1, 2, 3])
})

test('décaler ne modifie pas la liste reçue', () => {
  const ids = [1, 2, 3]
  ordreApresDeplacement(ids, 2, 1)
  deepEqual(ids, [1, 2, 3])
})

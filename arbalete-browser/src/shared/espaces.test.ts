import { deepEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { COULEURS_ESPACE, ESPACES_INITIAUX, NOMS_COULEUR_ESPACE, champsNouvelEspace, ordreApresDeplacement, type Espace } from './espaces.ts'

// Tests unitaires des fonctions pures de gestion des espaces (ARB-62).

const espaces = (n: number): Espace[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, nom: `E${i}`, couleur: 'personal', icone: '◆' }))

test('un nouvel espace prend la couleur et l’icône suivantes de la liste, en boucle', () => {
  const trois = champsNouvelEspace(espaces(ESPACES_INITIAUX.length), 'Travail')
  strictEqual(trois.nom, 'Travail')
  strictEqual(trois.couleur, COULEURS_ESPACE[ESPACES_INITIAUX.length % COULEURS_ESPACE.length])
  // Au-delà de la dernière couleur, la liste recommence : la couleur reste un token connu.
  for (const n of [0, 1, 4, 14, 17]) strictEqual(COULEURS_ESPACE.includes(champsNouvelEspace(espaces(n), 'x').couleur), true, String(n))
  strictEqual(champsNouvelEspace(espaces(COULEURS_ESPACE.length), 'x').couleur, COULEURS_ESPACE[0])
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

test('la palette de choix compte 14 couleurs distinctes, chacune avec son nom affiché (ARB-134)', () => {
  strictEqual(COULEURS_ESPACE.length, 14)
  strictEqual(new Set(COULEURS_ESPACE).size, 14)
  deepEqual(Object.keys(NOMS_COULEUR_ESPACE).sort(), [...COULEURS_ESPACE].sort())
  strictEqual(new Set(Object.values(NOMS_COULEUR_ESPACE)).size, 14)
  // Les quatre couleurs du référentiel gardent leur nom : les espaces déjà enregistrés restent valides (aucune migration).
  deepEqual(COULEURS_ESPACE.slice(0, 4), ['personal', 'development', 'work', 'research'])
})

import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict'
import { test } from 'node:test'
import { HAUTEUR_RECHERCHE, LARGEUR_RECHERCHE, LONGUEUR_RECHERCHE_MAX, placerRecherche, texteRecherche } from './recherche.ts'

// Recherche dans la page (ARB-70) : placement de la vue et texte accepté.

test('la vue se place en haut à droite du cadre de page', () => {
  deepStrictEqual(placerRecherche({ x: 260, y: 48, width: 1000, height: 700 }),
    { x: 260 + 1000 - 8 - LARGEUR_RECHERCHE, y: 56, width: LARGEUR_RECHERCHE, height: HAUTEUR_RECHERCHE })
})

test('une page étroite rétrécit la vue sans la faire déborder, jamais en dessous de zéro', () => {
  const etroite = placerRecherche({ x: 8, y: 48, width: 200, height: 500 })
  strictEqual(etroite.width, 184)
  strictEqual(etroite.x + etroite.width, 8 + 200 - 8)
  strictEqual(placerRecherche({ x: 0, y: 0, width: 10, height: 10 }).width, 0)
})

test('le texte est une chaîne tronquée ; vide, il reste vide ; autre chose est refusé', () => {
  strictEqual(texteRecherche('abc'), 'abc')
  strictEqual(texteRecherche(''), '')
  strictEqual(texteRecherche('x'.repeat(LONGUEUR_RECHERCHE_MAX + 50)).length, LONGUEUR_RECHERCHE_MAX)
  throws(() => texteRecherche(42))
  throws(() => texteRecherche(undefined))
})

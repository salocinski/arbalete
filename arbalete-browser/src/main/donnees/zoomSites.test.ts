import { strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { ouvrirBase } from './base.ts'
import { ecrirePreference } from './preferences.ts'
import { ecrireZoomSite, hoteZoom, lireZoomSite } from './zoomSites.ts'

// Tests unitaires du zoom par site (ARB-71).

test('l’hôte vient d’une adresse web seulement, en minuscules', () => {
  strictEqual(hoteZoom('https://Exemple.FR/page?q=1#a'), 'exemple.fr')
  strictEqual(hoteZoom('http://127.0.0.1:8080/'), '127.0.0.1')
  strictEqual(hoteZoom(`https://${'a'.repeat(254)}.fr/`), undefined)
  for (const url of ['about:blank', 'file:///C:/a.html', 'data:text/html,x', 'javascript:1', 'pas une adresse', '']) {
    strictEqual(hoteZoom(url), undefined, url)
  }
})

test('sans zoom enregistré, le facteur est 1', () => {
  strictEqual(lireZoomSite(ouvrirBase(':memory:'), 'exemple.fr'), 1)
})

test('le zoom est relu par site, sans déborder sur un autre', () => {
  const db = ouvrirBase(':memory:')
  ecrireZoomSite(db, 'exemple.fr', 1.5)
  ecrireZoomSite(db, 'autre.fr', 0.75)
  strictEqual(lireZoomSite(db, 'exemple.fr'), 1.5)
  strictEqual(lireZoomSite(db, 'autre.fr'), 0.75)
  strictEqual(lireZoomSite(db, 'troisieme.fr'), 1)
})

test('revenir à 100 % supprime la ligne', () => {
  const db = ouvrirBase(':memory:')
  ecrireZoomSite(db, 'exemple.fr', 2)
  ecrireZoomSite(db, 'exemple.fr', 1)
  strictEqual(lireZoomSite(db, 'exemple.fr'), 1)
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM etat WHERE cle LIKE 'pref.zoom.%'").get() as { n: number }
  strictEqual(n, 0)
})

// Value: protects=la tolérance de 0,5 % autour de 100 % et les bornes 25 %-500 % du zoom mémorisé;
//   fails_when=le seuil 0.005 passe à une autre valeur, ou FACTEUR_MIN/FACTEUR_MAX perdent leur égalité (< au lieu de <=);
//   why_new=les tests voisins n'essaient que 1, 2, 1,5 et 0,75; seam=none; no_claim=none beyond protects
test('un facteur à moins de 0,5 % de 100 % supprime la ligne, au-delà il est gardé', () => {
  const db = ouvrirBase(':memory:')
  ecrireZoomSite(db, 'exemple.fr', 1.004)
  strictEqual(lireZoomSite(db, 'exemple.fr'), 1)
  ecrireZoomSite(db, 'exemple.fr', 1.006)
  strictEqual(lireZoomSite(db, 'exemple.fr'), 1.006)
})

test('les bornes 25 % et 500 % sont acceptées', () => {
  const db = ouvrirBase(':memory:')
  ecrireZoomSite(db, 'a.fr', 0.25)
  ecrireZoomSite(db, 'b.fr', 5)
  strictEqual(lireZoomSite(db, 'a.fr'), 0.25)
  strictEqual(lireZoomSite(db, 'b.fr'), 5)
})

test('une valeur aberrante en base donne 1', () => {
  const db = ouvrirBase(':memory:')
  for (const valeur of ['', 'abc', '0', '-2', '9', 'Infinity']) {
    ecrirePreference(db, 'zoom.exemple.fr', valeur)
    strictEqual(lireZoomSite(db, 'exemple.fr'), 1, valeur)
  }
})

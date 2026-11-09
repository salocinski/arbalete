import { test } from 'node:test'
import { deepEqual, equal, throws } from 'node:assert/strict'
import { estAboutBlank, retourPermis } from './aboutBlank.ts'
import { borner } from './bornes.ts'
import { lireUrlDev } from './urlDev.ts'

// Value: protects=bornage du rectangle reçu par browser:set-content-bounds (ARB-104) : entiers, dans la fenêtre;
//   fails_when=une valeur aberrante (1e300, NaN, négative) atteint setBounds, ou un rectangle valide est déformé;
//   why_new=le canal n'était testé qu'avec un rectangle valide (C12, C14); seam=none;
//   no_claim=ne couvre ni setBounds d'Electron, ni le placement réel de la vue (C12).
test('borner garde un rectangle valide, arrondit et borne les valeurs aberrantes', () => {
  deepEqual(borner({ x: 8, y: 48, width: 884, height: 544 }, 900, 600), { x: 8, y: 48, width: 884, height: 544 })
  deepEqual(borner({ x: 8.4, y: 47.6, width: 100.5, height: 10.2 }, 900, 600), { x: 8, y: 48, width: 101, height: 10 })
  deepEqual(borner({ x: -5, y: -1, width: -10, height: 20 }, 900, 600), { x: 0, y: 0, width: 0, height: 20 })
  deepEqual(borner({ x: 8, y: 48, width: 1e300, height: 1e300 }, 900, 600), { x: 8, y: 48, width: 892, height: 552 })
  deepEqual(borner({ x: 1e300, y: 1e300, width: 10, height: 10 }, 900, 600), { x: 900, y: 600, width: 0, height: 0 })
  for (const brut of [undefined, {}, { x: NaN, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: Infinity, height: 1 }]) {
    equal(borner(brut, 900, 600), null)
  }
})

// Value: protects=lecture unique de ELECTRON_RENDERER_URL (ARB-105) : absente ou empaquetée = pas d'URL de développement,
//   malformée = erreur claire au démarrage; fails_when=une app empaquetée suit la variable, ou une URL invalide passe;
//   why_new=aucun test ne couvrait la variable; seam=none; no_claim=ne couvre pas le chargement de l'interface (C18).
test('lireUrlDev ignore la variable hors développement et refuse une adresse malformée', () => {
  equal(lireUrlDev(undefined, false), undefined)
  equal(lireUrlDev('', false), undefined)
  equal(lireUrlDev('http://localhost:5173', true), undefined)
  equal(lireUrlDev('http://localhost:5173', false)?.origin, 'http://localhost:5173')
  throws(() => lireUrlDev('pas une adresse', false), /ELECTRON_RENDERER_URL invalide/)
  for (const opaque of ['file:///C:/x/index.html', 'data:text/html,x', 'about:blank']) {
    throws(() => lireUrlDev(opaque, false), /ELECTRON_RENDERER_URL invalide/)
  }
})

// Value: protects=détection d'about:blank et plafond des retours en arrière d'ARB-97 : les variantes avec ? ou # sont
//   reconnues, les adresses voisines non, et un onglet ne revient pas plus de RETOURS_BLANC_MAX fois par fenêtre;
//   fails_when=about:blank#x échappe à l'annulation, about:blanket est annulé à tort, ou le plafond ne borne plus;
//   why_new=C6 ne couvre qu'un lien about:blank exact et un seul retour; seam=none;
//   no_claim=ne reproduit pas de boucle réelle (aucune n'a été obtenue) ni le moment où Electron émet les événements.
test('estAboutBlank reconnaît les variantes et retourPermis plafonne les retours', () => {
  for (const url of ['about:blank', 'about:blank#x', 'about:blank?x=1', 'ABOUT:BLANK']) equal(estAboutBlank(url), true, url)
  for (const url of ['about:blanket', 'about:srcdoc', 'https://a.test/about:blank', 'http://127.0.0.1/', '']) equal(estAboutBlank(url), false, url)
  const premier = retourPermis([], 1_000)
  deepEqual(premier, [1_000])
  const second = retourPermis(premier!, 2_000)
  deepEqual(second, [1_000, 2_000])
  equal(retourPermis(second!, 3_000), null)
  // La fenêtre glisse : le plus ancien retour sort au bout de 60 s.
  deepEqual(retourPermis(second!, 61_000), [2_000, 61_000])
})

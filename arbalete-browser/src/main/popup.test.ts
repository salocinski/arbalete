import { test } from 'node:test'
import { deepEqual, equal } from 'node:assert/strict'
import { estGeste, estPopup, gesteRecent, placerAvisPopup, tailleDePopup } from './popup.ts'

// Value: protects=quelles ouvertures deviennent une fenêtre fille (ARB-16) et la taille qu'une page peut demander;
//   fails_when=un target=_blank ou un window.open sans dimensions devient une fenêtre, ou une taille aberrante (0, 1e9) passe;
//   why_new=ARB-102 testait seulement les onglets (C20 à C27); seam=none;
//   no_claim=ne couvre ni la disposition réelle de Chromium (smoke) ni window.opener.
test('seul un window.open avec fenêtre demandée est une pop-up', () => {
  equal(estPopup('new-window'), true)
  for (const disposition of ['foreground-tab', 'background-tab', 'other', '']) equal(estPopup(disposition), false)
})

test('une ouverture n\'est permise que peu après un geste de l\'utilisateur', () => {
  equal(gesteRecent(undefined, 1000), false)
  equal(gesteRecent(1000, 1000), true)
  equal(gesteRecent(1000, 6000), true)
  equal(gesteRecent(1000, 6001), false)
  equal(gesteRecent(5000, 1000), false)
  equal(estGeste('mouseDown'), true)
  equal(estGeste('keyDown'), true)
  for (const type of ['mouseMove', 'mouseWheel', 'mouseUp', '']) equal(estGeste(type), false)
})

test('l’avis se pose en bas à gauche de la page, sans la dépasser', () => {
  deepEqual(placerAvisPopup({ x: 8, y: 48, width: 884, height: 544 }), { x: 16, y: 540, width: 320, height: 44 })
  deepEqual(placerAvisPopup({ x: 0, y: 0, width: 200, height: 100 }), { x: 8, y: 48, width: 184, height: 44 })
  equal(placerAvisPopup({ x: 0, y: 0, width: 10, height: 100 }).width, 0)
})

test('tailleDePopup lit width et height, bornés, avec une taille par défaut', () => {
  deepEqual(tailleDePopup('width=400,height=300'), { width: 400, height: 300 })
  deepEqual(tailleDePopup('popup, Width = 450 , HEIGHT=550'), { width: 450, height: 550 })
  deepEqual(tailleDePopup(''), { width: 500, height: 600 })
  deepEqual(tailleDePopup('width=1,height=99999'), { width: 200, height: 1200 })
  deepEqual(tailleDePopup('innerwidth=300,width=abc'), { width: 500, height: 600 })
})

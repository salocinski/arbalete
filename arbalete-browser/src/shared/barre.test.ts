import { deepEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { ETAT_BARRE_INITIAL, LARGEUR_BANDE, LARGEUR_COMPACTE, borneLargeurBarre, largeurApresTouche, largeurBarre, transitionBarre } from './barre.ts'

// Tests unitaires de la barre latérale en trois états (ARB-123).

test('la largeur est un entier borné à 200-400, 252 si ce n’est pas un nombre', () => {
  strictEqual(borneLargeurBarre(300.4), 300)
  strictEqual(borneLargeurBarre(1), 200)
  strictEqual(borneLargeurBarre(1e9), 400)
  for (const valeur of [NaN, Infinity, '300', null, undefined, {}]) strictEqual(borneLargeurBarre(valeur), 252, String(valeur))
})

test('la poignée : flèches de 16 px bornées, Début 200, Fin 400, autre touche ignorée', () => {
  strictEqual(largeurApresTouche('ArrowRight', 252), 268)
  strictEqual(largeurApresTouche('ArrowLeft', 252), 236)
  strictEqual(largeurApresTouche('ArrowLeft', 205), 200)
  strictEqual(largeurApresTouche('ArrowRight', 395), 400)
  strictEqual(largeurApresTouche('Home', 300), 200)
  strictEqual(largeurApresTouche('End', 300), 400)
  strictEqual(largeurApresTouche('Tab', 300), undefined)
})

test('masquée par défaut : le survol ouvre, la sortie referme', () => {
  const ouverte = transitionBarre(ETAT_BARRE_INITIAL, 'open')
  deepEqual(ouverte, { ...ETAT_BARRE_INITIAL, open: true })
  deepEqual(transitionBarre(ouverte, 'hide'), ETAT_BARRE_INITIAL)
})

test('épinglée, la barre ne se masque pas ; désépingler la referme', () => {
  const epinglee = transitionBarre(ETAT_BARRE_INITIAL, 'toggle-pin')
  deepEqual(epinglee, { ...ETAT_BARRE_INITIAL, open: true, pinned: true })
  strictEqual(transitionBarre(epinglee, 'hide'), epinglee)
  deepEqual(transitionBarre(epinglee, 'toggle-pin'), ETAT_BARRE_INITIAL)
})

test('le mode compact ne s’applique qu’à une barre épinglée et survit au masquage', () => {
  strictEqual(transitionBarre(ETAT_BARRE_INITIAL, 'toggle-compact'), ETAT_BARRE_INITIAL)
  const compacte = transitionBarre(transitionBarre(ETAT_BARRE_INITIAL, 'toggle-pin'), 'toggle-compact')
  strictEqual(compacte.compact, true)
  const masquee = transitionBarre(compacte, 'toggle-pin')
  strictEqual(masquee.compact, true)
  strictEqual(largeurBarre(transitionBarre(masquee, 'open')), ETAT_BARRE_INITIAL.width) // rappelée au survol : étendue
  strictEqual(largeurBarre(transitionBarre(masquee, 'toggle-pin')), LARGEUR_COMPACTE)
})

test('largeur de la vue : bande masquée, largeur réglée étendue, 68 px compacte', () => {
  strictEqual(largeurBarre(ETAT_BARRE_INITIAL), LARGEUR_BANDE)
  strictEqual(largeurBarre({ open: true, pinned: true, compact: false, width: 320 }), 320)
  strictEqual(largeurBarre({ open: true, pinned: true, compact: true, width: 320 }), LARGEUR_COMPACTE)
})

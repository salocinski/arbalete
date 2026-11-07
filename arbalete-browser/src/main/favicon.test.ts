import { test } from 'node:test'
import { deepEqual } from 'node:assert/strict'
import { faviconAcceptable } from './favicon.ts'

// Value: protects=filtre des favicons transmis à l'interface (ARB-35) : https et images data: seulement, bornés;
//   fails_when=un favicon http, javascript:, data:text/html ou démesuré passe, ou le premier acceptable n'est plus choisi;
//   why_new=aucun test ne couvrait le favicon; seam=none; no_claim=ne couvre pas le rendu dans l'onglet (C50).
test('faviconAcceptable ne garde que https et les images data: de taille raisonnable', () => {
  deepEqual(faviconAcceptable([]), undefined)
  deepEqual(faviconAcceptable(['http://a.test/i.ico', 'javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///c:/i.ico']), undefined)
  deepEqual(faviconAcceptable(['http://a.test/i.ico', 'https://a.test/i.png', 'https://b.test/j.png']), 'https://a.test/i.png')
  deepEqual(faviconAcceptable(['data:image/png;base64,AAAA']), 'data:image/png;base64,AAAA')
  deepEqual(faviconAcceptable(['data:image/svg+xml,<svg/>']), undefined)
  deepEqual(faviconAcceptable([`data:image/png;base64,${'A'.repeat(40_000)}`]), undefined)
})

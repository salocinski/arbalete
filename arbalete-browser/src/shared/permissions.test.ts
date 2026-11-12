import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { decisionPermissions, permissionsDemandees, phraseDemande } from './permissions.ts'

// Tests unitaires des permissions de site (ARB-15).

test('les permissions gérées sont reconnues, les autres refusées', () => {
  deepStrictEqual(permissionsDemandees('fullscreen'), ['plein-ecran'])
  deepStrictEqual(permissionsDemandees('notifications'), ['notifications'])
  deepStrictEqual(permissionsDemandees('geolocation'), ['geolocalisation'])
  for (const autre of ['clipboard-read', 'hid', 'usb', 'openExternal', 'midiSysex', '']) strictEqual(permissionsDemandees(autre), null, autre)
})

test('media donne caméra et/ou micro selon les types demandés', () => {
  deepStrictEqual(permissionsDemandees('media', { mediaTypes: ['audio'] }), ['micro'])
  deepStrictEqual(permissionsDemandees('media', { mediaTypes: ['video'] }), ['camera'])
  deepStrictEqual(permissionsDemandees('media', { mediaTypes: ['video', 'audio'] }), ['camera', 'micro'])
  deepStrictEqual(permissionsDemandees('media', { mediaType: 'audio' }), ['micro'])
  deepStrictEqual(permissionsDemandees('media', { mediaType: 'unknown' }), ['camera', 'micro'])
  deepStrictEqual(permissionsDemandees('media'), ['camera', 'micro'])
})

test('le plein écran est accordé d’office, un refus enregistré le bloque', () => {
  strictEqual(decisionPermissions(['plein-ecran'], () => undefined), 'autoriser')
  strictEqual(decisionPermissions(['plein-ecran'], () => 'refuser'), 'refuser')
})

test('une permission inconnue du site est demandée, un choix enregistré est suivi', () => {
  strictEqual(decisionPermissions(['micro'], () => undefined), 'demander')
  strictEqual(decisionPermissions(['micro'], () => 'autoriser'), 'autoriser')
  strictEqual(decisionPermissions(['micro'], () => 'refuser'), 'refuser')
})

test('caméra et micro : un seul refus bloque, il faut les deux accords pour passer', () => {
  const choix = (c: Record<string, 'autoriser' | 'refuser'>) => (p: string) => c[p]
  strictEqual(decisionPermissions(['camera', 'micro'], choix({ camera: 'autoriser' })), 'demander')
  strictEqual(decisionPermissions(['camera', 'micro'], choix({ camera: 'autoriser', micro: 'refuser' })), 'refuser')
  strictEqual(decisionPermissions(['camera', 'micro'], choix({ camera: 'autoriser', micro: 'autoriser' })), 'autoriser')
})

test('la phrase de l’invite liste ce qui est demandé', () => {
  strictEqual(phraseDemande(['micro']), 'utiliser votre micro')
  strictEqual(phraseDemande(['camera', 'micro']), 'utiliser votre caméra et utiliser votre micro')
})

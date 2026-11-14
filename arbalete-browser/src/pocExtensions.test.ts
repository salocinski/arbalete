import { ok } from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Garde-fous du POC d'extensions (ARB-24, scripts/poc-extensions.mjs) : il reste hors de l'application (aucune
// extension chargée par Arbalète avant l'audit de sécurité ARB-95), son profil est jetable et ses extensions
// téléchargées ne sont jamais commitées. Lecture du texte, le POC lui-même se lance à la main sous Electron.
const racine = fileURLToPath(new URL('../..', import.meta.url))
const poc = readFileSync(racine + 'arbalete-browser/scripts/poc-extensions.mjs', 'utf8')

test('le POC travaille dans un profil jetable et sans await de plus haut niveau', () => {
  ok(poc.includes("app.setPath('userData', mkdtempSync("), 'profil sous %TEMP%, jamais celui de l’utilisateur')
  ok(!/^await /m.test(poc), 'un await de plus haut niveau empêche Electron d’émettre `ready` pour un main ESM')
})

test('les extensions téléchargées par le POC sont ignorées par Git', () => {
  ok(/^\.poc\/$/m.test(readFileSync(racine + '.gitignore', 'utf8')), '.poc/ attendu dans .gitignore')
})

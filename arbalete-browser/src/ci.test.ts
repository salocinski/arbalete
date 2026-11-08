import { ok, strictEqual } from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Garde-fous du workflow de CI (ARB-8, .github/workflows/ci.yml) : il reste en lecture seule, ses actions restent
// épinglées par empreinte de commit, et il lance toujours les contrôles que CLAUDE.md annonce. Lecture du texte, pas
// d'analyse YAML (aucune dépendance de plus) : les motifs visés sont des lignes entières.
// shortcut: motifs sur le texte du workflow, pas sur son arbre YAML ; à remplacer par un analyseur YAML si le workflow
// gagne des jobs ou des matrices.

const racine = fileURLToPath(new URL('../..', import.meta.url))
const ci = readFileSync(racine + '.github/workflows/ci.yml', 'utf8')
const lignes = ci.split('\n')

test('la CI ne demande que la lecture du dépôt et ne se déclenche pas sur pull_request_target', () => {
  ok(/^permissions:\s*\r?\n {2}contents: read\s*$/m.test(ci), 'permissions: contents: read attendu au niveau du workflow')
  ok(!/:\s*write\b/.test(ci), 'aucune permission en écriture')
  ok(!ci.includes('pull_request_target'), 'pull_request_target donnerait des secrets au code d’une PR externe')
})

test('chaque action est épinglée par une empreinte de commit complète', () => {
  const actions = lignes.filter((ligne) => /^\s*-?\s*uses:/.test(ligne))
  ok(actions.length > 0, 'le workflow utilise au moins une action')
  for (const ligne of actions) {
    ok(/uses:\s*[\w./-]+@[0-9a-f]{40}(\s|$)/.test(ligne), `action non épinglée : ${ligne.trim()}`)
  }
})

test('la CI tourne sur Windows, sur main et sur les PR, avec typecheck, tests unitaires et build', () => {
  ok(/runs-on: windows-latest/.test(ci))
  ok(/^ {2}push:\s*\r?\n {4}branches: \[main\]/m.test(ci), 'push sur main')
  ok(/^ {2}pull_request:/m.test(ci), 'pull_request')
  const commandes = lignes.filter((ligne) => /^\s*- run:/.test(ligne)).map((ligne) => ligne.replace(/^\s*- run:\s*/, '').trim())
  strictEqual(
    commandes.join(' | '),
    'npm ci | npx install-electron | npm run typecheck | npm run test:unit | npm run build'
  )
})

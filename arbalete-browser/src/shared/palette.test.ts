import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ACTIONS_PALETTE, construirePalette } from './palette.ts'

const onglets = [
  { id: 't1', titre: 'Google', url: 'https://www.google.com/', adresse: 'https://www.google.com/' },
  { id: 't2', titre: 'GitHub', url: 'https://github.com/', adresse: 'https://github.com/' }
]

test('« git » mène à l’onglet GitHub, en tête de liste', () => {
  const liste = construirePalette('git', onglets, [], [])
  assert.deepEqual(liste[0], { kind: 'onglet', titre: 'GitHub', detail: 'https://github.com/', cle: 't2' })
  assert.equal(liste.filter((e) => e.kind === 'onglet').length, 1)
})

test('sans texte : les onglets puis les actions, sans favori ni historique', () => {
  const liste = construirePalette('', onglets, [{ url: 'https://a.fr/', titre: 'A' }], [{ url: 'https://b.fr/', titre: 'B' }])
  assert.deepEqual(liste.map((e) => e.kind), ['onglet', 'onglet', ...ACTIONS_PALETTE.map(() => 'action')])
})

test('tous les mots doivent correspondre, casse ignorée', () => {
  const favoris = [{ url: 'https://doc.rust-lang.org/', titre: 'Rust docs' }]
  assert.equal(construirePalette('RUST doc', [], favoris, []).length, 1)
  assert.equal(construirePalette('rust python', [], favoris, []).length, 0)
})

test('une page déjà ouverte, ou déjà proposée comme favori, n’est pas répétée', () => {
  const favoris = [{ url: 'https://github.com/', titre: 'GitHub' }, { url: 'https://gitlab.com/', titre: 'GitLab' }]
  const historique = [{ url: 'https://gitlab.com/', titre: 'GitLab' }, { url: 'https://git-scm.com/', titre: '' }]
  const liste = construirePalette('git', onglets, favoris, historique)
  assert.deepEqual(liste.map((e) => `${e.kind}:${e.cle}`), ['onglet:t2', 'favori:https://gitlab.com/', 'historique:https://git-scm.com/'])
  assert.equal(liste[2].titre, 'https://git-scm.com/') // titre vide : l’adresse en tient lieu
})

test('une action se trouve par son libellé', () => {
  assert.deepEqual(construirePalette('thème', [], [], []).map((e) => e.cle), ['theme'])
})

test('le plafond par type est respecté', () => {
  const beaucoup = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, titre: `page ${i}`, url: `https://x.fr/${i}`, adresse: `https://x.fr/${i}` }))
  assert.equal(construirePalette('page', beaucoup, [], []).length, 6)
})

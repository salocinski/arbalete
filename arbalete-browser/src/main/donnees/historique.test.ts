import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { after, test } from 'node:test'
import { ouvrirBase } from './base.ts'
import { LONGUEUR_MAX_TITRE, LONGUEUR_MAX_URL, adresseHistorique, ajouterVisite, lirePage, nommerPage, rechercherPages, LONGUEUR_MOT_MAX, MOTS_MAX } from './historique.ts'
import { MIGRATIONS, appliquerMigrations, versionDuSchema } from './migrations.ts'
import { lireSession, sauverSession } from './session.ts'

// Tests unitaires de l'historique des visites (ARB-51).

const dossier = mkdtempSync(join(tmpdir(), 'arbalete-historique-'))
after(() => rmSync(dossier, { recursive: true, force: true }))

function datesDesVisites(db: DatabaseSync, url: string): number[] {
  return (db.prepare('SELECT date FROM visite JOIN page ON page.id = visite.page WHERE page.url = ? ORDER BY date').all(url) as Array<{ date: number }>)
    .map((ligne) => ligne.date)
}

test('seules les adresses web entrent dans l’historique, sans identifiants ni fragment', () => {
  strictEqual(adresseHistorique('https://example.com/a?b=1#section'), 'https://example.com/a?b=1')
  const avecIdentifiants = new URL('http://example.com/')
  avecIdentifiants.username = 'nom'
  avecIdentifiants.password = 'motdepasse'
  strictEqual(adresseHistorique(avecIdentifiants.href), 'http://example.com/')
  strictEqual(adresseHistorique('HTTPS://Example.com'), 'https://example.com/')
  for (const url of ['file:///C:/a.html', 'about:blank', 'data:text/html,x', 'chrome://gpu', 'https://', 'pas une adresse']) {
    strictEqual(adresseHistorique(url), null, url)
  }
  strictEqual(adresseHistorique(`https://example.com/${'a'.repeat(LONGUEUR_MAX_URL)}`), null)
})

test('chaque visite est datée et comptée, sur la même page', () => {
  const db = ouvrirBase(':memory:')
  ajouterVisite(db, 'https://example.com/', '', 1000)
  ajouterVisite(db, 'https://example.com/', 'Exemple', 2000)
  ajouterVisite(db, 'https://fr.wikipedia.org/', 'Wikipédia', 3000)
  deepStrictEqual(lirePage(db, 'https://example.com/'), { url: 'https://example.com/', titre: 'Exemple', visites: 2, derniereVisite: 2000 })
  deepStrictEqual(datesDesVisites(db, 'https://example.com/'), [1000, 2000])
  strictEqual(lirePage(db, 'https://fr.wikipedia.org/')?.visites, 1)
  db.close()
})

test('une visite sans titre garde le titre connu ; nommer change le titre, tronqué, d’une page visitée seulement', () => {
  const db = ouvrirBase(':memory:')
  ajouterVisite(db, 'https://example.com/', 'Exemple', 1000)
  ajouterVisite(db, 'https://example.com/', '', 2000)
  strictEqual(lirePage(db, 'https://example.com/')?.titre, 'Exemple')

  nommerPage(db, 'https://example.com/', 'x'.repeat(LONGUEUR_MAX_TITRE + 10))
  strictEqual(lirePage(db, 'https://example.com/')?.titre, 'x'.repeat(LONGUEUR_MAX_TITRE))
  nommerPage(db, 'https://inconnue.example/', 'Inconnue')
  strictEqual(lirePage(db, 'https://inconnue.example/'), undefined)
  db.close()
})

test('supprimer une page supprime ses visites', () => {
  const db = ouvrirBase(':memory:')
  ajouterVisite(db, 'https://example.com/', '', 1000)
  ajouterVisite(db, 'https://example.com/', '', 2000)
  db.prepare('DELETE FROM page WHERE url = ?').run('https://example.com/')
  strictEqual((db.prepare('SELECT count(*) AS n FROM visite').get() as { n: number }).n, 0)
  db.close()
})

test('une base au schéma 2 (avant ARB-51) gagne l’historique sans perdre sa session', () => {
  const chemin = join(dossier, 'schema2.db')
  const ancienne = new DatabaseSync(chemin)
  appliquerMigrations(ancienne, MIGRATIONS.slice(0, 2))
  sauverSession(ancienne, [{ url: 'https://example.com/', titre: 'Exemple', actif: true }])
  ancienne.close()

  const db = ouvrirBase(chemin)
  strictEqual(versionDuSchema(db), MIGRATIONS.length)
  deepStrictEqual(lireSession(db), [{ url: 'https://example.com/', titre: 'Exemple', actif: true }])
  ajouterVisite(db, 'https://example.com/', 'Exemple', 1000)
  strictEqual(lirePage(db, 'https://example.com/')?.visites, 1)
  db.close()
})

// Suggestions de la barre d'adresse (ARB-53).
function baseAvecPages(): DatabaseSync {
  const db = ouvrirBase(':memory:')
  ajouterVisite(db, 'https://github.com/', 'GitHub', 1000)
  ajouterVisite(db, 'https://github.com/', 'GitHub', 2000)
  ajouterVisite(db, 'https://example.com/guide-github', 'Guide de GitHub pour débutants', 3000)
  ajouterVisite(db, 'https://www.gitlab.com/', 'GitLab', 4000)
  ajouterVisite(db, 'https://example.com/100%_sur', 'Taux 100%', 5000)
  return db
}

test('la recherche exige tous les mots, dans l’adresse ou le titre, sans tenir compte de la casse', () => {
  const db = baseAvecPages()
  deepStrictEqual(rechercherPages(db, 'GUIDE github').map((page) => page.url), ['https://example.com/guide-github'])
  deepStrictEqual(rechercherPages(db, 'débutants').map((page) => page.url), ['https://example.com/guide-github'])
  deepStrictEqual(rechercherPages(db, 'introuvable'), [])
  deepStrictEqual(rechercherPages(db, '   '), [])
})

test('l’adresse qui commence par le premier mot passe devant, puis le nombre de visites', () => {
  const db = baseAvecPages()
  deepStrictEqual(rechercherPages(db, 'git').map((page) => page.url),
    ['https://github.com/', 'https://www.gitlab.com/', 'https://example.com/guide-github'])
  deepStrictEqual(rechercherPages(db, 'git', 1).map((page) => page.url), ['https://github.com/'])
})

test('% et _ du texte tapé se cherchent tels quels et n’agissent pas comme jokers', () => {
  const db = baseAvecPages()
  deepStrictEqual(rechercherPages(db, '100%_').map((page) => page.url), ['https://example.com/100%_sur'])
  deepStrictEqual(rechercherPages(db, '%'), [{ url: 'https://example.com/100%_sur', titre: 'Taux 100%', visites: 1, derniereVisite: 5000 }])
  deepStrictEqual(rechercherPages(db, '_'), [{ url: 'https://example.com/100%_sur', titre: 'Taux 100%', visites: 1, derniereVisite: 5000 }])
})

test('la recherche borne les mots, la longueur d’un mot et le nombre de lignes, et ne casse pas sur une apostrophe ou un point d’exclamation', () => {
  const db = baseAvecPages()
  // Au-delà de MOTS_MAX mots, les suivants sont ignorés : le sixième ne peut pas faire échouer la recherche.
  strictEqual(rechercherPages(db, `${'github '.repeat(MOTS_MAX)}introuvable`).length, 2)
  // Un mot trop long est tronqué, donc ne trouve rien plutôt que de peser sur la requête.
  deepStrictEqual(rechercherPages(db, 'x'.repeat(LONGUEUR_MOT_MAX * 4)), [])
  strictEqual(rechercherPages(db, 'git', 0).length, 0)
  strictEqual(rechercherPages(db, 'git', -3).length, 0)
  strictEqual(rechercherPages(db, 'git', 999).length, 3)
  deepStrictEqual(rechercherPages(db, "l'exclamation!"), [])
  // Le schéma ne se cherche pas : « tps » ou « http » ne ramènent pas toute la base, mais une adresse tapée en entier se trouve.
  deepStrictEqual(rechercherPages(db, 'tps'), [])
  deepStrictEqual(rechercherPages(db, 'http'), [])
  deepStrictEqual(rechercherPages(db, 'https://gitlab').map((page) => page.url), ['https://www.gitlab.com/'])
})

import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { after, test } from 'node:test'
import { ouvrirBase, ouvrirBaseOuRecuperer } from './base.ts'
import { noterFermetureNormale, noterOuverture } from './fermeture.ts'
import { MIGRATIONS, appliquerMigrations, versionDuSchema } from './migrations.ts'
import { lireSession, ongletsARestaurer, sauverSession, type OngletSauve } from './session.ts'

// Tests unitaires de la couche de données (ARB-43), lancés sous le Node d'Electron par npm run test:unit.

const dossier = mkdtempSync(join(tmpdir(), 'arbalete-donnees-'))
after(() => rmSync(dossier, { recursive: true, force: true }))

const onglets: OngletSauve[] = [
  { url: 'https://example.com/', titre: 'Exemple', actif: false },
  { url: 'https://fr.wikipedia.org/', titre: 'Wikipédia', actif: true },
  { url: 'about:blank', titre: '', actif: false }
]

test('une base neuve est au dernier schéma, en WAL', () => {
  const chemin = join(dossier, 'neuve.db')
  const db = ouvrirBase(chemin)
  strictEqual(versionDuSchema(db), MIGRATIONS.length)
  strictEqual((db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode, 'wal')
  db.close()
})

test('la session écrite se relit dans le même ordre, après réouverture', () => {
  const chemin = join(dossier, 'session.db')
  const db = ouvrirBase(chemin)
  deepStrictEqual(lireSession(db), [])
  sauverSession(db, onglets)
  db.close()

  const relue = ouvrirBase(chemin)
  deepStrictEqual(lireSession(relue), onglets)
  relue.close()
})

test('sauver remplace la session précédente, une session vide compris', () => {
  const db = ouvrirBase(':memory:')
  sauverSession(db, onglets)
  sauverSession(db, [onglets[1]])
  deepStrictEqual(lireSession(db), [onglets[1]])
  sauverSession(db, [])
  deepStrictEqual(lireSession(db), [])
  db.close()
})

test('une écriture qui échoue laisse la session précédente intacte', () => {
  const db = ouvrirBase(':memory:')
  sauverSession(db, onglets)
  // url NOT NULL : le deuxième onglet fait échouer l'insertion après la suppression, dans la même transaction.
  throws(() => sauverSession(db, [onglets[0], { url: null, titre: '', actif: false } as unknown as OngletSauve]))
  deepStrictEqual(lireSession(db), onglets)
  db.close()
})

test('les migrations manquantes s’appliquent dans l’ordre, une seule fois', () => {
  const db = new DatabaseSync(':memory:')
  const migrations = ['CREATE TABLE a (x)', 'CREATE TABLE b (y)']
  appliquerMigrations(db, migrations.slice(0, 1))
  strictEqual(versionDuSchema(db), 1)
  appliquerMigrations(db, migrations)
  strictEqual(versionDuSchema(db), 2)
  appliquerMigrations(db, migrations)
  strictEqual(versionDuSchema(db), 2)
  db.close()
})

test('une migration en échec ne change ni le schéma ni la version', () => {
  const db = new DatabaseSync(':memory:')
  // La deuxième migration crée b puis échoue : b ne doit pas rester, la version doit rester à 1.
  throws(() => appliquerMigrations(db, ['CREATE TABLE a (x)', 'CREATE TABLE b (y); INSERT INTO inexistante VALUES (1)']))
  strictEqual(versionDuSchema(db), 1)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all()
  deepStrictEqual(tables.map((ligne) => ligne.name), ['a'])
  strictEqual(db.isTransaction, false)
  db.close()
})

test('une base d’une version plus récente d’Arbalète est refusée, sans être modifiée', () => {
  const chemin = join(dossier, 'future.db')
  const future = new DatabaseSync(chemin)
  future.exec(`PRAGMA user_version = ${MIGRATIONS.length + 1}`)
  future.close()

  throws(() => ouvrirBase(chemin), /plus récente/)
  const relue = new DatabaseSync(chemin)
  strictEqual(versionDuSchema(relue), MIGRATIONS.length + 1)
  // Pas passée en WAL non plus : une version plus ancienne d'Arbalète n'a rien écrit.
  strictEqual((relue.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode, 'delete')
  relue.close()
})

test('la restauration ne rouvre que les adresses web, en gardant l’onglet actif', () => {
  const session: OngletSauve[] = [
    { url: 'file:///C:/secret.html', titre: 'Fichier', actif: false },
    ...onglets
  ]
  deepStrictEqual(ongletsARestaurer(session), { onglets: onglets.slice(0, 2), actif: 1 })
})

test('sans onglet actif restauré, le dernier devient actif ; une session vide ne rouvre rien', () => {
  const sansActif = onglets.map((onglet) => ({ ...onglet, actif: false }))
  // about:blank est écarté : le dernier onglet restauré est le deuxième.
  deepStrictEqual(ongletsARestaurer(sansActif).actif, 1)
  // L'onglet actif n'est pas une adresse web : il est écarté, le dernier restauré prend sa place.
  deepStrictEqual(ongletsARestaurer([onglets[0], { url: 'about:blank', titre: '', actif: true }]),
    { onglets: [onglets[0]], actif: 0 })
  deepStrictEqual(ongletsARestaurer([]), { onglets: [], actif: -1 })
})

test('une ouverture non refermée est signalée au démarrage suivant, une fermeture normale l’efface', () => {
  const chemin = join(dossier, 'fermeture.db')
  let db = ouvrirBase(chemin)
  // Première ouverture : rien à signaler.
  strictEqual(noterOuverture(db), false)
  db.close()

  // Arrêt forcé : la note est restée.
  db = ouvrirBase(chemin)
  strictEqual(noterOuverture(db), true)
  noterFermetureNormale(db)
  db.close()

  db = ouvrirBase(chemin)
  strictEqual(noterOuverture(db), false)
  db.close()
})

test('une base au schéma 1 (avant ARB-46) passe au schéma 2 sans perdre sa session', () => {
  const chemin = join(dossier, 'schema1.db')
  const ancienne = new DatabaseSync(chemin)
  appliquerMigrations(ancienne, MIGRATIONS.slice(0, 1))
  sauverSession(ancienne, onglets)
  ancienne.close()

  const db = ouvrirBase(chemin)
  strictEqual(versionDuSchema(db), MIGRATIONS.length)
  deepStrictEqual(lireSession(db), onglets)
  strictEqual(noterOuverture(db), false)
  db.close()
})

const DATE_INCIDENT = new Date('2026-11-03T10:20:30.400Z')

test('une base illisible est mise de côté et remplacée par une base neuve', () => {
  const sous = mkdtempSync(join(dossier, 'illisible-'))
  const chemin = join(sous, 'arbalete.db')
  const contenu = Buffer.from('pas une base SQLite '.repeat(10))
  writeFileSync(chemin, contenu)

  const { db, incident } = ouvrirBaseOuRecuperer(chemin, DATE_INCIDENT)
  const copie = 'arbalete.db.corrompue-2026-11-03T10-20-30.400Z'
  deepStrictEqual(incident, { type: 'corrompue', copie })
  deepStrictEqual(readFileSync(join(sous, copie)), contenu)
  // La base neuve est utilisable et au dernier schéma.
  strictEqual(versionDuSchema(db!), MIGRATIONS.length)
  sauverSession(db!, onglets)
  deepStrictEqual(lireSession(db!), onglets)
  db!.close()
})

test('une base aux pages abîmées est mise de côté, même si son en-tête se lit', () => {
  const sous = mkdtempSync(join(dossier, 'abimee-'))
  const chemin = join(sous, 'arbalete.db')
  const base = new DatabaseSync(chemin)
  base.exec('CREATE TABLE remplissage (texte TEXT)')
  const inserer = base.prepare('INSERT INTO remplissage VALUES (?)')
  for (let i = 0; i < 200; i++) inserer.run('x'.repeat(200))
  base.close()
  // Page 2 écrasée : l'en-tête (page 1) reste lisible.
  const octets = readFileSync(chemin)
  octets.fill(0xa5, 4096, 8192)
  writeFileSync(chemin, octets)

  const { db, incident } = ouvrirBaseOuRecuperer(chemin, DATE_INCIDENT)
  strictEqual(incident?.type, 'corrompue')
  strictEqual(versionDuSchema(db!), MIGRATIONS.length)
  db!.close()
})

test('une base plus récente n’est ni renommée ni modifiée ; une base saine ne signale rien', () => {
  const sous = mkdtempSync(join(dossier, 'recente-'))
  const chemin = join(sous, 'arbalete.db')
  const future = new DatabaseSync(chemin)
  future.exec(`PRAGMA user_version = ${MIGRATIONS.length + 1}`)
  future.close()
  const avant = readFileSync(chemin)

  deepStrictEqual(ouvrirBaseOuRecuperer(chemin), { db: null, incident: { type: 'plus-recente' } })
  deepStrictEqual(readdirSync(sous), ['arbalete.db'])
  deepStrictEqual(readFileSync(chemin), avant)

  const saine = join(sous, 'saine.db')
  const { db, incident } = ouvrirBaseOuRecuperer(saine)
  strictEqual(incident, null)
  strictEqual(existsSync(saine), true)
  db!.close()
})

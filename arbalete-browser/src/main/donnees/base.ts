import { existsSync, renameSync } from 'node:fs'
import { basename } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { BasePlusRecente, appliquerMigrations, refuserBasePlusRecente } from './migrations.ts'

// Attente maximale d'une base verrouillée par une autre connexion (autre instance d'Arbalète) avant d'échouer.
const ATTENTE_VERROU_MS = 5000

// Ouvre la base d'Arbalète (décision 0001) et la met au dernier schéma. Seul le processus principal l'ouvre ; le
// renderer et les pages n'y accèdent que par l'IPC. ':memory:' sert aux tests.
export function ouvrirBase(chemin: string): DatabaseSync {
  const db = new DatabaseSync(chemin, { timeout: ATTENTE_VERROU_MS })
  try {
    // Avant toute écriture : une base plus récente ne doit pas être modifiée, pas même passée en WAL.
    refuserBasePlusRecente(db)
    // Une base dont l'en-tête se lit peut avoir des pages abîmées : quick_check les trouve sans lire tous les index.
    const verification = db.prepare('PRAGMA quick_check').get() as { quick_check: string } | undefined
    if (verification?.quick_check !== 'ok') throw new BaseCorrompue(`Base abîmée : ${verification?.quick_check}`)
    // WAL + synchronous=NORMAL : écritures rapides, base intacte après un arrêt brutal (au pire la dernière
    // transaction perdue).
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA synchronous = NORMAL')
    db.exec('PRAGMA foreign_keys = ON')
    appliquerMigrations(db)
  } catch (erreur) {
    db.close()
    throw erreur
  }
  return db
}

export class BaseCorrompue extends Error {}

// Codes SQLite d'une base illisible : SQLITE_CORRUPT (11) et SQLITE_NOTADB (26), codes étendus compris.
function estCorrompue(erreur: unknown): boolean {
  if (erreur instanceof BaseCorrompue) return true
  const code = (erreur as { errcode?: unknown } | null)?.errcode
  return typeof code === 'number' && [11, 26].includes(code & 0xff)
}

// Ce que l'ouverture de la base a dû faire, pour en prévenir l'utilisateur (ARB-119).
export type IncidentBase =
  | { type: 'corrompue', copie: string }
  | { type: 'plus-recente' }
  | { type: 'indisponible' }

// Ouvre la base comme ouvrirBase, sans lever d'erreur. Une base illisible est mise de côté sous
// arbalete.db.corrompue-<date>, avec ses fichiers -wal et -shm, et remplacée par une base neuve. Une base plus récente
// ou verrouillée n'est jamais renommée : db vaut alors null et le navigateur marche sans persistance.
export function ouvrirBaseOuRecuperer(chemin: string, maintenant = new Date()): { db: DatabaseSync | null, incident: IncidentBase | null } {
  try {
    return { db: ouvrirBase(chemin), incident: null }
  } catch (erreur) {
    if (erreur instanceof BasePlusRecente) {
      console.error('Base d’une version plus récente d’Arbalète, laissée intacte :', erreur)
      return { db: null, incident: { type: 'plus-recente' } }
    }
    if (!estCorrompue(erreur)) {
      console.error('Base de données indisponible, aucune donnée ne sera conservée :', erreur)
      return { db: null, incident: { type: 'indisponible' } }
    }
    console.error('Base de données illisible, mise de côté :', erreur)
  }
  // Date sans « : », interdit dans un nom de fichier Windows.
  const copie = `${chemin}.corrompue-${maintenant.toISOString().replace(/:/g, '-')}`
  try {
    renameSync(chemin, copie)
    for (const suffixe of ['-wal', '-shm']) {
      if (existsSync(chemin + suffixe)) renameSync(chemin + suffixe, copie + suffixe)
    }
    return { db: ouvrirBase(chemin), incident: { type: 'corrompue', copie: basename(copie) } }
  } catch (erreur) {
    console.error('Base illisible non remplacée, aucune donnée ne sera conservée :', erreur)
    return { db: null, incident: { type: 'indisponible' } }
  }
}

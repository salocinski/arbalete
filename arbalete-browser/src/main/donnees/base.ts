import { DatabaseSync } from 'node:sqlite'
import { appliquerMigrations, refuserBasePlusRecente } from './migrations.ts'

// Attente maximale d'une base verrouillée par une autre connexion (autre instance d'Arbalète) avant d'échouer.
const ATTENTE_VERROU_MS = 5000

// Ouvre la base d'Arbalète (décision 0001) et la met au dernier schéma. Seul le processus principal l'ouvre ; le
// renderer et les pages n'y accèdent que par l'IPC. ':memory:' sert aux tests.
export function ouvrirBase(chemin: string): DatabaseSync {
  const db = new DatabaseSync(chemin, { timeout: ATTENTE_VERROU_MS })
  try {
    // Avant toute écriture : une base plus récente ne doit pas être modifiée, pas même passée en WAL.
    refuserBasePlusRecente(db)
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

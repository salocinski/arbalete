import { copyFileSync, existsSync, renameSync, rmSync } from 'node:fs'
import { basename } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { SUFFIXE_PRECEDENTE, SUFFIXE_SAUVEGARDE } from './sauvegarde.ts'
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

// Fichier momentanément tenu (redémarrage juste après un plantage, antivirus, processus tué qui lâche ses fichiers) :
// SQLite répond « disk I/O error », que le délai de verrou ci-dessus ne couvre pas. On réessaie avant de renoncer à la
// persistance (ARB-130). Une base jugée corrompue est rouverte avant d'être mise de côté (ARB-131) : une vraie
// corruption se reproduit à chaque ouverture, une lecture gênée passe au bout d'un moment. Les autres erreurs (base plus
// récente, verrou déjà attendu en vain, droits, dossier absent) ne se règlent pas en attendant : un seul essai, car
// chaque essai bloque le processus principal avant l'ouverture de la fenêtre.
const ESSAIS_OUVERTURE = 5
const ESSAIS_CONFIRMATION = 3
const PAUSE_ENTRE_ESSAIS_MS = 500

function estErreurES(erreur: unknown): boolean {
  const code = (erreur as { errcode?: unknown } | null)?.errcode
  return typeof code === 'number' && (code & 0xff) === 10
}

function essaisPermis(erreur: unknown): number {
  if (estErreurES(erreur)) return ESSAIS_OUVERTURE
  return estCorrompue(erreur) ? ESSAIS_CONFIRMATION : 1
}

function dormir(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function ouvrirAvecReessais(chemin: string, ouvrir: (chemin: string) => DatabaseSync, pause: (ms: number) => void): DatabaseSync {
  for (let essai = 1; ; essai++) {
    try {
      return ouvrir(chemin)
    } catch (erreur) {
      const permis = essaisPermis(erreur)
      if (essai >= permis) throw erreur
      console.error(`Ouverture de la base échouée (essai ${essai}/${permis}), nouvel essai :`, erreur)
      pause(PAUSE_ENTRE_ESSAIS_MS)
    }
  }
}

// Remet en place la dernière copie saine (puis la précédente) à la place de la base mise de côté. Une copie qui ne
// s'ouvre pas est écartée. null si aucune ne convient : l'appelant repart d'une base neuve.
// La copie remise en place s'ouvre avec les mêmes réessais que la base : un échec d'E/S passager ne doit pas écarter une
// bonne copie au profit d'une base vide.
function restaurerSauvegarde(chemin: string, ouvrir: (chemin: string) => DatabaseSync, pause: (ms: number) => void): DatabaseSync | null {
  for (const source of [chemin + SUFFIXE_SAUVEGARDE, chemin + SUFFIXE_SAUVEGARDE + SUFFIXE_PRECEDENTE]) {
    if (!existsSync(source)) continue
    try {
      copyFileSync(source, chemin)
      return ouvrirAvecReessais(chemin, ouvrir, pause)
    } catch (erreur) {
      console.error(`Copie de secours inutilisable (${basename(source)}) :`, erreur)
      for (const suffixe of ['', '-wal', '-shm']) {
        try { rmSync(chemin + suffixe, { force: true }) } catch (echec) { console.error('Copie écartée non supprimée :', echec) }
      }
    }
  }
  return null
}

// Ce que l'ouverture de la base a dû faire, pour en prévenir l'utilisateur (ARB-119).
export type IncidentBase =
  | { type: 'corrompue', copie: string, restauree: boolean }
  | { type: 'plus-recente' }
  | { type: 'indisponible' }

// Ouvre la base comme ouvrirBase, sans lever d'erreur. Une base illisible est mise de côté sous
// arbalete.db.corrompue-<date>, avec ses fichiers -wal et -shm, et remplacée par la dernière copie de secours saine
// (ARB-131) ou, à défaut, par une base neuve. Une base plus récente
// ou verrouillée n'est jamais renommée : db vaut alors null et le navigateur marche sans persistance.
export function ouvrirBaseOuRecuperer(
  chemin: string,
  maintenant = new Date(),
  ouvrir: (chemin: string) => DatabaseSync = ouvrirBase,
  pause: (ms: number) => void = dormir
): { db: DatabaseSync | null, incident: IncidentBase | null } {
  try {
    return { db: ouvrirAvecReessais(chemin, ouvrir, pause), incident: null }
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
    const restauree = restaurerSauvegarde(chemin, ouvrir, pause)
    return { db: restauree ?? ouvrirBase(chemin), incident: { type: 'corrompue', copie: basename(copie), restauree: restauree !== null } }
  } catch (erreur) {
    console.error('Base illisible non remplacée, aucune donnée ne sera conservée :', erreur)
    return { db: null, incident: { type: 'indisponible' } }
  }
}

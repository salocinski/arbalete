import type { DatabaseSync } from 'node:sqlite'

// Exécute fn dans une transaction : tout est écrit, ou rien si fn lève une erreur. IMMEDIATE prend le verrou d'écriture
// dès le début : une autre connexion attend (timeout de ouvrirBase) au lieu d'échouer en cours de route. Pas
// d'imbrication : SQLite refuse un BEGIN dans une transaction.
export function enTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const resultat = fn()
    db.exec('COMMIT')
    return resultat
  } catch (erreur) {
    // SQLite annule parfois déjà la transaction lui-même (disque plein, erreur d'E/S) : ROLLBACK lèverait alors une
    // erreur qui masquerait celle d'origine.
    if (db.isTransaction) db.exec('ROLLBACK')
    throw erreur
  }
}

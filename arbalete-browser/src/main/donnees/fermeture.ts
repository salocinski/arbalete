import type { DatabaseSync } from 'node:sqlite'
import { enTransaction } from './transaction.ts'

// Arrêt forcé (ARB-46) : Arbalète note son ouverture au démarrage et l'efface à sa fermeture normale. Un démarrage qui
// trouve encore la note suit un arrêt forcé : plantage, fin de tâche, coupure de courant.
const CLE_OUVERTURE = 'session-ouverte'

// Note l'ouverture et indique si la précédente n'a pas été refermée normalement. Une base qui n'a jamais eu de note
// (première ouverture, base d'avant ARB-46) compte comme refermée.
export function noterOuverture(db: DatabaseSync): boolean {
  return enTransaction(db, () => {
    const precedenteOuverte = db.prepare('SELECT 1 FROM etat WHERE cle = ?').get(CLE_OUVERTURE) !== undefined
    db.prepare('INSERT OR REPLACE INTO etat (cle, valeur) VALUES (?, ?)').run(CLE_OUVERTURE, new Date().toISOString())
    return precedenteOuverte
  })
}

export function noterFermetureNormale(db: DatabaseSync): void {
  db.prepare('DELETE FROM etat WHERE cle = ?').run(CLE_OUVERTURE)
}

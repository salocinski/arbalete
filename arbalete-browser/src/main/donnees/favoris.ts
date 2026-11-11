import type { DatabaseSync } from 'node:sqlite'
import { LONGUEUR_MAX_TITRE } from './historique.ts'
import { enTransaction } from './transaction.ts'

// Favoris (ARB-47, EP-08). L'adresse est celle de l'historique (adresseHistorique : web seulement, sans identifiants ni
// fragment) ; l'appelant la calcule. Dossiers et ordre viendront avec ARB-48.

export function estFavori(db: DatabaseSync, url: string): boolean {
  return db.prepare('SELECT 1 FROM favori WHERE url = ?').get(url) !== undefined
}

// Retire le favori s'il existe, l'ajoute sinon (avec le titre de la page, tronqué) ; renvoie vrai si la page est
// désormais un favori.
export function basculerFavori(db: DatabaseSync, url: string, titre: string, date = Date.now()): boolean {
  return enTransaction(db, () => {
    if (db.prepare('DELETE FROM favori WHERE url = ?').run(url).changes > 0) return false
    db.prepare('INSERT INTO favori (url, titre, date) VALUES (?, ?, ?)').run(url, titre.slice(0, LONGUEUR_MAX_TITRE), date)
    return true
  })
}

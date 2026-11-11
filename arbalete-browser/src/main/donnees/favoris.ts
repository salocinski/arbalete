import type { DatabaseSync } from 'node:sqlite'
import { LONGUEUR_MAX_TITRE } from './historique.ts'
import { enTransaction } from './transaction.ts'

// Favoris (ARB-47, EP-08). L'adresse est celle de l'historique (adresseHistorique : web seulement, sans identifiants ni
// fragment) ; l'appelant la calcule. Dossiers et ordre viendront avec ARB-48.

export function estFavori(db: DatabaseSync, url: string): boolean {
  return db.prepare('SELECT 1 FROM favori WHERE url = ?').get(url) !== undefined
}

// Taille de la grille de la barre latérale (ARB-49).
export const FAVORIS_GRILLE_MAX = 8

// Les premiers favoris ajoutés, dans leur ordre d'ajout : l'ordre de la grille ne bouge pas quand on en ajoute un.
// shortcut: pas d'épinglage choisi, la grille prend les 8 plus anciens ; le panneau d'ARB-48 listera tout et ordonnera.
export function favorisGrille(db: DatabaseSync, limite = FAVORIS_GRILLE_MAX): { url: string; titre: string }[] {
  return db.prepare('SELECT url, titre FROM favori ORDER BY date, id LIMIT ?').all(limite)
    .map((ligne) => ({ url: String(ligne.url), titre: String(ligne.titre) }))
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

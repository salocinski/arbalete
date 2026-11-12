import type { DatabaseSync } from 'node:sqlite'
import { LONGUEUR_MAX_TITRE } from './historique.ts'
import { enTransaction } from './transaction.ts'
import { LONGUEUR_MAX_NOM_DOSSIER, type ListeFavoris } from '../../shared/favoris.ts'

// Favoris (ARB-47, EP-08). L'adresse est celle de l'historique (adresseHistorique : web seulement, sans identifiants ni
// fragment) ; l'appelant la calcule. Dossiers : ARB-48.

export function estFavori(db: DatabaseSync, url: string): boolean {
  return db.prepare('SELECT 1 FROM favori WHERE url = ?').get(url) !== undefined
}

// Taille de la grille de la barre latérale (ARB-49).
export const FAVORIS_GRILLE_MAX = 8

// Les premiers favoris ajoutés, dans leur ordre d'ajout : l'ordre de la grille ne bouge pas quand on en ajoute un.
// shortcut: pas d'épinglage choisi, la grille prend les 8 plus anciens (le panneau d'ARB-48 liste tout, sans ordre choisi).
export function favorisGrille(db: DatabaseSync, limite = FAVORIS_GRILLE_MAX): { url: string; titre: string }[] {
  return db.prepare('SELECT url, titre FROM favori ORDER BY date, id LIMIT ?').all(limite)
    .map((ligne) => ({ url: String(ligne.url), titre: String(ligne.titre) }))
}

// Panneau des favoris (ARB-48) : tous les favoris (les plus anciens d'abord, comme la grille) et les dossiers à plat.
// shortcut: pas d'ordre choisi ni de dossiers imbriqués ; à ajouter si le besoin se confirme.
export function listerFavoris(db: DatabaseSync): ListeFavoris {
  return {
    dossiers: db.prepare('SELECT id, nom FROM dossier_favori ORDER BY id').all()
      .map((l) => ({ id: Number(l.id), nom: String(l.nom) })),
    favoris: db.prepare('SELECT id, url, titre, dossier FROM favori ORDER BY date, id').all()
      .map((l) => ({ id: Number(l.id), url: String(l.url), titre: String(l.titre), dossier: l.dossier === null ? null : Number(l.dossier) }))
  }
}

function nomDossier(nom: unknown): string {
  const propre = typeof nom === 'string' ? nom.trim() : ''
  if (propre.length === 0 || propre.length > LONGUEUR_MAX_NOM_DOSSIER) throw new Error('Nom de dossier invalide')
  return propre
}

export function creerDossier(db: DatabaseSync, nom: unknown): number {
  return Number(db.prepare('INSERT INTO dossier_favori (nom) VALUES (?)').run(nomDossier(nom)).lastInsertRowid)
}

export function renommerDossier(db: DatabaseSync, id: number, nom: unknown): boolean {
  return db.prepare('UPDATE dossier_favori SET nom = ? WHERE id = ?').run(nomDossier(nom), id).changes > 0
}

// Les favoris du dossier supprimé reviennent à la racine (clé étrangère ON DELETE SET NULL).
export function supprimerDossier(db: DatabaseSync, id: number): boolean {
  return db.prepare('DELETE FROM dossier_favori WHERE id = ?').run(id).changes > 0
}

// Range le favori dans un dossier existant, ou à la racine (null) ; faux si le favori ou le dossier n'existe pas.
export function deplacerFavori(db: DatabaseSync, id: number, dossier: number | null): boolean {
  if (dossier !== null && !db.prepare('SELECT 1 FROM dossier_favori WHERE id = ?').get(dossier)) return false
  return db.prepare('UPDATE favori SET dossier = ? WHERE id = ?').run(dossier, id).changes > 0
}

export function retirerFavori(db: DatabaseSync, id: number): boolean {
  return db.prepare('DELETE FROM favori WHERE id = ?').run(id).changes > 0
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

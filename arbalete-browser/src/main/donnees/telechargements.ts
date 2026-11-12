import type { DatabaseSync } from 'node:sqlite'
import { ETATS_TELECHARGEMENT, type EtatTelechargement, type Telechargement } from '../../shared/telechargements.ts'
import { enTransaction } from './transaction.ts'

// Historique des téléchargements (ARB-55, EP-10). Le processus principal tient la liste en mémoire et la reflète ici
// (écritures au mieux) : l'id est choisi par l'appelant, pour qu'un téléchargement ait le sien même si la base est
// indisponible.

// Au-delà, les plus anciens téléchargements terminés sont oubliés au démarrage.
export const TELECHARGEMENTS_GARDES = 200

type Ligne = Record<string, unknown>

function versTelechargement(ligne: Ligne): Telechargement {
  const etat = ETATS_TELECHARGEMENT.find((valeur) => valeur === ligne.etat) ?? 'interrompu'
  return {
    id: Number(ligne.id), url: String(ligne.url), nom: String(ligne.nom), chemin: String(ligne.chemin),
    total: Number(ligne.total), recu: Number(ligne.recu), etat, date: Number(ligne.date)
  }
}

// Plus grand id de l'historique (0 s'il est vide) : les prochains ids continuent après lui, même si sa lecture complète échoue.
export function dernierId(db: DatabaseSync): number {
  return Number((db.prepare('SELECT COALESCE(MAX(id), 0) AS dernier FROM telechargement').get() as { dernier: number }).dernier)
}

// Les plus récents d'abord.
export function lireTelechargements(db: DatabaseSync): Telechargement[] {
  return db.prepare('SELECT * FROM telechargement ORDER BY date DESC, id DESC').all().map(versTelechargement)
}

export function creerTelechargement(db: DatabaseSync, t: Telechargement): void {
  db.prepare('INSERT INTO telechargement (id, url, nom, chemin, total, recu, etat, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(t.id, t.url, t.nom, t.chemin, t.total, t.recu, t.etat, t.date)
}

export function majTelechargement(db: DatabaseSync, id: number, champs: { recu: number; total: number; etat: EtatTelechargement }): void {
  db.prepare('UPDATE telechargement SET recu = ?, total = ?, etat = ? WHERE id = ?').run(champs.recu, champs.total, champs.etat, id)
}

// Retire une ligne de l'historique, jamais celle d'un téléchargement actif ; le fichier téléchargé reste sur le disque.
export function retirerTelechargement(db: DatabaseSync, id: number): void {
  db.prepare("DELETE FROM telechargement WHERE id = ? AND etat NOT IN ('en-cours', 'en-pause')").run(id)
}

// Au démarrage : un téléchargement resté actif a été interrompu par l'arrêt d'Arbalète (aucune reprise automatique),
// et l'historique est ramené à TELECHARGEMENTS_GARDES lignes.
export function apresArret(db: DatabaseSync, gardes = TELECHARGEMENTS_GARDES): void {
  enTransaction(db, () => {
    db.exec("UPDATE telechargement SET etat = 'interrompu' WHERE etat IN ('en-cours', 'en-pause')")
    db.prepare(`DELETE FROM telechargement WHERE id NOT IN
      (SELECT id FROM telechargement ORDER BY date DESC, id DESC LIMIT ?)`).run(gardes)
  })
}

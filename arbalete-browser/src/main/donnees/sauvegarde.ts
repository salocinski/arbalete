import { existsSync, renameSync, rmSync, statSync } from 'node:fs'
import type { DatabaseSync } from 'node:sqlite'

// Copie de secours de la base (ARB-131) : une base reconnue corrompue est remplacée par la dernière copie saine au lieu
// d'une base vide. Deux copies sont gardées : la dernière et une génération plus ancienne (au moins 24 h plus vieille).
export const SUFFIXE_SAUVEGARDE = '.sauvegarde'
export const SUFFIXE_PRECEDENTE = '.precedente'
const AGE_MAX_MS = 24 * 60 * 60 * 1000

// Une copie est récente si elle a moins de 24 h ; une date dans le futur (horloge déréglée) compte comme ancienne.
function estRecente(chemin: string, maintenant: number): boolean {
  const age = maintenant - statSync(chemin).mtimeMs
  return age >= 0 && age < AGE_MAX_MS
}

// Écrit la copie dans un fichier temporaire (VACUUM INTO produit une base autonome, sans -wal) puis la met en place :
// une copie interrompue n'écrase jamais la bonne, et le temporaire est supprimé en cas d'échec. Rien n'est copié si la
// base courante ne passe pas quick_check, pour ne pas remplacer une bonne copie par une base abîmée. Avec
// seulementSiAncienne, une copie de moins de 24 h est gardée. La copie courante ne passe en `.precedente` que si elle a
// plus de 24 h : deux fermetures rapprochées ne font donc pas deux copies identiques. Renvoie true si une copie a été écrite.
export function sauvegarderBase(db: DatabaseSync, chemin: string, options: { seulementSiAncienne?: boolean, maintenant?: number } = {}): boolean {
  const cible = chemin + SUFFIXE_SAUVEGARDE
  const maintenant = options.maintenant ?? Date.now()
  const existe = existsSync(cible)
  const recente = existe && estRecente(cible, maintenant)
  if (options.seulementSiAncienne && recente) return false
  const verification = db.prepare('PRAGMA quick_check').get() as { quick_check: string } | undefined
  if (verification?.quick_check !== 'ok') return false
  const temporaire = cible + '.tmp'
  rmSync(temporaire, { force: true })
  try {
    db.prepare('VACUUM INTO ?').run(temporaire)
    // shortcut: le renommage remplace la cible sous Windows comme ailleurs ; une coupure entre les deux renommages laisse
    // au pire la copie précédente seule, que la restauration essaie aussi. La copie se fait sans borne de taille ni de
    // durée, sur le fil principal : à revoir si l'historique devient volumineux (copie hors fil, ou historique exclu).
    if (existe && !recente) renameSync(cible, cible + SUFFIXE_PRECEDENTE)
    renameSync(temporaire, cible)
  } finally {
    rmSync(temporaire, { force: true })
  }
  return true
}

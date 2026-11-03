import type { DatabaseSync } from 'node:sqlite'
import { enTransaction } from './transaction.ts'

export type OngletSauve = {
  url: string
  titre: string
  actif: boolean
}

// Onglets de la dernière session, dans leur ordre.
export function lireSession(db: DatabaseSync): OngletSauve[] {
  const lignes = db.prepare('SELECT url, titre, actif FROM onglet ORDER BY position').all() as Array<{
    url: string
    titre: string
    actif: number
  }>
  return lignes.map((ligne) => ({ url: ligne.url, titre: ligne.titre, actif: ligne.actif === 1 }))
}

// Remplace la session enregistrée par ces onglets, d'un bloc : une lecture ne voit jamais une session à moitié écrite.
export function sauverSession(db: DatabaseSync, onglets: readonly OngletSauve[]): void {
  const inserer = db.prepare('INSERT INTO onglet (position, url, titre, actif) VALUES (?, ?, ?, ?)')
  enTransaction(db, () => {
    db.exec('DELETE FROM onglet')
    onglets.forEach((onglet, position) => inserer.run(position, onglet.url, onglet.titre, onglet.actif ? 1 : 0))
  })
}

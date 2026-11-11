import type { DatabaseSync } from 'node:sqlite'
import { enTransaction } from './transaction.ts'

export type OngletSauve = {
  url: string
  titre: string
  actif: boolean
  // id de l'espace de l'onglet (ARB-60) ; absent s'il n'en a pas.
  espace?: number
}

// Onglets de la dernière session, dans leur ordre.
export function lireSession(db: DatabaseSync): OngletSauve[] {
  const lignes = db.prepare('SELECT url, titre, actif, espace FROM onglet ORDER BY position').all() as Array<{
    url: string
    titre: string
    actif: number
    espace: number | null
  }>
  return lignes.map((ligne) => ({
    url: ligne.url,
    titre: ligne.titre,
    actif: ligne.actif === 1,
    ...(ligne.espace === null ? {} : { espace: ligne.espace })
  }))
}

// Remplace la session enregistrée par ces onglets, d'un bloc : une lecture ne voit jamais une session à moitié écrite.
export function sauverSession(db: DatabaseSync, onglets: readonly OngletSauve[]): void {
  // Un espace supprimé entre-temps devient « aucun espace » (NULL) : un id périmé ne doit pas faire perdre toute la session.
  const inserer = db.prepare(
    'INSERT INTO onglet (position, url, titre, actif, espace) VALUES (?, ?, ?, ?, (SELECT id FROM espace WHERE id = ?))'
  )
  enTransaction(db, () => {
    db.exec('DELETE FROM onglet')
    onglets.forEach((onglet, position) => inserer.run(position, onglet.url, onglet.titre, onglet.actif ? 1 : 0, onglet.espace ?? null))
  })
}

// Rattache chaque onglet à un espace existant (ARB-61) : un onglet sans espace, ou dont l'espace a été supprimé, passe au
// premier espace ; sans aucun espace (base indisponible), les onglets n'en ont pas.
export function rattacherAuxEspaces(onglets: readonly OngletSauve[], espaces: readonly number[]): OngletSauve[] {
  return onglets.map(({ espace, ...reste }) => {
    const rattache = espace !== undefined && espaces.includes(espace) ? espace : espaces[0]
    return rattache === undefined ? reste : { ...reste, espace: rattache }
  })
}

// Indice de l'onglet actif de chaque espace (clé undefined : onglets sans espace) : le premier marqué actif, sinon le
// dernier de l'espace. Un seul actif par espace est une règle du code, pas de la base (ARB-61) : une contrainte d'index
// ferait échouer l'écriture entière de la session sur une violation, alors qu'ici une base écrite à la main se répare.
export function actifsParEspace(onglets: readonly OngletSauve[]): Map<number | undefined, number> {
  const actifs = new Map<number | undefined, number>()
  const marques = new Set<number | undefined>()
  onglets.forEach((onglet, indice) => {
    if (marques.has(onglet.espace)) return
    actifs.set(onglet.espace, indice)
    if (onglet.actif) marques.add(onglet.espace)
  })
  return actifs
}

// Onglets à rouvrir au démarrage (ARB-45) : seules les adresses web le sont, comme les ouvertures des pages (ARB-102),
// car la restauration charge depuis le processus principal. actif est l'indice de l'onglet actif parmi eux, le dernier
// si aucun n'était marqué (onglet actif écarté ou base écrite à la main).
export function ongletsARestaurer(session: readonly OngletSauve[]): { onglets: OngletSauve[], actif: number } {
  const onglets = session.filter((onglet) => /^https?:\/\//i.test(onglet.url) && URL.canParse(onglet.url))
  const actif = onglets.findIndex((onglet) => onglet.actif)
  return { onglets, actif: actif >= 0 ? actif : onglets.length - 1 }
}

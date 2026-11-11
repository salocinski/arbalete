import type { DatabaseSync } from 'node:sqlite'
import { COULEURS_ESPACE, ESPACES_INITIAUX, LONGUEUR_MAX_ICONE_ESPACE, LONGUEUR_MAX_NOM_ESPACE, type CouleurEspace, type Espace } from '../../shared/espaces.ts'
import { ecrirePreference, lirePreference } from './preferences.ts'
import { enTransaction } from './transaction.ts'

// Espaces (ARB-60, EP-12) : dépôt sur la table `espace`. Les onglets d'un espace sont ceux de la session portant son id
// (session.ts). Le processus principal sème les espaces d'origine au démarrage (ARB-61, `semerEspaces`) ; création,
// renommage, ordre et suppression par l'utilisateur passent par ses canaux IPC (ARB-62, index.ts).

export type ChampsEspace = Omit<Espace, 'id'>

// Valide les champs reçus (frontière de confiance : l'IPC leur enverra des données du renderer) ; renvoie les champs
// nettoyés (nom et icône sans espaces de bord) ou lève une erreur.
export function validerEspace(champs: ChampsEspace): ChampsEspace {
  // shortcut: longueurs comptées en unités UTF-16, un emoji composé peut dépasser 8 ; passer à Intl.Segmenter si le sélecteur d'icônes en propose.
  const nom = typeof champs.nom === 'string' ? champs.nom.trim() : ''
  const icone = typeof champs.icone === 'string' ? champs.icone.trim() : ''
  if (nom.length === 0 || nom.length > LONGUEUR_MAX_NOM_ESPACE) throw new Error('Nom d’espace invalide')
  if (icone.length === 0 || icone.length > LONGUEUR_MAX_ICONE_ESPACE) throw new Error('Icône d’espace invalide')
  if (!COULEURS_ESPACE.includes(champs.couleur as CouleurEspace)) throw new Error('Couleur d’espace inconnue')
  return { nom, couleur: champs.couleur, icone }
}

// Espaces dans leur ordre. Une couleur inconnue (base écrite à la main, couleur retirée dans une version future) est
// remplacée à la lecture par « personal » : l'interface résout toujours un token existant.
export function lireEspaces(db: DatabaseSync): Espace[] {
  const lignes = db.prepare('SELECT id, nom, couleur, icone FROM espace ORDER BY position, id').all() as Espace[]
  return lignes.map((ligne) => ({
    id: ligne.id,
    nom: ligne.nom,
    couleur: COULEURS_ESPACE.includes(ligne.couleur) ? ligne.couleur : 'personal',
    icone: ligne.icone
  }))
}

// Crée les espaces d'origine si la table est vide (ARB-61) ; sans effet sinon, y compris si l'utilisateur les a tous supprimés
// puis en a créé d'autres.
export function semerEspaces(db: DatabaseSync): void {
  enTransaction(db, () => {
    if (lireEspaces(db).length === 0) ESPACES_INITIAUX.forEach((champs) => creerEspace(db, champs))
  })
}

// Espace affiché au démarrage : le dernier choisi s'il existe encore, sinon le premier ; null sans aucun espace.
export function lireEspaceActif(db: DatabaseSync, espaces: readonly Espace[]): number | null {
  const choisi = Number(lirePreference(db, 'espace.actif'))
  return espaces.find((espace) => espace.id === choisi)?.id ?? espaces[0]?.id ?? null
}

export function ecrireEspaceActif(db: DatabaseSync, id: number): void {
  ecrirePreference(db, 'espace.actif', String(id))
}

// Ajoute l'espace en dernière position et renvoie son id.
export function creerEspace(db: DatabaseSync, champs: ChampsEspace): number {
  const { nom, couleur, icone } = validerEspace(champs)
  const resultat = db.prepare(
    'INSERT INTO espace (nom, couleur, icone, position) VALUES (?, ?, ?, (SELECT COALESCE(MAX(position) + 1, 0) FROM espace))'
  ).run(nom, couleur, icone)
  return Number(resultat.lastInsertRowid)
}

function validerId(id: number): void {
  if (!Number.isSafeInteger(id)) throw new Error('Identifiant d’espace invalide')
}

// Renvoie faux si l'espace n'existe pas.
export function modifierEspace(db: DatabaseSync, id: number, champs: ChampsEspace): boolean {
  validerId(id)
  const { nom, couleur, icone } = validerEspace(champs)
  return db.prepare('UPDATE espace SET nom = ?, couleur = ?, icone = ? WHERE id = ?').run(nom, couleur, icone, id).changes > 0
}

// Les onglets de l'espace supprimé restent dans la session, sans espace. Renvoie faux si l'espace n'existe pas.
export function supprimerEspace(db: DatabaseSync, id: number): boolean {
  validerId(id)
  return db.prepare('DELETE FROM espace WHERE id = ?').run(id).changes > 0
}

// Nouvel ordre : doit nommer chaque espace existant une fois exactement, sinon rien n'est modifié.
export function ordonnerEspaces(db: DatabaseSync, ids: readonly number[]): void {
  ids.forEach(validerId)
  enTransaction(db, () => {
    const existants = lireEspaces(db).map((espace) => espace.id).sort((a, b) => a - b)
    const demandes = [...ids].sort((a, b) => a - b)
    if (existants.length !== demandes.length || existants.some((id, i) => id !== demandes[i])) throw new Error('Ordre d’espaces invalide')
    const maj = db.prepare('UPDATE espace SET position = ? WHERE id = ?')
    ids.forEach((id, position) => maj.run(position, id))
  })
}

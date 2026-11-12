import type { DatabaseSync } from 'node:sqlite'
import { REPONSES_PERMISSION, type PermissionSite, type ReponsePermission } from '../../shared/permissions.ts'
import { lirePreference } from './preferences.ts'

// Choix de permission par site (ARB-15), dans la table `etat` sous `pref.permission.<hôte>.<permission>` : pas de migration.
// shortcut: une ligne par hôte et par permission, jamais purgée, et sans écran pour revenir sur un choix ; ajouter une page
// de réglages du site (et l'effacement avec les données de navigation) quand le besoin se fait sentir. Le choix suit l'hôte,
// pas l'origine (http et https d'un même site le partagent), comme le zoom (ARB-71).
const PREFIXE = 'permission.'

export function lirePermissionSite(db: DatabaseSync, hote: string, permission: PermissionSite): ReponsePermission | undefined {
  const valeur = lirePreference(db, `${PREFIXE}${hote}.${permission}`)
  return REPONSES_PERMISSION.find((reponse) => reponse === valeur)
}

export function ecrirePermissionSite(db: DatabaseSync, hote: string, permission: PermissionSite, reponse: ReponsePermission): void {
  db.prepare('INSERT OR REPLACE INTO etat (cle, valeur) VALUES (?, ?)').run(`pref.${PREFIXE}${hote}.${permission}`, reponse)
}

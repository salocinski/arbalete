import type { DatabaseSync } from 'node:sqlite'
import { lirePreference } from './preferences.ts'

// Sites autorisés à ouvrir des pop-ups sans geste de l'utilisateur (ARB-108), dans la table `etat` sous `pref.popup.<hôte>` :
// pas de migration. shortcut: une ligne par hôte, jamais purgée et sans écran pour revenir sur le choix ; ajouter une page de
// réglages du site (avec les permissions d'ARB-15) quand le besoin se fait sentir.
const PREFIXE = 'popup.'

export function popupsAutorises(db: DatabaseSync, hote: string): boolean {
  return lirePreference(db, PREFIXE + hote) === 'autorise'
}

export function autoriserPopups(db: DatabaseSync, hote: string): void {
  db.prepare('INSERT OR REPLACE INTO etat (cle, valeur) VALUES (?, ?)').run(`pref.${PREFIXE}${hote}`, 'autorise')
}

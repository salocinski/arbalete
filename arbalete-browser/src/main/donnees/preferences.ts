import type { DatabaseSync } from 'node:sqlite'
import type { ThemeChoice } from '../../shared/types.ts'

// Préférences de l'utilisateur (ARB-59, EP-11), dans la table clé/valeur `etat` sous le préfixe `pref.` : pas de
// migration. shortcut: une valeur texte par clé, sans typage ; passer à une table dédiée si une préférence devient
// structurée (ARB-57, ARB-58).
const PREFIXE = 'pref.'

export const THEMES = ['system', 'dark', 'light'] as const satisfies readonly ThemeChoice[]

export function lirePreference(db: DatabaseSync, cle: string): string | undefined {
  const ligne = db.prepare('SELECT valeur FROM etat WHERE cle = ?').get(PREFIXE + cle) as { valeur: string } | undefined
  return ligne?.valeur
}

export function ecrirePreference(db: DatabaseSync, cle: string, valeur: string): void {
  db.prepare('INSERT OR REPLACE INTO etat (cle, valeur) VALUES (?, ?)').run(PREFIXE + cle, valeur)
}

// Thème choisi, ou « system » s'il n'a jamais été choisi ou si la valeur enregistrée est inconnue (base écrite à la main,
// thème retiré dans une version future).
export function lireTheme(db: DatabaseSync): ThemeChoice {
  const valeur = lirePreference(db, 'theme')
  return THEMES.find((theme) => theme === valeur) ?? 'system'
}

export function ecrireTheme(db: DatabaseSync, choix: ThemeChoice): void {
  ecrirePreference(db, 'theme', choix)
}

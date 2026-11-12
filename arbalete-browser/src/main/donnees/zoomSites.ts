import type { DatabaseSync } from 'node:sqlite'
import { lirePreference } from './preferences.ts'

// Zoom de page mémorisé par site (ARB-71), dans la table `etat` sous `pref.zoom.<hôte>` : pas de migration.
// shortcut: une ligne par hôte, jamais purgée (un zoom remis à 100 % supprime la sienne) ; ajouter une purge si la table
// grossit. Le zoom suit l'hôte, pas l'origine (http et https d'un même site partagent le facteur). Il est vu comme un
// réglage de site : « effacer les données de navigation » ne le supprime pas (à faire si on ajoute un effacement des réglages).
const HOTE_MAX = 253
const PREFIXE = 'zoom.'
const FACTEUR_MIN = 0.25
const FACTEUR_MAX = 5

// Hôte d'une page web, ou undefined (autre schéma, adresse illisible) : seuls les sites web ont un zoom mémorisé.
export function hoteZoom(url: string): string | undefined {
  try {
    const { protocol, hostname } = new URL(url)
    return (protocol === 'http:' || protocol === 'https:') && hostname.length <= HOTE_MAX ? hostname.toLowerCase() : undefined
  } catch {
    return undefined
  }
}

// Facteur mémorisé pour l'hôte, 1 s'il n'y en a pas ou si la valeur est aberrante (base écrite à la main).
export function lireZoomSite(db: DatabaseSync, hote: string): number {
  const facteur = Number(lirePreference(db, PREFIXE + hote))
  return Number.isFinite(facteur) && facteur >= FACTEUR_MIN && facteur <= FACTEUR_MAX ? facteur : 1
}

export function ecrireZoomSite(db: DatabaseSync, hote: string, facteur: number): void {
  const cle = 'pref.' + PREFIXE + hote
  if (Math.abs(facteur - 1) < 0.005) db.prepare('DELETE FROM etat WHERE cle = ?').run(cle)
  else db.prepare('INSERT OR REPLACE INTO etat (cle, valeur) VALUES (?, ?)').run(cle, String(facteur))
}

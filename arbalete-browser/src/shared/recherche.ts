import type { FindResult } from './types'

// Compteur de la recherche dans la page (ARB-70) : rien tant qu'il n'y a pas de recherche, « 3/12 » ou « Aucun résultat ».
export function compteur(texte: string, resultat: FindResult | null): string {
  if (!texte || !resultat) return ''
  return resultat.total === 0 ? 'Aucun résultat' : `${resultat.active}/${resultat.total}`
}

// Recherche dans la page (ARB-70) : petite vue native au coin haut-droit de la page, qui laisse la page utilisable
// (défilement, clics) pendant la recherche. Ici, la partie pure : placement de la vue et texte accepté.
import type { Rectangle } from './bornes.ts'

export const LARGEUR_RECHERCHE = 360
export const HAUTEUR_RECHERCHE = 44
// Écart avec le bord du cadre de page.
const MARGE = 8
// Le texte vient de l'interface : borné, comme une adresse l'est ailleurs.
export const LONGUEUR_RECHERCHE_MAX = 256

// En haut à droite du cadre de page ; une page plus étroite que la vue la rétrécit au lieu de déborder.
export function placerRecherche(page: Rectangle): Rectangle {
  const width = Math.max(0, Math.min(LARGEUR_RECHERCHE, page.width - 2 * MARGE))
  return { x: page.x + page.width - MARGE - width, y: page.y + MARGE, width, height: HAUTEUR_RECHERCHE }
}

// Texte à chercher : une chaîne, tronquée. Vide, la recherche s'efface (pas d'erreur : le champ vidé est un cas normal).
export function texteRecherche(valeur: unknown): string {
  if (typeof valeur !== 'string') throw new Error('Argument IPC invalide : texte attendu')
  return valeur.slice(0, LONGUEUR_RECHERCHE_MAX)
}

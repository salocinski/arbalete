// Espaces de travail (ARB-60, EP-12). La couleur est le nom d'un token `--color-workspace-<nom>` (tokens.css), jamais une
// valeur hexadécimale : les palettes Dark et Light la résolvent.
export const COULEURS_ESPACE = ['personal', 'development', 'work', 'research'] as const
export type CouleurEspace = (typeof COULEURS_ESPACE)[number]

export const LONGUEUR_MAX_NOM_ESPACE = 40
export const LONGUEUR_MAX_ICONE_ESPACE = 8

export type Espace = {
  id: number
  nom: string
  couleur: CouleurEspace
  icone: string
}

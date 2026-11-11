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

// Champs d'un espace créé par l'utilisateur (ARB-62) : seul le nom est saisi, couleur et icône se choisissent à la suite
// de la liste. Partagé avec l'aperçu navigateur.
const ICONES_ESPACE = ['◆', '✳', '◈', '●'] as const
export function champsNouvelEspace(existants: readonly Espace[], nom: string): Omit<Espace, 'id'> {
  return { nom, couleur: COULEURS_ESPACE[existants.length % COULEURS_ESPACE.length], icone: ICONES_ESPACE[existants.length % ICONES_ESPACE.length] }
}

// Ids dans le nouvel ordre après avoir décalé `id` d'un cran (-1 vers le haut, 1 vers le bas) ; inchangés si `id` est
// absent ou déjà au bord.
export function ordreApresDeplacement(ids: readonly number[], id: number, sens: -1 | 1): number[] {
  const ordre = [...ids]
  const de = ordre.indexOf(id)
  const vers = de + sens
  if (de < 0 || vers < 0 || vers >= ordre.length) return ordre
  ;[ordre[de], ordre[vers]] = [ordre[vers], ordre[de]]
  return ordre
}

// Espaces créés au premier lancement (ARB-61), quand la table est vide : ceux de la maquette de la barre latérale.
export const ESPACES_INITIAUX: readonly Omit<Espace, 'id'>[] = [
  { nom: 'Développement', couleur: 'development', icone: '◆' },
  { nom: 'Personnel', couleur: 'personal', icone: '✳' },
  { nom: 'Recherche', couleur: 'research', icone: '◈' }
]

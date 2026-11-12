// Moteur de recherche de la barre d'adresse (ARB-58, EP-11) : quatre moteurs connus et un modèle personnalisé.
// Un modèle est une adresse https contenant « %s », remplacé par le texte tapé encodé.
export const MOTEURS = [
  { id: 'google', nom: 'Google', modele: 'https://www.google.com/search?q=%s' },
  { id: 'bing', nom: 'Bing', modele: 'https://www.bing.com/search?q=%s' },
  { id: 'duckduckgo', nom: 'DuckDuckGo', modele: 'https://duckduckgo.com/?q=%s' },
  { id: 'qwant', nom: 'Qwant', modele: 'https://www.qwant.com/?q=%s' }
] as const

export type MoteurId = (typeof MOTEURS)[number]['id'] | 'perso'

// `modele` ne sert que pour « perso » ; vide pour un moteur connu.
export interface ChoixMoteur {
  id: MoteurId
  modele: string
}

export const MOTEUR_DEFAUT: ChoixMoteur = { id: 'google', modele: '' }
export const MODELE_LONGUEUR_MAX = 512

export function modeleValide(modele: unknown): modele is string {
  if (typeof modele !== 'string' || modele.length > MODELE_LONGUEUR_MAX) return false
  if (modele.split('%s').length !== 2) return false // exactement un « %s »
  if (!modele.startsWith('https://')) return false
  const [a, b] = ['a', 'b'].map((texte) => urlRecherche(modele, texte))
  if (!URL.canParse(a) || !URL.canParse(b)) return false
  const [ua, ub] = [new URL(a), new URL(b)]
  // Le texte tapé ne choisit ni l'hôte ni des identifiants.
  return ua.host === ub.host && !ua.username && !ua.password
}

// Choix reçu de l'interface ou relu de la base : un moteur connu, ou « perso » avec un modèle valide.
export function choixMoteurValide(valeur: unknown): ChoixMoteur {
  const choix = valeur as Partial<ChoixMoteur> | null
  if (choix && typeof choix === 'object') {
    if (choix.id === 'perso' && modeleValide(choix.modele)) return { id: 'perso', modele: choix.modele }
    const connu = MOTEURS.find((moteur) => moteur.id === choix.id)
    if (connu) return { id: connu.id, modele: '' }
  }
  throw new Error('Argument IPC invalide : moteur de recherche attendu')
}

export function modeleDe(choix: ChoixMoteur): string {
  return choix.id === 'perso' ? choix.modele : (MOTEURS.find((moteur) => moteur.id === choix.id) ?? MOTEURS[0]).modele
}

export function urlRecherche(modele: string, texte: string): string {
  const encode = encodeURIComponent(texte)
  return modele.replace('%s', () => encode)
}

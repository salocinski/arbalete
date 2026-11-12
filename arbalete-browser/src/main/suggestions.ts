// Suggestions de la barre d'adresse (ARB-53, décision 0002) : la liste est construite ici, dans le processus principal, et
// affichée par la vue de la barre latérale (couche d'overlays) ; le champ, lui, reste dans la fenêtre et garde le clavier.
import { urlRecherche } from '../shared/moteurs.ts'
import type { Suggestion } from '../shared/types'
import type { PageVisitee } from './donnees/historique.ts'

export const SUGGESTIONS_MAX = 6
export const LONGUEUR_TEXTE_MAX = 256

// Texte tapé : une chaîne. Vide (ou fait d'espaces), ou plus long que LONGUEUR_TEXTE_MAX (une adresse collée, que la
// première ligne ne doit pas tronquer), il n'y a rien à suggérer.
export function texteSuggestion(valeur: unknown): string {
  if (typeof valeur !== 'string') throw new Error('Argument IPC invalide : texte attendu')
  return valeur.length > LONGUEUR_TEXTE_MAX ? '' : valeur.trim()
}

// Première ligne : ce que ferait Entrée (aller à l'adresse ou chercher), puis les pages déjà visitées qui correspondent,
// sans répéter l'adresse de la première ligne. `adresse` est le texte normalisé comme le fait la navigation ;
// `modele` est celui du moteur choisi (ARB-58), qui dit si cette adresse est une recherche.
export function construireSuggestions(texte: string, adresse: string, pages: PageVisitee[], modele: string): Suggestion[] {
  if (!texte) return []
  const premiere: Suggestion = adresse === urlRecherche(modele, texte)
    ? { kind: 'recherche', titre: texte, url: adresse }
    : { kind: 'adresse', titre: texte, url: adresse }
  const historique = pages
    .filter((page) => page.url !== adresse)
    .map((page): Suggestion => ({ kind: 'historique', titre: page.titre || page.url, url: page.url }))
  return [premiere, ...historique].slice(0, SUGGESTIONS_MAX)
}

// Flèches : -1 (aucune ligne, le texte tapé) puis 0…total-1, en boucle dans les deux sens.
export function deplacerSelection(selection: number, total: number, pas: 1 | -1): number {
  if (total <= 0) return -1
  const rang = selection + 1
  return ((rang + pas + total + 1) % (total + 1)) - 1
}

// Index reçu de l'interface (clic) ou sélection courante : valide seulement dans la liste.
export function indexValide(valeur: unknown, total: number): number | undefined {
  return typeof valeur === 'number' && Number.isInteger(valeur) && valeur >= 0 && valeur < total ? valeur : undefined
}

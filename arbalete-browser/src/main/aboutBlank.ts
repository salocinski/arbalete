// Annulation des navigations de page vers about:blank (ARB-97).
// Une page qui renverrait seule l'onglet vers about:blank à chaque chargement le ferait boucler (chaque retour en arrière
// recharge la page) : au-delà de RETOURS_BLANC_MAX par fenêtre, l'onglet reste sur about:blank.
// shortcut: aucun test de bout en bout ne reproduit une telle boucle (une navigation de script remplace l'entrée
// d'historique, sans retour possible) ; le plafond est une garde, à revoir si Electron expose un événement annulable.
export const RETOURS_BLANC_MAX = 2
export const FENETRE_RETOURS_BLANC_MS = 60_000

export const estAboutBlank = (url: string) => /^about:blank(?:[?#]|$)/i.test(url)

// Renvoie les instants de retour à conserver si un retour de plus est permis maintenant, sinon null.
export function retourPermis(retours: number[], maintenant: number): number[] | null {
  const recents = retours.filter((instant) => maintenant - instant < FENETRE_RETOURS_BLANC_MS)
  return recents.length < RETOURS_BLANC_MAX ? [...recents, maintenant] : null
}

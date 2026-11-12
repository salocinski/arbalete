import type { EntreeMenuPage } from '../shared/menuPage.ts'

export type ContexteMenuPage = {
  lien: string
  image: string
  texteSelectionne: boolean
  peutReculer: boolean
  peutAvancer: boolean
  // shortcut: Inspecter seulement hors de l'app empaquetée (F12 y est sans effet, C24) ; à lever si les DevTools des pages y sont admis.
  inspecter: boolean
}

export const adresseWeb = (texte: string) => /^https?:\/\//i.test(texte)

// Entrées du menu au point du clic. Lien, image ou sélection : leurs entrées seules (comme Chrome) ; sinon la navigation.
// Une adresse qui n'est pas http(s) (javascript:, data:, blob:) n'est jamais proposée.
export function entreesMenuPage(c: ContexteMenuPage): EntreeMenuPage[] {
  const entrees: EntreeMenuPage[] = []
  if (adresseWeb(c.lien)) entrees.push('ouvrir-lien', 'copier-lien')
  if (adresseWeb(c.image)) entrees.push('enregistrer-image')
  if (c.texteSelectionne) entrees.push('copier')
  if (!entrees.length) {
    if (c.peutReculer) entrees.push('retour')
    if (c.peutAvancer) entrees.push('avancer')
    entrees.push('recharger')
  }
  if (c.inspecter) entrees.push('inspecter')
  return entrees
}

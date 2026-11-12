// Menu contextuel des pages web (ARB-40) : les entrées possibles sont une liste fermée. Le processus principal choisit
// celles qui s'appliquent au point du clic et garde l'adresse du lien ou de l'image ; l'interface n'envoie que l'entrée.
export const LIBELLES_MENU_PAGE = {
  retour: 'Précédent',
  avancer: 'Suivant',
  recharger: 'Recharger',
  copier: 'Copier',
  'ouvrir-lien': 'Ouvrir le lien dans un nouvel onglet',
  'copier-lien': 'Copier l’adresse du lien',
  'enregistrer-image': 'Enregistrer l’image',
  inspecter: 'Inspecter'
} as const

export type EntreeMenuPage = keyof typeof LIBELLES_MENU_PAGE

export type MenuPage = { x: number, y: number, entrees: EntreeMenuPage[] }

export function entreeMenuPageValide(valeur: unknown): valeur is EntreeMenuPage {
  return typeof valeur === 'string' && Object.hasOwn(LIBELLES_MENU_PAGE, valeur)
}

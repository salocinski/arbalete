// Pop-ups de connexion (ARB-16) : un window.open avec des dimensions (« width=500,height=600 ») ouvre une vraie fenêtre
// fille qui garde window.opener, sinon « Se connecter avec Google » échoue (la page ne reçoit jamais le jeton).
// Tout autre window.open ou target=_blank reste un onglet (ARB-102).
import type { Rectangle } from './bornes.ts'

export const POPUPS_MAX = 3
const LARGEUR_DEFAUT = 500
const HAUTEUR_DEFAUT = 600
const MIN = 200
const MAX = 1200

// Chromium marque « new-window » la disposition d'un window.open qui demande une fenêtre (features non vides).
export function estPopup(disposition: string): boolean {
  return disposition === 'new-window'
}

// ARB-108 : setWindowOpenHandler ne dit pas si un geste l'a déclenché ; on retient le dernier geste de l'utilisateur
// (clic, touche, toucher) par onglet et on n'ouvre que dans les 5 s qui suivent, comme l'activation de Chromium.
// Horloge monotone (performance.now) : une horloge Windows reculée ne fausse rien.
export const GESTE_VALIDE_MS = 5000
const TYPES_GESTE = new Set(['mouseDown', 'keyDown', 'rawKeyDown', 'touchStart', 'gestureTap'])

export function estGeste(typeEvenement: string): boolean {
  return TYPES_GESTE.has(typeEvenement)
}

export function gesteRecent(dernierGeste: number | undefined, maintenant: number): boolean {
  return dernierGeste !== undefined && maintenant >= dernierGeste && maintenant - dernierGeste <= GESTE_VALIDE_MS
}

// Avis « pop-up bloquée » (ARB-108) : petite vue native en bas à gauche de la page (la page masque tout HTML posé sur elle),
// qui s'efface seule après 6 s ; l'icône de la barre d'adresse le rouvre.

export const AVIS_DUREE_MS = 6000
export const LARGEUR_AVIS = 320
export const HAUTEUR_AVIS = 44
// Écart avec le bord du cadre de page : jumeau de --space-2 (8 px). shortcut: il se superpose à l'aperçu d'adresse (ARB-36)
// quand un lien est survolé au même endroit, l'avis étant au-dessus ; l'aperçu passe de l'autre côté sous la souris.
const MARGE_AVIS = 8

export function placerAvisPopup(page: Rectangle): Rectangle {
  const width = Math.max(0, Math.min(LARGEUR_AVIS, page.width - 2 * MARGE_AVIS))
  return { x: page.x + MARGE_AVIS, y: page.y + page.height - MARGE_AVIS - HAUTEUR_AVIS, width, height: HAUTEUR_AVIS }
}

function dimension(features: string, nom: string, defaut: number): number {
  const trouve = new RegExp(`(?:^|[,\\s])${nom}\\s*=\\s*(\\d{1,5})(?![\\d.])`, 'i').exec(features)
  const valeur = trouve ? Number(trouve[1]) : defaut
  return Math.min(Math.max(valeur, MIN), MAX)
}

// Taille demandée par la page, bornée ; le reste (position, barres, sandbox) n'est jamais celui de la page.
export function tailleDePopup(features: string): { width: number; height: number } {
  return { width: dimension(features, 'width', LARGEUR_DEFAUT), height: dimension(features, 'height', HAUTEUR_DEFAUT) }
}

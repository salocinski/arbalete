// Pop-ups de connexion (ARB-16) : un window.open avec des dimensions (« width=500,height=600 ») ouvre une vraie fenêtre
// fille qui garde window.opener, sinon « Se connecter avec Google » échoue (la page ne reçoit jamais le jeton).
// Tout autre window.open ou target=_blank reste un onglet (ARB-102).
export const POPUPS_MAX = 3
const LARGEUR_DEFAUT = 500
const HAUTEUR_DEFAUT = 600
const MIN = 200
const MAX = 1200

// Chromium marque « new-window » la disposition d'un window.open qui demande une fenêtre (features non vides).
export function estPopup(disposition: string): boolean {
  return disposition === 'new-window'
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

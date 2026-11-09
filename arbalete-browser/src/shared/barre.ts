import type { SidebarAction, SidebarState } from './types.ts'

// Barre latérale en trois états (ARB-123), logique partagée par le processus principal et l'aperçu web.
// Étendue = épinglée ; compacte = épinglée et réduite aux icônes ; masquée = non épinglée, rappelée au survol (ARB-33).
// Jumelles de .sidebar / .sidebar-reserve et .sidebar-hover-strip dans styles.css : les changer ensemble.
export const LARGEUR_ETENDUE_DEFAUT = 252
export const LARGEUR_ETENDUE_MIN = 200
export const LARGEUR_ETENDUE_MAX = 400
export const LARGEUR_COMPACTE = 68
export const LARGEUR_BANDE = 6

export const ETAT_BARRE_INITIAL: SidebarState = { open: false, pinned: false, compact: false, width: LARGEUR_ETENDUE_DEFAUT }

// Largeur reçue de l'interface ou relue de la base : entier dans les bornes, défaut si ce n'est pas un nombre.
export function borneLargeurBarre(valeur: unknown): number {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return LARGEUR_ETENDUE_DEFAUT
  return Math.min(LARGEUR_ETENDUE_MAX, Math.max(LARGEUR_ETENDUE_MIN, Math.round(valeur)))
}

// Largeur voulue par une touche de la poignée (flèches ±16 px, Début, Fin), ou undefined si la touche n'en règle aucune.
export const PAS_CLAVIER_BARRE = 16
export function largeurApresTouche(touche: string, largeur: number): number | undefined {
  switch (touche) {
    case 'ArrowLeft': return borneLargeurBarre(largeur - PAS_CLAVIER_BARRE)
    case 'ArrowRight': return borneLargeurBarre(largeur + PAS_CLAVIER_BARRE)
    case 'Home': return LARGEUR_ETENDUE_MIN
    case 'End': return LARGEUR_ETENDUE_MAX
    default: return undefined
  }
}

// Réduite aux icônes : seulement épinglée. Masquée, la barre rappelée au survol s'affiche toujours étendue.
export function barreCompacte(etat: SidebarState): boolean {
  return etat.pinned && etat.compact
}

// Largeur de la vue de la barre : celle de la barre affichée, ou la bande de survol quand elle est masquée.
export function largeurBarre(etat: SidebarState): number {
  if (!etat.open) return LARGEUR_BANDE
  return barreCompacte(etat) ? LARGEUR_COMPACTE : etat.width
}

// Masquer n'agit pas sur une barre épinglée ; désépingler la referme. Le choix compacte survit au masquage.
export function transitionBarre(etat: SidebarState, action: SidebarAction): SidebarState {
  switch (action) {
    case 'open': return { ...etat, open: true }
    case 'hide': return etat.pinned ? etat : { ...etat, open: false }
    case 'toggle-pin': return etat.pinned ? { ...etat, open: false, pinned: false } : { ...etat, open: true, pinned: true }
    case 'toggle-compact': return etat.pinned ? { ...etat, compact: !etat.compact } : etat
  }
}

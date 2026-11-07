import type { BrowserTab } from '../../../shared/types'

// États visuels de l'onglet (DESIGN.md, Onglets : Default, Hover, Active, Pinned, Loading, Muted, Error).
// Hover vient de :hover en CSS ; Default est l'absence des autres. Un onglet peut en cumuler plusieurs.
export function etatsOnglet(tab: BrowserTab, active: boolean): string[] {
  const etats: string[] = []
  if (active) etats.push('active')
  if (tab.pinned) etats.push('pinned')
  if (tab.isLoading) etats.push('loading')
  if (tab.muted) etats.push('muted')
  if (tab.error) etats.push('error')
  return etats
}

// Icône du favicon : l'erreur l'emporte sur le chargement. 'generique' tant que le favicon n'est pas transmis.
export function iconeFavicon(tab: BrowserTab): 'erreur' | 'chargement' | 'generique' {
  return tab.error ? 'erreur' : tab.isLoading ? 'chargement' : 'generique'
}

// Indicateur sonore : muet l'emporte sur audible.
export function iconeSonore(tab: BrowserTab): 'muet' | 'son' | null {
  return tab.muted ? 'muet' : tab.audible ? 'son' : null
}

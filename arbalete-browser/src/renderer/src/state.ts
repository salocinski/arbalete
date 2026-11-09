import { useEffect, useState } from 'react'
import { ETAT_BARRE_INITIAL } from '../../shared/barre'
import type { BrowserState, DataIncident, SidebarState, ThemeChoice } from '../../shared/types'

// État de l'interface : chaque hook lit sa part dans le processus principal, qui en reste la source de vérité,
// puis suit ses mises à jour. La fenêtre et la vue de la barre latérale sont deux documents distincts : chacune
// tient sa propre copie.

// Aucun onglet fictif avant la réponse du processus principal (ARB-115, ARB-9) : l'aperçu navigateur crée ses propres
// onglets de démonstration dans previewApi.ts.
const starterState: BrowserState = { tabs: [], activeTabId: null }

export type ThemeState = { choice: ThemeChoice; effective: 'dark' | 'light' }

export function useBrowserState(): BrowserState {
  const [state, setState] = useState<BrowserState>(starterState)
  useEffect(() => {
    void window.arbalete.getState().then((next) => {
      if (next.tabs.length) setState(next)
    }).catch(() => {})
    return window.arbalete.onState((next) => setState(next))
  }, [])
  return state
}

// Invite de restauration après un arrêt forcé (ARB-46).
export function useRestoreOffer(): boolean {
  const [offer, setOffer] = useState(false)
  useEffect(() => {
    void window.arbalete.getRestoreOffer().then(setOffer).catch(() => {})
    return window.arbalete.onRestoreOffer(setOffer)
  }, [])
  return offer
}

// Incident de la base à l'ouverture (ARB-119).
export function useDataIncident(): DataIncident | null {
  const [incident, setIncident] = useState<DataIncident | null>(null)
  useEffect(() => {
    void window.arbalete.getDataIncident().then(setIncident).catch(() => {})
    return window.arbalete.onDataIncident(setIncident)
  }, [])
  return incident
}

export function useSidebar(): SidebarState {
  const [sidebar, setSidebar] = useState<SidebarState>(ETAT_BARRE_INITIAL)
  useEffect(() => {
    void window.arbalete.getSidebar().then(setSidebar).catch(() => {})
    return window.arbalete.onSidebar(setSidebar)
  }, [])
  return sidebar
}

// Overlay ouvert (ARB-39) : la vue de la barre couvre alors la fenêtre.
export function useOverlay(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    void window.arbalete.getOverlay().then(setOpen).catch(() => {})
    return window.arbalete.onOverlay(setOpen)
  }, [])
  return open
}

// Choix de thème tenu par le processus principal, partagé par la fenêtre et la barre latérale.
export function useTheme(): ThemeState {
  const [choice, setChoice] = useState<ThemeChoice>('system')
  // Valeur initiale posée par main.tsx avant le premier rendu, confirmée ensuite par le processus principal.
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  useEffect(() => {
    void window.arbalete.getTheme().then(setChoice).catch(() => {})
    void window.arbalete.getSystemTheme().then(setSystemTheme).catch(() => {})
    const unsubscribeChoice = window.arbalete.onTheme(setChoice)
    const unsubscribeSystem = window.arbalete.onSystemTheme(setSystemTheme)
    return () => { unsubscribeChoice(); unsubscribeSystem() }
  }, [])
  const effective = choice === 'system' ? systemTheme : choice
  // Les palettes de design-system/tokens.css se choisissent par data-theme sur <html> : sans rechargement (ARB-34).
  useEffect(() => { document.documentElement.dataset.theme = effective }, [effective])
  return { choice, effective }
}

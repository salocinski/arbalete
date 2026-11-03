import { useEffect, useState } from 'react'
import type { BrowserState, SidebarState, ThemeChoice } from '../../shared/types'

// État de l'interface : chaque hook lit sa part dans le processus principal, qui en reste la source de vérité,
// puis suit ses mises à jour. La fenêtre et la vue de la barre latérale sont deux documents distincts : chacune
// tient sa propre copie.

const starterState: BrowserState = {
  tabs: [
    { id: 'demo-1', title: 'Bienvenue sur Arbalète', url: 'https://www.google.com', isLoading: false, canGoBack: false, canGoForward: false },
    { id: 'demo-2', title: 'Documentation Electron', url: 'https://www.electronjs.org', isLoading: false, canGoBack: true, canGoForward: false },
    { id: 'demo-3', title: 'React — bibliothèque UI', url: 'https://react.dev', isLoading: false, canGoBack: false, canGoForward: false }
  ],
  activeTabId: 'demo-1'
}

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

export function useSidebar(): SidebarState {
  const [sidebar, setSidebar] = useState<SidebarState>({ open: false, pinned: false })
  useEffect(() => {
    void window.arbalete.getSidebar().then(setSidebar).catch(() => {})
    return window.arbalete.onSidebar(setSidebar)
  }, [])
  return sidebar
}

// Choix de thème tenu par le processus principal, partagé par la fenêtre et la barre latérale.
export function useTheme(): ThemeState {
  const [choice, setChoice] = useState<ThemeChoice>('system')
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>('dark')
  useEffect(() => {
    void window.arbalete.getTheme().then(setChoice).catch(() => {})
    void window.arbalete.getSystemTheme().then(setSystemTheme).catch(() => {})
    const unsubscribeChoice = window.arbalete.onTheme(setChoice)
    const unsubscribeSystem = window.arbalete.onSystemTheme(setSystemTheme)
    return () => { unsubscribeChoice(); unsubscribeSystem() }
  }, [])
  return { choice, effective: choice === 'system' ? systemTheme : choice }
}

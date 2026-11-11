import { ETAT_BARRE_INITIAL, borneLargeurBarre, transitionBarre } from '../../shared/barre'
import type { BrowserAPI, BrowserState, BrowserTab, SidebarState, ThemeChoice } from '../../shared/types'

/**
 * Mode aperçu navigateur.
 *
 * Hors d'Electron (npm run dev:web), le preload n'existe pas et `window.arbalete`
 * est absent. On installe alors une API simulée, en mémoire, pour que l'interface
 * soit utilisable dans un navigateur classique : c'est ce qui permet aux skills
 * gstack (/qa, /design-review, /browse, /benchmark) de tester l'UI.
 *
 * Aucune page web n'est réellement chargée : la zone de contenu affiche un
 * cadre de remplacement. Ce module n'est jamais actif dans l'application Electron.
 */

type PreviewTab = BrowserTab & { history: string[]; index: number }

let previewMode = false

export function isPreviewMode(): boolean {
  return previewMode
}

function titleFor(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host.charAt(0).toUpperCase() + host.slice(1)
  } catch {
    return 'Nouvel onglet'
  }
}

function normalizeUrl(input: string): string {
  const value = input.trim()
  if (!value) return 'https://www.google.com'
  if (/^https?:\/\//i.test(value)) return value
  if (!value.includes(' ') && value.includes('.')) return `https://${value}`
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`
}

export function installPreviewApi(): boolean {
  if (typeof window === 'undefined' || window.arbalete) return false
  previewMode = true

  const tabs: PreviewTab[] = []
  let activeTabId: string | null = null
  let next = 1
  const stateListeners = new Set<(state: BrowserState) => void>()
  const themeListeners = new Set<(theme: 'dark' | 'light') => void>()
  let sidebar: SidebarState = { ...ETAT_BARRE_INITIAL }
  const sidebarListeners = new Set<(state: SidebarState) => void>()
  const setSidebarState = (next: SidebarState) => {
    if (next.open === sidebar.open && next.pinned === sidebar.pinned && next.compact === sidebar.compact && next.width === sidebar.width) return
    sidebar = next
    sidebarListeners.forEach((fn) => fn({ ...sidebar }))
  }
  // Dans l'aperçu, la barre est dans le même document que la page simulée : l'overlay n'a rien à agrandir.
  let overlay = false
  const overlayListeners = new Set<(open: boolean) => void>()
  let theme: ThemeChoice = 'system'
  const themeChoiceListeners = new Set<(choice: ThemeChoice) => void>()
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const systemTheme = (): 'dark' | 'light' => (media.matches ? 'dark' : 'light')
  media.addEventListener('change', () => themeListeners.forEach((fn) => fn(systemTheme())))

  // Favoris de l'aperçu (ARB-47) : en mémoire, perdus au rechargement de la page.
  const favorites = new Set<string>()
  const snapshot = (): BrowserState => ({
    tabs: tabs.map(({ history: _h, index: _i, ...tab }) => ({ ...tab })),
    activeTabId,
    favorite: favorites.has(active()?.url ?? ''),
    favorites: [...favorites].slice(0, 8).map((url) => ({ url, title: titleFor(url) }))
  })
  const emit = () => {
    const state = snapshot()
    stateListeners.forEach((fn) => fn(state))
  }
  const active = () => tabs.find((tab) => tab.id === activeTabId)
  const sync = (tab: PreviewTab) => {
    tab.url = tab.history[tab.index]
    tab.title = titleFor(tab.url)
    tab.canGoBack = tab.index > 0
    tab.canGoForward = tab.index < tab.history.length - 1
    tab.isLoading = true
    emit()
    window.setTimeout(() => {
      tab.isLoading = false
      emit()
    }, 350)
  }

  const createTab = (url = 'https://www.google.com') => {
    const id = `tab-${next++}`
    const normalized = normalizeUrl(url)
    tabs.push({ id, title: titleFor(normalized), url: normalized, isLoading: false, canGoBack: false, canGoForward: false, history: [normalized], index: 0 })
    activeTabId = id
    sync(tabs[tabs.length - 1])
    return id
  }

  const api: BrowserAPI = {
    getState: async () => snapshot(),
    toggleFavorite: async () => {
      const url = active()?.url
      if (!url || !/^https?:/i.test(url)) return
      if (!favorites.delete(url)) favorites.add(url)
      emit()
    },
    openFavorite: async (url) => {
      if (!favorites.has(url)) return
      const ouvert = tabs.find((tab) => tab.url === url)
      if (ouvert) {
        activeTabId = ouvert.id
        emit()
      } else createTab(url)
    },
    createTab: async (url) => createTab(url),
    closeTab: async (id) => {
      const index = tabs.findIndex((tab) => tab.id === id)
      if (index === -1) return
      tabs.splice(index, 1)
      if (activeTabId === id) activeTabId = tabs[Math.min(index, tabs.length - 1)]?.id ?? null
      if (!tabs.length) createTab()
      else emit()
    },
    activateTab: async (id) => {
      if (!tabs.some((tab) => tab.id === id)) return
      activeTabId = id
      emit()
    },
    navigate: async (url) => {
      const tab = active()
      if (!tab) return
      tab.history = tab.history.slice(0, tab.index + 1)
      tab.history.push(normalizeUrl(url))
      tab.index = tab.history.length - 1
      sync(tab)
    },
    goBack: async () => {
      const tab = active()
      if (tab && tab.index > 0) { tab.index--; sync(tab) }
    },
    goForward: async () => {
      const tab = active()
      if (tab && tab.index < tab.history.length - 1) { tab.index++; sync(tab) }
    },
    reload: async () => {
      const tab = active()
      if (tab) sync(tab)
    },
    setContentBounds: () => {},
    getSystemTheme: async () => systemTheme(),
    onSystemTheme: (callback) => {
      themeListeners.add(callback)
      return () => themeListeners.delete(callback)
    },
    onState: (callback) => {
      stateListeners.add(callback)
      return () => stateListeners.delete(callback)
    },
    // Mêmes transitions que agirSurBarre dans le processus principal (shared/barre.ts).
    getSidebar: async () => ({ ...sidebar }),
    setSidebar: async (action) => setSidebarState(transitionBarre(sidebar, action)),
    setSidebarWidth: async (width) => setSidebarState({ ...sidebar, width: borneLargeurBarre(width) }),
    onSidebar: (callback) => {
      sidebarListeners.add(callback)
      return () => sidebarListeners.delete(callback)
    },
    getOverlay: async () => overlay,
    setOverlay: async (open) => {
      if (open === overlay) return
      overlay = open
      overlayListeners.forEach((fn) => fn(overlay))
    },
    onOverlay: (callback) => {
      overlayListeners.add(callback)
      return () => overlayListeners.delete(callback)
    },
    // Pas de suggestions dans l'aperçu : elles s'affichent dans la vue de la barre, absente ici (ARB-53).
    suggest: async () => undefined,
    moveSuggestion: async () => undefined,
    chooseSuggestion: async () => false,
    closeSuggestions: async () => undefined,
    getSuggestions: async () => null,
    onSuggestions: () => () => undefined,
    // Pas de recherche dans l'aperçu : la page y est simulée, Ctrl+F est celui du navigateur.
    findInPage: async () => undefined,
    closeFind: async () => undefined,
    onFindResult: () => () => undefined,
    onFindFocus: () => () => undefined,
    getTheme: async () => theme,
    setTheme: async (choice) => {
      theme = choice
      themeChoiceListeners.forEach((fn) => fn(theme))
    },
    onTheme: (callback) => {
      themeChoiceListeners.add(callback)
      return () => themeChoiceListeners.delete(callback)
    },
    // Dans l'aperçu, Ctrl+L est traité par la page elle-même (MainView) : rien ne l'émet.
    onFocusAddress: () => () => undefined,
    // L'aperçu ne garde pas de session : jamais d'invite de restauration.
    getRestoreOffer: async () => false,
    onRestoreOffer: () => () => undefined,
    answerRestoreOffer: async () => undefined,
    // Ni base ni incident dans l'aperçu.
    getDataIncident: async () => null,
    onDataIncident: () => () => undefined,
    dismissDataIncident: async () => undefined
  }

  createTab('https://www.google.com')
  createTab('https://github.com')
  createTab('https://react.dev')
  activeTabId = tabs[0].id
  window.arbalete = api
  return true
}

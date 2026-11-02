export type BrowserTab = {
  id: string
  title: string
  url: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  favicon?: string
}

export type BrowserState = {
  tabs: BrowserTab[]
  activeTabId: string | null
}

// Barre latérale (ARB-33) : masquée par défaut, ouverte par-dessus la page au survol du bord gauche ;
// épinglée, elle reste ouverte et la page lui laisse sa place.
export type SidebarState = {
  open: boolean
  pinned: boolean
}

export type SidebarAction = 'open' | 'hide' | 'toggle-pin'

export type ThemeChoice = 'system' | 'dark' | 'light'

export type BrowserAPI = {
  getState: () => Promise<BrowserState>
  createTab: (url?: string) => Promise<string>
  closeTab: (id: string) => Promise<void>
  activateTab: (id: string) => Promise<void>
  navigate: (url: string) => Promise<void>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  reload: () => Promise<void>
  setContentBounds: (bounds: { x: number; y: number; width: number; height: number }) => void
  getSystemTheme: () => Promise<'dark' | 'light'>
  onSystemTheme: (callback: (theme: 'dark' | 'light') => void) => () => void
  onState: (callback: (state: BrowserState) => void) => () => void
  getSidebar: () => Promise<SidebarState>
  setSidebar: (action: SidebarAction) => Promise<void>
  onSidebar: (callback: (state: SidebarState) => void) => () => void
  getTheme: () => Promise<ThemeChoice>
  setTheme: (choice: ThemeChoice) => Promise<void>
  onTheme: (callback: (choice: ThemeChoice) => void) => () => void
}

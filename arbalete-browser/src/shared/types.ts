export type BrowserTab = {
  id: string
  title: string
  url: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  favicon?: string
  // États visuels de l'onglet (ARB-124). pinned : pas encore de commande pour épingler un onglet.
  pinned?: boolean
  audible?: boolean
  muted?: boolean
  error?: boolean
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

// Réponse à l'invite de restauration qui suit un arrêt forcé (ARB-46).
export type RestoreAnswer = 'restore' | 'dismiss'

// Incident de la base à l'ouverture (ARB-119) : illisible et mise de côté sous le nom backup, plus récente que cette
// version d'Arbalète, ou indisponible. Dans les deux derniers cas, rien n'est conservé pendant la session.
export type DataIncident = { kind: 'corrupted', backup: string, restored: boolean } | { kind: 'newer' } | { kind: 'unavailable' }

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
  // Couche d'overlays (ARB-39) : vrai tant que la vue de la barre couvre la fenêtre pour un menu ou une palette. Seule
  // la vue de la barre peut l'ouvrir ou le fermer ; le processus principal le ferme aussi (Échap, raccourci, focus perdu).
  getOverlay: () => Promise<boolean>
  setOverlay: (open: boolean) => Promise<void>
  onOverlay: (callback: (open: boolean) => void) => () => void
  getTheme: () => Promise<ThemeChoice>
  setTheme: (choice: ThemeChoice) => Promise<void>
  onTheme: (callback: (choice: ThemeChoice) => void) => () => void
  // Ctrl+L pressé hors de la fenêtre (page, barre latérale) : la fenêtre sélectionne sa barre d'adresse.
  onFocusAddress: (callback: () => void) => () => void
  // Invite de restauration (ARB-46) : vraie tant qu'une session interrompue par un arrêt forcé attend une réponse.
  getRestoreOffer: () => Promise<boolean>
  onRestoreOffer: (callback: (offer: boolean) => void) => () => void
  answerRestoreOffer: (answer: RestoreAnswer) => Promise<void>
  // Incident de la base (ARB-119) : null une fois l'avertissement fermé, ou s'il n'y en a pas.
  getDataIncident: () => Promise<DataIncident | null>
  onDataIncident: (callback: (incident: DataIncident | null) => void) => () => void
  dismissDataIncident: () => Promise<void>
}

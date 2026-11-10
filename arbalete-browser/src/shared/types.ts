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

// Barre latérale (ARB-33, ARB-123) : masquée par défaut, ouverte par-dessus la page au survol du bord gauche ;
// épinglée, elle reste ouverte et la page lui laisse sa place, étendue (width) ou compacte (icônes seules).
export type SidebarState = {
  open: boolean
  pinned: boolean
  compact: boolean
  width: number
}

export type SidebarAction = 'open' | 'hide' | 'toggle-pin' | 'toggle-compact'

export type ThemeChoice = 'system' | 'dark' | 'light'

// Réponse à l'invite de restauration qui suit un arrêt forcé (ARB-46).
export type RestoreAnswer = 'restore' | 'dismiss'

// Incident de la base à l'ouverture (ARB-119) : illisible et mise de côté sous le nom backup, plus récente que cette
// version d'Arbalète, ou indisponible. Dans les deux derniers cas, rien n'est conservé pendant la session.
export type DataIncident = { kind: 'corrupted', backup: string, restored: boolean } | { kind: 'newer' } | { kind: 'unavailable' }

// Suggestions de la barre d'adresse (ARB-53) : une ligne est ce que ferait Entrée (chercher ou aller à l'adresse) ou une
// page déjà visitée. `selection` vaut -1 tant qu'aucune ligne n'est choisie aux flèches ; `anchor` est le champ, en
// coordonnées de la fenêtre, sous lequel la liste s'affiche.
export type Suggestion = { kind: 'recherche' | 'adresse' | 'historique', titre: string, url: string }
export type SuggestionsState = { items: Suggestion[], selection: number, anchor: { x: number, y: number, width: number, height: number } }

// Résultat de la recherche dans la page (ARB-70) : rang du résultat actif (1 à total, 0 sans résultat) et nombre total.
export type FindResult = { active: number, total: number }

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
  // Largeur de la barre étendue (ARB-123) : bornée côté processus principal, conservée au redémarrage.
  setSidebarWidth: (width: number) => Promise<void>
  // Couche d'overlays (ARB-39) : vrai tant que la vue de la barre couvre la fenêtre pour un menu ou une palette. Seule
  // la vue de la barre peut l'ouvrir ou le fermer ; le processus principal le ferme aussi (Échap, raccourci, focus perdu).
  getOverlay: () => Promise<boolean>
  setOverlay: (open: boolean) => Promise<void>
  onOverlay: (callback: (open: boolean) => void) => () => void
  // Suggestions de la barre d'adresse (ARB-53). Le champ de la fenêtre garde le clavier : il envoie le texte (`suggest`) et
  // les flèches (`moveSuggestion`), le processus principal tient la liste, ouvre l'overlay et la diffuse à la vue de la
  // barre, qui l'affiche. Un texte vide ou `closeSuggestions` ferme la liste ; `chooseSuggestion` ouvre la ligne donnée
  // (clic) ou la ligne choisie aux flèches (Entrée) ; faux si aucune ligne n'a été ouverte.
  suggest: (text: string, anchor: { x: number, y: number, width: number, height: number }) => Promise<void>
  moveSuggestion: (step: 1 | -1) => Promise<void>
  chooseSuggestion: (index?: number) => Promise<boolean>
  closeSuggestions: () => Promise<void>
  getSuggestions: () => Promise<SuggestionsState | null>
  onSuggestions: (callback: (state: SuggestionsState | null) => void) => () => void
  // Recherche dans la page (ARB-70), pilotée par la seule vue de la recherche. `next` : continuer la recherche en cours
  // (Entrée) plutôt que la recommencer (frappe) ; `forward` faux remonte. Un texte vide efface les résultats.
  findInPage: (text: string, forward: boolean, next: boolean) => Promise<void>
  closeFind: () => Promise<void>
  onFindResult: (callback: (result: FindResult) => void) => () => void
  // Le champ reprend le clavier et sélectionne son texte (Ctrl+F sur une recherche ouverte). `reopened` : la recherche
  // vient de s'ouvrir, le champ et le compteur sont vidés.
  onFindFocus: (callback: (reopened: boolean) => void) => () => void
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

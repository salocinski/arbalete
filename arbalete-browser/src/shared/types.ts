import type { Espace } from './espaces'
import type { ChoixMoteur } from './moteurs'
import type { Telechargement } from './telechargements'
import type { EntreeMenuPage, MenuPage } from './menuPage'
import type { ActionOnglet } from './menuOnglet'
import type { EntreePalette } from './palette'
import type { ListeFavoris } from './favoris'
import type { PeriodeEffacement, TypeEffacement, VisiteHistorique } from './historique'

export type BrowserTab = {
  id: string
  title: string
  url: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  favicon?: string
  // États visuels de l'onglet (ARB-124). 
  pinned?: boolean // épinglé par le menu de l'onglet (ARB-41)
  audible?: boolean
  muted?: boolean
  error?: boolean
}

export type BrowserState = {
  // Onglets de l'espace actif seulement (ARB-61) ; ceux des autres espaces restent ouverts, masqués.
  tabs: BrowserTab[]
  activeTabId: string | null
  // Espaces de travail dans leur ordre et id de l'actif (ARB-61) ; vides et null si la base est indisponible.
  workspaces: Espace[]
  activeWorkspaceId: number | null
  // La page de l'onglet actif est un favori (ARB-47) : faux pour une page hors du web (adresse non enregistrable).
  favorite: boolean
  // Grille de favoris en haut de la barre latérale (ARB-49) : les 8 premiers favoris, adresse d'historique et titre.
  favorites: { url: string; title: string }[]
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
  tabAction: (id: string, action: ActionOnglet) => Promise<void>
  moveTab: (id: string, index: number) => Promise<void>
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
  // Menu contextuel des pages (ARB-40) : le processus principal le décide et l'ouvre au clic droit dans la page ; la vue de
  // la barre l'affiche et ne renvoie que l'entrée choisie (`pageMenuAction`), qui ferme l'overlay.
  getPageMenu: () => Promise<MenuPage | null>
  onPageMenu: (callback: (menu: MenuPage | null) => void) => () => void
  pageMenuAction: (entree: EntreeMenuPage) => Promise<void>
  // Palette de commandes Ctrl+K (ARB-67) : le processus principal l'ouvre au raccourci (ou à `openPalette`, bouton « Rechercher »),
  // garde les lignes proposées et les diffuse (null : fermée) ; le champ de la vue de la barre envoie son texte
  // (`searchPalette`) et l'index de la ligne choisie (`choosePalette`), qui ferme l'overlay et agit. Index hors liste : sans effet.
  getPalette: () => Promise<EntreePalette[] | null>
  onPalette: (callback: (lignes: EntreePalette[] | null) => void) => () => void
  openPalette: () => Promise<void>
  searchPalette: (text: string) => Promise<void>
  choosePalette: (index: number, cle: string) => Promise<void>
  // Panneau Historique (ARB-52) : visites les plus récentes d'abord, filtrées par le texte (mots dans l'adresse ou le titre).
  // `openHistoryPage` ouvre une page déjà visitée dans un nouvel onglet et ferme l'overlay ; une adresse inconnue est refusée.
  // Seule la vue de la barre, qui affiche le panneau, les appelle.
  searchHistory: (text: string) => Promise<VisiteHistorique[]>
  openHistoryPage: (url: string) => Promise<void>
  // Effacement (ARB-54) : l'historique depuis la période choisie ; cookies et cache, en entier. Période et types hors listes refusés.
  clearBrowsingData: (period: PeriodeEffacement, types: TypeEffacement[]) => Promise<void>
  // Recherche dans la page (ARB-70), pilotée par la seule vue de la recherche. `next` : continuer la recherche en cours
  // (Entrée) plutôt que la recommencer (frappe) ; `forward` faux remonte. Un texte vide efface les résultats.
  findInPage: (text: string, forward: boolean, next: boolean) => Promise<void>
  closeFind: () => Promise<void>
  onFindResult: (callback: (result: FindResult) => void) => () => void
  // Le champ reprend le clavier et sélectionne son texte (Ctrl+F sur une recherche ouverte). `reopened` : la recherche
  // vient de s'ouvrir, le champ et le compteur sont vidés.
  onFindFocus: (callback: (reopened: boolean) => void) => () => void
  // Ajoute la page de l'onglet actif aux favoris, ou l'en retire (ARB-47) ; sans effet sur une page hors du web. L'état
  // `favorite` en rend compte.
  toggleFavorite: () => Promise<void>
  // Active l'onglet ouvert sur ce favori, ou l'ouvre dans un nouvel onglet (ARB-49) ; sans effet si ce n'est pas un favori.
  openFavorite: (url: string) => Promise<void>
  // Panneau des favoris (ARB-48), vue de la barre seule : tous les favoris et les dossiers ; créer, renommer, supprimer un
  // dossier (ses favoris reviennent à la racine), ranger un favori dans un dossier (null : racine) ou le retirer. Un nom
  // invalide ou un id inconnu est refusé ; `listFavorites` rend la liste à jour.
  listFavorites: () => Promise<ListeFavoris>
  createFavoriteFolder: (nom: string) => Promise<void>
  renameFavoriteFolder: (id: number, nom: string) => Promise<void>
  deleteFavoriteFolder: (id: number) => Promise<void>
  moveFavorite: (id: number, dossier: number | null) => Promise<void>
  removeFavorite: (id: number) => Promise<void>
  // Passe à cet espace (ARB-61) : ses onglets remplacent ceux affichés, son dernier onglet actif reprend la page ; un espace
  // sans onglet en ouvre un. Sans effet si l'espace est inconnu ou déjà actif.
  setWorkspace: (id: number) => Promise<void>
  // Gestion des espaces (ARB-62). `createWorkspace` ajoute un espace en fin de liste et l'affiche ; `renameWorkspace` ne change
  // que le nom ; `moveWorkspace` décale d'un cran (-1 haut, 1 bas) ; `deleteWorkspace` ferme ses onglets et refuse de supprimer
  // le dernier espace. Un nom vide ou trop long, un espace inconnu sont refusés ou sans effet.
  createWorkspace: (name: string) => Promise<void>
  renameWorkspace: (id: number, name: string) => Promise<void>
  moveWorkspace: (id: number, direction: -1 | 1) => Promise<void>
  deleteWorkspace: (id: number) => Promise<void>
  // Couleur d'un espace (ARB-134) : le nom d'une couleur de `COULEURS_ESPACE` ; un nom hors liste est refusé, un espace
  // inconnu est sans effet.
  setWorkspaceColor: (id: number, color: string) => Promise<void>
  // Téléchargements (ARB-55) : enregistrés sans invite dans le dossier Téléchargements, du plus récent au plus ancien, et
  // conservés au redémarrage (un téléchargement alors actif devient `interrompu`). Pause, reprise et annulation ne
  // concernent qu'un téléchargement actif ; `removeDownload` retire une ligne terminée de la liste, sans effacer le fichier.
  getDownloads: () => Promise<Telechargement[]>
  onDownloads: (callback: (downloads: Telechargement[]) => void) => () => void
  pauseDownload: (id: number) => Promise<void>
  resumeDownload: (id: number) => Promise<void>
  cancelDownload: (id: number) => Promise<void>
  removeDownload: (id: number) => Promise<void>
  // ARB-56 : ouvre le fichier d'un téléchargement terminé avec son application par défaut (refusé pour un exécutable) ou
  // le montre dans l'Explorateur ; sans effet si le téléchargement n'est pas terminé ou si le fichier a disparu.
  openDownload: (id: number) => Promise<void>
  revealDownload: (id: number) => Promise<void>
  getTheme: () => Promise<ThemeChoice>
  setTheme: (choice: ThemeChoice) => Promise<void>
  onTheme: (callback: (choice: ThemeChoice) => void) => () => void
  // Moteur de recherche de la barre d'adresse (ARB-58) ; un choix invalide est refusé par le processus principal.
  getSearchEngine: () => Promise<ChoixMoteur>
  setSearchEngine: (choix: ChoixMoteur) => Promise<void>
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

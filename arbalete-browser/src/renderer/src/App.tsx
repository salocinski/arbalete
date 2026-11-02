import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, RotateCw, Plus, Search,
  Pin, PinOff, X, Command, Star, Clock3, Settings2, Sparkles, Layers3, GitBranch,
  Globe2, ChevronDown, Download, ShieldCheck, Moon, Sun, Monitor
} from 'lucide-react'
import type { BrowserState, BrowserTab, SidebarState, ThemeChoice } from '../../shared/types'
import { isPreviewMode } from './previewApi'

const starterState: BrowserState = {
  tabs: [
    { id: 'demo-1', title: 'Bienvenue sur Arbalète', url: 'https://www.google.com', isLoading: false, canGoBack: false, canGoForward: false },
    { id: 'demo-2', title: 'Documentation Electron', url: 'https://www.electronjs.org', isLoading: false, canGoBack: true, canGoForward: false },
    { id: 'demo-3', title: 'React — bibliothèque UI', url: 'https://react.dev', isLoading: false, canGoBack: false, canGoForward: false }
  ],
  activeTabId: 'demo-1'
}

const workspaces = [
  { id: 'dev', name: 'Développement', color: '#a78bfa', icon: '⌘' },
  { id: 'personal', name: 'Personnel', color: '#5eead4', icon: '✳' },
  { id: 'research', name: 'Recherche', color: '#fbbf24', icon: '◈' }
]

// La barre latérale vit dans sa propre vue native, chargée avec ?vue=barre (ARB-33).
const vueBarre = new URLSearchParams(window.location.search).get('vue') === 'barre'

function displayHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function useBrowserState(): BrowserState {
  const [state, setState] = useState<BrowserState>(starterState)
  useEffect(() => {
    void window.arbalete.getState().then((next) => {
      if (next.tabs.length) setState(next)
    }).catch(() => {})
    return window.arbalete.onState((next) => setState(next))
  }, [])
  return state
}

function useSidebar(): SidebarState {
  const [sidebar, setSidebar] = useState<SidebarState>({ open: false, pinned: false })
  useEffect(() => {
    void window.arbalete.getSidebar().then(setSidebar).catch(() => {})
    return window.arbalete.onSidebar(setSidebar)
  }, [])
  return sidebar
}

// Choix de thème tenu par le processus principal, partagé par la fenêtre et la barre latérale.
function useTheme(): { choice: ThemeChoice; effective: 'dark' | 'light' } {
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

// Raccourcis d'onglets communs à la fenêtre et à la barre latérale : chacune est un document distinct, qui ne
// reçoit les touches que lorsqu'il a le focus. Renvoie true si la touche a été traitée.
function handleTabShortcut(event: KeyboardEvent, activeTabId: string | null): boolean {
  const mod = event.ctrlKey || event.metaKey
  if (mod && event.key.toLowerCase() === 't') {
    event.preventDefault()
    void window.arbalete.createTab()
  } else if (mod && event.key.toLowerCase() === 'w') {
    event.preventDefault()
    if (activeTabId) void window.arbalete.closeTab(activeTabId)
  } else if (event.altKey && event.key === 'ArrowLeft') {
    void window.arbalete.goBack()
  } else if (event.altKey && event.key === 'ArrowRight') {
    void window.arbalete.goForward()
  } else {
    return false
  }
  return true
}

export default function App() {
  return vueBarre ? <SidebarView /> : <MainView />
}

function SidebarView() {
  const state = useBrowserState()
  const sidebar = useSidebar()
  const theme = useTheme()
  useEffect(() => { document.documentElement.classList.add('vue-barre') }, [])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { handleTabShortcut(event, state.activeTabId) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.activeTabId])
  return <Sidebar state={state} sidebar={sidebar} theme={theme.effective} />
}

function MainView() {
  const state = useBrowserState()
  const sidebar = useSidebar()
  const theme = useTheme()
  const [address, setAddress] = useState('https://www.google.com')
  const [addressFocused, setAddressFocused] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId)

  useEffect(() => {
    if (!addressFocused && activeTab) setAddress(activeTab.url)
  }, [activeTab?.id, activeTab?.url, addressFocused])

  const syncBounds = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    window.arbalete.setContentBounds({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    })
  }, [])

  useEffect(() => {
    const observer = new ResizeObserver(syncBounds)
    if (contentRef.current) observer.observe(contentRef.current)
    window.addEventListener('resize', syncBounds)
    const raf = requestAnimationFrame(syncBounds)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncBounds)
      cancelAnimationFrame(raf)
    }
  }, [syncBounds, sidebar.pinned])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (handleTabShortcut(event, state.activeTabId)) return
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        addressRef.current?.focus()
        addressRef.current?.select()
      } else if (mod && event.shiftKey && event.key.toLowerCase() === 'b') {
        // Aperçu web seulement : dans Electron, le processus principal intercepte Ctrl+Maj+B avant la page.
        event.preventDefault()
        void window.arbalete.setSidebar('toggle-pin')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.activeTabId])

  const navigate = () => {
    const value = address.trim()
    if (value) {
      void window.arbalete.navigate(value)
      addressRef.current?.blur()
    }
  }

  const isDemo = state.activeTabId?.startsWith('demo-') ?? false
  const nextTheme: Record<ThemeChoice, ThemeChoice> = { system: 'dark', dark: 'light', light: 'system' }

  return (
    <main className={`app-shell theme-${theme.effective}`}>
      {/* Épinglée, la barre latérale (vue native au-dessus) prend cette place au lieu de recouvrir la page. */}
      {sidebar.pinned && <div className="sidebar-reserve" />}
      {/* Aperçu web : pas de vue native, la barre est rendue ici, par-dessus la page. */}
      {isPreviewMode() && <Sidebar state={state} sidebar={sidebar} theme={theme.effective} />}

      <section className="browser-column" onMouseDown={() => { if (isPreviewMode()) void window.arbalete.setSidebar('hide') }}>
        <header className="toolbar">
          <div className="nav-controls">
            <button className="icon-button" title={sidebar.pinned ? 'Libérer la barre latérale (Ctrl+Maj+B)' : 'Épingler la barre latérale (Ctrl+Maj+B)'} onClick={() => void window.arbalete.setSidebar('toggle-pin')}>
              {sidebar.pinned ? <PinOff size={16}/> : <Pin size={16}/>}
            </button>
            <button className="icon-button" title="Précédent (Alt+←)" onClick={() => void window.arbalete.goBack()} disabled={!activeTab?.canGoBack}><ArrowLeft size={17}/></button>
            <button className="icon-button" title="Suivant (Alt+→)" onClick={() => void window.arbalete.goForward()} disabled={!activeTab?.canGoForward}><ArrowRight size={17}/></button>
            <button className="icon-button" title="Recharger" onClick={() => void window.arbalete.reload()}><RotateCw size={15}/></button>
          </div>
          <form className={`address-bar ${addressFocused ? 'is-focused' : ''}`} onSubmit={(event) => { event.preventDefault(); navigate() }}>
            <ShieldCheck size={15} className="secure-icon"/>
            <input ref={addressRef} value={address} onChange={(event) => setAddress(event.target.value)} onFocus={() => setAddressFocused(true)} onBlur={() => setAddressFocused(false)} aria-label="Adresse ou recherche" spellCheck={false}/>
            <button type="button" className="address-action" title="Ajouter aux favoris"><Star size={15}/></button>
          </form>
          <button className="icon-button toolbar-action" title="Nouvel onglet" onClick={() => void window.arbalete.createTab()}><Plus size={18}/></button>
          <button className="icon-button toolbar-action" title="Thème : changer le mode" onClick={() => void window.arbalete.setTheme(nextTheme[theme.choice])}>
            {theme.choice === 'system' ? <Monitor size={16}/> : theme.choice === 'dark' ? <Moon size={16}/> : <Sun size={16}/>}
          </button>
        </header>

        <div className="page-stage">
          <div className={`web-content ${isDemo ? 'demo-placeholder' : ''}`} ref={contentRef}>
            {!isDemo && isPreviewMode() && activeTab && (
              <div className="preview-frame" data-testid="preview-frame">
                <p className="eyebrow">APERÇU NAVIGATEUR</p>
                <h2>{activeTab.isLoading ? 'Chargement…' : activeTab.title}</h2>
                <code>{activeTab.url}</code>
                <p>Contenu web simulé : dans Electron, la page réelle s'affiche ici.</p>
              </div>
            )}
            {isDemo && (
              <div className="welcome-card">
                <div className="welcome-orb"><Sparkles size={26}/></div>
                <p className="eyebrow">VOTRE ESPACE WEB</p>
                <h1>Le web, <span>à votre façon.</span></h1>
                <p className="welcome-description">Arbalète rassemble vos onglets, vos projets et vos habitudes dans un espace de navigation calme et personnalisé.</p>
                <form className="welcome-search" onSubmit={(event) => { event.preventDefault(); navigate() }}>
                  <Search size={18}/>
                  <input value={address} onChange={(event) => setAddress(event.target.value)} onFocus={() => { setAddressFocused(true); addressRef.current?.focus() }} placeholder="Rechercher ou saisir une adresse"/>
                  <button type="submit">Explorer <ArrowRight size={15}/></button>
                </form>
                <div className="quick-links">
                  <button onClick={() => { setAddress('https://github.com'); void window.arbalete.navigate('https://github.com') }}><span className="quick-icon github"><GitBranch size={18}/></span><span>GitHub</span></button>
                  <button onClick={() => { setAddress('https://www.electronjs.org'); void window.arbalete.navigate('https://www.electronjs.org') }}><span className="quick-icon electron"><Layers3 size={18}/></span><span>Electron</span></button>
                  <button onClick={() => { setAddress('https://react.dev'); void window.arbalete.navigate('https://react.dev') }}><span className="quick-icon react"><Globe2 size={18}/></span><span>React</span></button>
                  <button onClick={() => void window.arbalete.createTab()}><span className="quick-icon add"><Plus size={18}/></span><span>Nouvel onglet</span></button>
                </div>
                <div className="prototype-note"><span className="pulse-dot"/> Maquette fonctionnelle <span>·</span> moteur Chromium intégré</div>
              </div>
            )}
          </div>
          {isDemo && <div className="stage-footer"><span>arbalète <span className="footer-separator">/</span> votre navigateur, votre espace</span><span><Command size={12}/> K pour rechercher</span></div>}
        </div>
        <footer className="statusbar">
          <div><span className="status-dot"/>{activeTab?.isLoading ? 'Chargement…' : activeTab ? displayHost(activeTab.url) : 'Prêt'}</div>
          <div className="status-right"><span>Version prototype 0.1</span><span className="status-divider"/><span>Windows</span></div>
        </footer>
      </section>
    </main>
  )
}

// Masquée, la barre n'est qu'une bande de survol au bord gauche ; ouverte, elle recouvre la page.
// Elle se retire quand la souris la quitte, sauf si elle est épinglée ou si le focus y est (champ, menu).
function Sidebar({ state, sidebar, theme }: { state: BrowserState; sidebar: SidebarState; theme: 'dark' | 'light' }) {
  const [workspace, setWorkspace] = useState('dev')
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const zoneRef = useRef<HTMLDivElement>(null)
  const activeWorkspace = workspaces.find((item) => item.id === workspace) ?? workspaces[0]

  // L'utilisateur y travaille encore : menu des espaces ouvert ou champ de saisie actif. Un simple clic sur un bouton
  // (onglet, nouvel onglet) ne la retient pas : sinon elle resterait sur la page après le geste principal.
  const keepOpen = () => {
    const active = document.activeElement
    return showWorkspaceMenu || (!!active && active.matches('input, textarea, select') && !!zoneRef.current?.contains(active))
  }

  useEffect(() => {
    if (!sidebar.open) setShowWorkspaceMenu(false)
  }, [sidebar.open])

  const onMouseLeave = () => {
    if (!sidebar.pinned && !keepOpen()) void window.arbalete.setSidebar('hide')
  }

  return (
    <div ref={zoneRef} className={`sidebar-zone theme-${theme}`}
      onMouseEnter={() => { if (!sidebar.open) void window.arbalete.setSidebar('open') }}
      onMouseLeave={onMouseLeave}>
      {!sidebar.open ? <div className="sidebar-hover-strip" data-testid="sidebar-hover-strip" /> : (
        <aside className="sidebar">
          <div className="brand-row">
            <div className="brand-mark">a<span>.</span></div>
            <span className="brand-name">arbalète</span>
            <button className="icon-button sidebar-toggle" title={sidebar.pinned ? 'Libérer la barre latérale (Ctrl+Maj+B)' : 'Épingler la barre latérale (Ctrl+Maj+B)'} onClick={() => void window.arbalete.setSidebar('toggle-pin')}>
              {sidebar.pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
          </div>

          <button className="workspace-switcher" onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}>
            <span className="workspace-dot" style={{ background: activeWorkspace.color }} />
            <span>{activeWorkspace.name}</span>
            <ChevronDown size={14} className="muted-icon" />
          </button>
          {showWorkspaceMenu && <div className="workspace-menu">
            {workspaces.map((item) => <button key={item.id} onClick={() => { setWorkspace(item.id); setShowWorkspaceMenu(false) }}>
              <span className="workspace-dot" style={{ background: item.color }} />{item.name}
            </button>)}
          </div>}

          <nav className="sidebar-nav">
            <button className="nav-item"><Search size={16} /><span>Rechercher</span><kbd>⌘ K</kbd></button>
            <button className="nav-item"><Star size={16} /><span>Favoris</span></button>
            <button className="nav-item"><Clock3 size={16} /><span>Historique</span></button>
          </nav>

          <div className="section-heading"><span>ONGLETS</span><button className="tiny-icon" title="Nouvel onglet" onClick={() => void window.arbalete.createTab()}><Plus size={15}/></button></div>
          <div className="tab-list">
            {state.tabs.map((tab) => <TabItem key={tab.id} tab={tab} active={tab.id === state.activeTabId} onSelect={() => void window.arbalete.activateTab(tab.id)} onClose={() => void window.arbalete.closeTab(tab.id)} />)}
          </div>
          <button className="new-tab-button" onClick={() => void window.arbalete.createTab()}><Plus size={16}/><span>Nouvel onglet</span><kbd>Ctrl T</kbd></button>
          <div className="sidebar-spacer" />
          <div className="sidebar-bottom">
            <button className="nav-item"><Download size={16}/><span>Téléchargements</span></button>
            <button className="nav-item"><Settings2 size={16}/><span>Paramètres</span></button>
            <div className="profile-row"><div className="avatar">A</div><div className="profile-copy"><strong>Profil local</strong><span>Synchronisation inactive</span></div><ChevronDown size={14}/></div>
          </div>
        </aside>
      )}
    </div>
  )
}

function TabItem({ tab, active, onSelect, onClose }: { tab: BrowserTab; active: boolean; onSelect: () => void; onClose: () => void }) {
  return (
    <div className={`tab-item ${active ? 'active' : ''}`}>
      <button className="tab-select" onClick={onSelect}>
        <span className={`tab-favicon ${tab.isLoading ? 'loading' : ''}`}><Globe2 size={14}/></span>
        <span className="tab-title">{tab.title}</span>
        {tab.url.startsWith('https://') && <span className="tab-secure"><ShieldCheck size={12}/></span>}
      </button>
      <button className="tab-close" title="Fermer l'onglet" onClick={(event) => { event.stopPropagation(); onClose() }}><X size={14}/></button>
    </div>
  )
}

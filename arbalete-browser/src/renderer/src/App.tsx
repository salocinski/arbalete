import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, RotateCw, Plus, Search, PanelLeftClose, PanelLeftOpen,
  Pin, X, Command, Star, Clock3, Settings2, Sparkles, Layers3, GitBranch,
  Globe2, ChevronDown, Download, ShieldCheck, Moon, Sun, Monitor, ExternalLink
} from 'lucide-react'
import type { BrowserState, BrowserTab } from '../../shared/types'
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

function displayHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export default function App() {
  const [state, setState] = useState<BrowserState>(starterState)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [workspace, setWorkspace] = useState('dev')
  const [address, setAddress] = useState('https://www.google.com')
  const [addressFocused, setAddressFocused] = useState(false)
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('system')
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>('dark')
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId)

  useEffect(() => {
    void window.arbalete.getState().then((next) => {
      if (next.tabs.length) setState(next)
    }).catch(() => {})
    const unsubscribeState = window.arbalete.onState((next) => setState(next))
    void window.arbalete.getSystemTheme().then(setSystemTheme).catch(() => {})
    const unsubscribeTheme = window.arbalete.onSystemTheme(setSystemTheme)
    return () => { unsubscribeState(); unsubscribeTheme() }
  }, [])

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
  }, [syncBounds, sidebarOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        addressRef.current?.focus()
        addressRef.current?.select()
      } else if (mod && event.key.toLowerCase() === 't') {
        event.preventDefault()
        void window.arbalete.createTab()
      } else if (mod && event.key.toLowerCase() === 'w') {
        event.preventDefault()
        if (state.activeTabId) void window.arbalete.closeTab(state.activeTabId)
      } else if (mod && event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setSidebarOpen((value) => !value)
      } else if (event.altKey && event.key === 'ArrowLeft') {
        void window.arbalete.goBack()
      } else if (event.altKey && event.key === 'ArrowRight') {
        void window.arbalete.goForward()
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
  const activeWorkspace = workspaces.find((item) => item.id === workspace) ?? workspaces[0]
  const effectiveTheme = theme === 'system' ? systemTheme : theme

  return (
    <main className={`app-shell theme-${effectiveTheme}`}>
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : 'is-collapsed'}`}>
        <div className="brand-row">
          <div className="brand-mark">a<span>.</span></div>
          {sidebarOpen && <span className="brand-name">arbalète</span>}
          <button className="icon-button sidebar-toggle" title={sidebarOpen ? 'Replier la barre latérale (Ctrl+Shift+B)' : 'Déployer la barre latérale'} onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
        </div>

        {sidebarOpen && (
          <>
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
          </>
        )}
        {!sidebarOpen && <div className="collapsed-icons">
          <button className="icon-button" title="Nouvel onglet" onClick={() => void window.arbalete.createTab()}><Plus size={18}/></button>
          <button className="icon-button" title="Favoris"><Star size={18}/></button>
          <button className="icon-button" title="Historique"><Clock3 size={18}/></button>
          <div className="sidebar-spacer"/>
          <button className="icon-button" title="Paramètres"><Settings2 size={18}/></button>
        </div>}
      </aside>

      <section className="browser-column">
        <header className="toolbar">
          <div className="nav-controls">
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
          <button className="icon-button toolbar-action" title="Thème : changer le mode" onClick={() => setTheme((current) => current === 'system' ? 'dark' : current === 'dark' ? 'light' : 'system')}>
            {theme === 'system' ? <Monitor size={16}/> : theme === 'dark' ? <Moon size={16}/> : <Sun size={16}/>}
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

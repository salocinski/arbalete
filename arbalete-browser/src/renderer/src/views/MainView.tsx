import { useCallback, useEffect, useRef, useState } from 'react'
import { StatusBar } from '../components/StatusBar'
import { Sidebar } from '../components/Sidebar'
import { Toolbar } from '../components/Toolbar'
import { StageFooter, WelcomeCard } from '../components/WelcomeCard'
import { isPreviewMode } from '../previewApi'
import { handleTabShortcut } from '../shortcuts'
import { useBrowserState, useSidebar, useTheme } from '../state'

// Document de la fenêtre : barre d'outils, emplacement de la page web (vue native alignée sur contentRef) et
// barre d'état.
export function MainView() {
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

  // Ctrl+L : le processus principal intercepte la touche où que soit le focus et demande la barre d'adresse (ARB-18).
  useEffect(() => window.arbalete.onFocusAddress(() => {
    addressRef.current?.focus()
    addressRef.current?.select()
  }), [])

  // Aperçu web seulement : dans Electron, le processus principal intercepte ces raccourcis avant la page (ARB-18).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (handleTabShortcut(event, state.activeTabId)) return
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        addressRef.current?.focus()
        addressRef.current?.select()
      } else if (mod && event.shiftKey && event.key.toLowerCase() === 'b') {
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

  const openUrl = (url: string) => {
    setAddress(url)
    void window.arbalete.navigate(url)
  }

  const isDemo = state.activeTabId?.startsWith('demo-') ?? false

  return (
    <main className={`app-shell theme-${theme.effective}`}>
      {/* Épinglée, la barre latérale (vue native au-dessus) prend cette place au lieu de recouvrir la page. */}
      {sidebar.pinned && <div className="sidebar-reserve" />}
      {/* Aperçu web : pas de vue native, la barre est rendue ici, par-dessus la page. */}
      {isPreviewMode() && <Sidebar state={state} sidebar={sidebar} theme={theme.effective} />}

      <section className="browser-column" onMouseDown={() => { if (isPreviewMode()) void window.arbalete.setSidebar('hide') }}>
        <Toolbar activeTab={activeTab} sidebarPinned={sidebar.pinned} themeChoice={theme.choice}
          address={address} addressFocused={addressFocused} addressRef={addressRef}
          onAddressChange={setAddress} onAddressFocusChange={setAddressFocused} onNavigate={navigate} />

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
              <WelcomeCard address={address} onAddressChange={setAddress}
                onAddressFocus={() => { setAddressFocused(true); addressRef.current?.focus() }}
                onNavigate={navigate} onOpenUrl={openUrl} />
            )}
          </div>
          {isDemo && <StageFooter />}
        </div>
        <StatusBar activeTab={activeTab} />
      </section>
    </main>
  )
}

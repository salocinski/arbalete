import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Clock3, Download, Plus, Search, Settings2, Star } from 'lucide-react'
import type { BrowserState, SidebarState } from '../../../shared/types'
import { useOverlay } from '../state'
import { MenuOverlay } from './Overlay'
import { PinButton } from './PinButton'
import { TabList } from './TabList'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

// Masquée, la barre n'est qu'une bande de survol au bord gauche ; ouverte, elle recouvre la page.
// Elle se retire quand la souris la quitte, sauf si elle est épinglée ou si le focus y est (champ, menu).
export function Sidebar({ state, sidebar, theme }: { state: BrowserState; sidebar: SidebarState; theme: 'dark' | 'light' }) {
  const [workspace, setWorkspace] = useState('dev')
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const zoneRef = useRef<HTMLDivElement>(null)
  // Menu d'un onglet (ARB-39) : demandé ici, affiché une fois que le processus principal a agrandi la vue, sinon il
  // serait coupé au bord de la barre le temps d'une image. Il disparaît avec l'overlay, quelle qu'en soit la cause.
  const overlay = useOverlay()
  const [menuOnglet, setMenuOnglet] = useState<{ tabId: string; x: number; y: number } | null>(null)
  const ongletDuMenu = menuOnglet && state.tabs.find((tab) => tab.id === menuOnglet.tabId)

  useEffect(() => {
    if (!overlay) setMenuOnglet(null)
  }, [overlay])

  // L'onglet a été fermé autrement (Ctrl+W, une page) : son menu n'a plus d'objet.
  useEffect(() => {
    if (menuOnglet && !ongletDuMenu) void window.arbalete.setOverlay(false)
  }, [menuOnglet, ongletDuMenu])

  const ouvrirMenuOnglet = (tabId: string, x: number, y: number) => {
    setMenuOnglet({ tabId, x, y })
    // Overlay refusé ou non ouvert : le menu ne doit pas ressurgir avec le prochain overlay.
    void window.arbalete.setOverlay(true).then(() => window.arbalete.getOverlay())
      .then((ouvert) => { if (!ouvert) setMenuOnglet(null) }, () => setMenuOnglet(null))
  }
  const fermerOverlay = () => void window.arbalete.setOverlay(false)

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

  // Sans tester sidebar.open : juste après un retrait, cette vue peut ne pas avoir encore reçu l'état fermé, et une
  // entrée rapide de la souris serait ignorée. Le processus principal ne fait rien si la barre est déjà ouverte.
  return (
    <div ref={zoneRef} className={`sidebar-zone theme-${theme}`}
      onMouseEnter={() => void window.arbalete.setSidebar('open')}
      onMouseLeave={onMouseLeave}>
      {!sidebar.open ? <div className="sidebar-hover-strip" data-testid="sidebar-hover-strip" /> : (
        <aside className="sidebar">
          <div className="brand-row">
            <div className="brand-mark">a<span>.</span></div>
            <span className="brand-name">arbalète</span>
            <PinButton pinned={sidebar.pinned} className="icon-button sidebar-toggle" />
          </div>

          <WorkspaceSwitcher workspace={workspace} onWorkspaceChange={setWorkspace} menuOpen={showWorkspaceMenu} onMenuOpenChange={setShowWorkspaceMenu} />

          <nav className="sidebar-nav">
            <button className="nav-item"><Search size={16} /><span>Rechercher</span><kbd>⌘ K</kbd></button>
            <button className="nav-item"><Star size={16} /><span>Favoris</span></button>
            <button className="nav-item"><Clock3 size={16} /><span>Historique</span></button>
          </nav>

          <div className="section-heading"><span>ONGLETS</span><button className="tiny-icon" title="Nouvel onglet" onClick={() => void window.arbalete.createTab()}><Plus size={15}/></button></div>
          <TabList state={state} onMenu={ouvrirMenuOnglet} />
          <button className="new-tab-button" onClick={() => void window.arbalete.createTab()}><Plus size={16}/><span>Nouvel onglet</span><kbd>Ctrl T</kbd></button>
          <div className="sidebar-spacer" />
          <div className="sidebar-bottom">
            <button className="nav-item"><Download size={16}/><span>Téléchargements</span></button>
            <button className="nav-item"><Settings2 size={16}/><span>Paramètres</span></button>
            <div className="profile-row"><div className="avatar">A</div><div className="profile-copy"><strong>Profil local</strong><span>Synchronisation inactive</span></div><ChevronDown size={14}/></div>
          </div>
        </aside>
      )}
      {overlay && menuOnglet && ongletDuMenu && (
        <MenuOverlay x={menuOnglet.x} y={menuOnglet.y} label={`Onglet ${ongletDuMenu.title}`} onClose={fermerOverlay} entrees={[
          { label: 'Nouvel onglet', action: () => void window.arbalete.createTab() },
          { label: 'Fermer l’onglet', action: () => void window.arbalete.closeTab(ongletDuMenu.id) }
        ]} />
      )}
    </div>
  )
}

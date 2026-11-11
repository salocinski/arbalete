import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Clock3, Download, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings2, Star } from 'lucide-react'
import { LARGEUR_ETENDUE_MAX, LARGEUR_ETENDUE_MIN, barreCompacte, largeurApresTouche, largeurBarre } from '../../../shared/barre'
import type { BrowserState, SidebarState } from '../../../shared/types'
import { useOverlay } from '../state'
import { MenuOverlay } from './Overlay'
import { PinButton } from './PinButton'
import { IconButton } from './ui/IconButton'
import { TabList } from './TabList'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

// Poignée du bord droit de la barre étendue (ARB-123) : glissée ou au clavier (flèches, Début, Fin). La capture du
// pointeur garde le glissement quand la souris dépasse la vue ; le processus principal borne la largeur.
function SidebarResizer({ width }: { width: number }) {
  const regler = (valeur: number) => void window.arbalete.setSidebarWidth(valeur)
  return (
    <div className="sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Largeur de la barre latérale" tabIndex={0}
      aria-valuemin={LARGEUR_ETENDUE_MIN} aria-valuemax={LARGEUR_ETENDUE_MAX} aria-valuenow={width}
      onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) regler(event.clientX) }}
      onKeyDown={(event) => {
        const valeur = largeurApresTouche(event.key, width)
        if (valeur === undefined) return
        event.preventDefault()
        regler(valeur)
      }} />
  )
}

// shortcut: pas de favicon enregistré avec le favori, la tuile montre l'initiale du site ; à remplacer quand la table
// `favori` gardera l'icône (ARB-48).
function initialeFavori(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').charAt(0).toUpperCase() || '?'
  } catch {
    return '?'
  }
}

// Masquée, la barre n'est qu'une bande de survol au bord gauche ; ouverte, elle recouvre la page.
// Elle se retire quand la souris la quitte, sauf si elle est épinglée ou si le focus y est (champ, menu).
export function Sidebar({ state, sidebar }: { state: BrowserState; sidebar: SidebarState }) {
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const zoneRef = useRef<HTMLDivElement>(null)
  // Menu d'un onglet (ARB-39) : demandé ici, affiché une fois que le processus principal a agrandi la vue, sinon il
  // serait coupé au bord de la barre le temps d'une image. Il disparaît avec l'overlay, quelle qu'en soit la cause.
  const overlay = useOverlay()
  const [menuOnglet, setMenuOnglet] = useState<{ tabId: string; x: number; y: number } | null>(null)
  const ongletDuMenu = menuOnglet && state.tabs.find((tab) => tab.id === menuOnglet.tabId)
  const compacte = barreCompacte(sidebar)

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
    <div ref={zoneRef} className="sidebar-zone"
      onMouseEnter={() => void window.arbalete.setSidebar('open')}
      onMouseLeave={onMouseLeave}>
      {!sidebar.open ? <div className="sidebar-hover-strip" data-testid="sidebar-hover-strip" /> : (
        <aside className={compacte ? 'sidebar sidebar--compact' : 'sidebar'} style={{ width: largeurBarre(sidebar) }}>
          <div className="brand-row">
            <div className="brand-mark">a<span>.</span></div>
            <span className="brand-name">arbalète</span>
            {sidebar.pinned && (
              <IconButton className="sidebar-toggle" title={compacte ? 'Étendre la barre latérale' : 'Réduire la barre latérale'} onClick={() => void window.arbalete.setSidebar('toggle-compact')}>
                {compacte ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              </IconButton>
            )}
            {!compacte && <PinButton pinned={sidebar.pinned} className={sidebar.pinned ? undefined : 'sidebar-toggle'} />}
          </div>

          <WorkspaceSwitcher workspaces={state.workspaces} active={state.activeWorkspaceId} onWorkspaceChange={(id) => void window.arbalete.setWorkspace(id)} menuOpen={showWorkspaceMenu} onMenuOpenChange={setShowWorkspaceMenu} compact={compacte} />

          {state.favorites.length > 0 && (
            <ul className="favorites-grid" aria-label="Favoris">
              {state.favorites.map((favori) => (
                <li key={favori.url}>
                  <button className="favorite-tile" title={favori.title || favori.url} aria-label={favori.title || favori.url}
                    onClick={() => void window.arbalete.openFavorite(favori.url)}>
                    {initialeFavori(favori.url)}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <nav className="sidebar-nav">
            <button className="nav-item" title="Rechercher"><Search size={16} /><span>Rechercher</span><kbd>Ctrl K</kbd></button>
            <button className="nav-item" title="Favoris"><Star size={16} /><span>Favoris</span></button>
            <button className="nav-item" title="Historique"><Clock3 size={16} /><span>Historique</span></button>
          </nav>

          <div className="section-heading"><span>ONGLETS</span><IconButton size="sm" title="Nouvel onglet" onClick={() => void window.arbalete.createTab()}><Plus size={14}/></IconButton></div>
          <TabList state={state} onMenu={ouvrirMenuOnglet} />
          <button className="new-tab-button" title="Nouvel onglet (Ctrl T)" onClick={() => void window.arbalete.createTab()}><Plus size={16}/><span>Nouvel onglet</span><kbd>Ctrl T</kbd></button>
          <div className="sidebar-spacer" />
          <div className="sidebar-bottom">
            <button className="nav-item" title="Téléchargements"><Download size={16}/><span>Téléchargements</span></button>
            <button className="nav-item" title="Paramètres"><Settings2 size={16}/><span>Paramètres</span></button>
            <div className="profile-row" title="Profil local"><div className="avatar">A</div><div className="profile-copy"><strong>Profil local</strong><span>Synchronisation inactive</span></div><ChevronDown size={14}/></div>
          </div>
          {sidebar.pinned && !compacte && <SidebarResizer width={sidebar.width} />}
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

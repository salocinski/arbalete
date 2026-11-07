import { Globe2, ShieldCheck, X } from 'lucide-react'
import { IconButton } from './ui/IconButton'
import type { BrowserState, BrowserTab } from '../../../shared/types'

// onMenu : clic droit sur un onglet, avec la position du pointeur dans la vue (menu de l'onglet, ARB-39).
export function TabList({ state, onMenu }: { state: BrowserState; onMenu?: (tabId: string, x: number, y: number) => void }) {
  return (
    <div className="tab-list">
      {state.tabs.map((tab) => <TabItem key={tab.id} tab={tab} active={tab.id === state.activeTabId} onSelect={() => void window.arbalete.activateTab(tab.id)} onClose={() => void window.arbalete.closeTab(tab.id)}
        onMenu={(x, y) => onMenu?.(tab.id, x, y)} />)}
    </div>
  )
}

function TabItem({ tab, active, onSelect, onClose, onMenu }: { tab: BrowserTab; active: boolean; onSelect: () => void; onClose: () => void; onMenu: (x: number, y: number) => void }) {
  return (
    <div className={`tab-item ${active ? 'active' : ''}`} onContextMenu={(event) => { event.preventDefault(); onMenu(event.clientX, event.clientY) }}>
      <button className="tab-select" onClick={onSelect}>
        <span className={`tab-favicon ${tab.isLoading ? 'loading' : ''}`}><Globe2 size={14}/></span>
        <span className="tab-title">{tab.title}</span>
        {tab.url.startsWith('https://') && <span className="tab-secure"><ShieldCheck size={12}/></span>}
      </button>
      <IconButton size="sm" className="tab-close" title="Fermer l'onglet" onClick={(event) => { event.stopPropagation(); onClose() }}><X size={14}/></IconButton>
    </div>
  )
}

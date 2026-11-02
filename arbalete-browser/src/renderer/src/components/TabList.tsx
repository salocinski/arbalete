import { Globe2, ShieldCheck, X } from 'lucide-react'
import type { BrowserState, BrowserTab } from '../../../shared/types'

export function TabList({ state }: { state: BrowserState }) {
  return (
    <div className="tab-list">
      {state.tabs.map((tab) => <TabItem key={tab.id} tab={tab} active={tab.id === state.activeTabId} onSelect={() => void window.arbalete.activateTab(tab.id)} onClose={() => void window.arbalete.closeTab(tab.id)} />)}
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

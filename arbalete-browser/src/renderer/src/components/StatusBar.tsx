import type { BrowserTab } from '../../../shared/types'

function displayHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export function StatusBar({ activeTab }: { activeTab: BrowserTab | undefined }) {
  return (
    <footer className="statusbar">
      <div><span className="status-dot"/>{activeTab?.isLoading ? 'Chargement…' : activeTab ? displayHost(activeTab.url) : 'Prêt'}</div>
      <div className="status-right"><span>Version prototype 0.1</span><span className="status-divider"/><span>Windows</span></div>
    </footer>
  )
}

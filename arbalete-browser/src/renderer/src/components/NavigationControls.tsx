import { ArrowLeft, ArrowRight, RotateCw } from 'lucide-react'
import type { BrowserTab } from '../../../shared/types'
import { IconButton } from './ui/IconButton'

// Précédent, suivant, recharger de la barre de contrôle (zone B, ARB-31).
export function NavigationControls({ activeTab }: { activeTab: BrowserTab | undefined }) {
  return (
    <div className="nav-controls">
      <IconButton title="Précédent (Alt+←)" onClick={() => void window.arbalete.goBack()} disabled={!activeTab?.canGoBack}><ArrowLeft size={16}/></IconButton>
      <IconButton title="Suivant (Alt+→)" onClick={() => void window.arbalete.goForward()} disabled={!activeTab?.canGoForward}><ArrowRight size={16}/></IconButton>
      <IconButton title="Recharger" onClick={() => void window.arbalete.reload()}><RotateCw size={16}/></IconButton>
    </div>
  )
}

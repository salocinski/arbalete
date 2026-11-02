import type { RefObject } from 'react'
import { ArrowLeft, ArrowRight, Monitor, Moon, Plus, RotateCw, Sun } from 'lucide-react'
import type { BrowserTab, ThemeChoice } from '../../../shared/types'
import { AddressBar } from './AddressBar'
import { PinButton } from './PinButton'

const nextTheme: Record<ThemeChoice, ThemeChoice> = { system: 'dark', dark: 'light', light: 'system' }

type ToolbarProps = {
  activeTab: BrowserTab | undefined
  sidebarPinned: boolean
  themeChoice: ThemeChoice
  address: string
  addressFocused: boolean
  addressRef: RefObject<HTMLInputElement | null>
  onAddressChange: (value: string) => void
  onAddressFocusChange: (focused: boolean) => void
  onNavigate: () => void
}

export function Toolbar({ activeTab, sidebarPinned, themeChoice, onNavigate, ...address }: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="nav-controls">
        <PinButton pinned={sidebarPinned} className="icon-button" />
        <button className="icon-button" title="Précédent (Alt+←)" onClick={() => void window.arbalete.goBack()} disabled={!activeTab?.canGoBack}><ArrowLeft size={17}/></button>
        <button className="icon-button" title="Suivant (Alt+→)" onClick={() => void window.arbalete.goForward()} disabled={!activeTab?.canGoForward}><ArrowRight size={17}/></button>
        <button className="icon-button" title="Recharger" onClick={() => void window.arbalete.reload()}><RotateCw size={15}/></button>
      </div>
      <AddressBar {...address} onSubmit={onNavigate} />
      <button className="icon-button toolbar-action" title="Nouvel onglet" onClick={() => void window.arbalete.createTab()}><Plus size={18}/></button>
      <button className="icon-button toolbar-action" title="Thème : changer le mode" onClick={() => void window.arbalete.setTheme(nextTheme[themeChoice])}>
        {themeChoice === 'system' ? <Monitor size={16}/> : themeChoice === 'dark' ? <Moon size={16}/> : <Sun size={16}/>}
      </button>
    </header>
  )
}

import type { RefObject } from 'react'
import { Monitor, Moon, Plus, Sun } from 'lucide-react'
import type { BrowserTab, ThemeChoice } from '../../../shared/types'
import { AddressBar } from './AddressBar'
import { NavigationControls } from './NavigationControls'
import { PinButton } from './PinButton'
import { IconButton } from './ui/IconButton'

const nextTheme: Record<ThemeChoice, ThemeChoice> = { system: 'dark', dark: 'light', light: 'system' }

type ToolbarProps = {
  activeTab: BrowserTab | undefined
  sidebarPinned: boolean
  themeChoice: ThemeChoice
  favorite: boolean
  address: string
  addressRef: RefObject<HTMLInputElement | null>
  onAddressChange: (value: string) => void
  onAddressFocusChange: (focused: boolean) => void
  onNavigate: () => void
}

export function Toolbar({ activeTab, sidebarPinned, themeChoice, favorite, onNavigate, ...address }: ToolbarProps) {
  return (
    <header className="toolbar">
      <PinButton pinned={sidebarPinned} />
      <NavigationControls activeTab={activeTab} />
      <AddressBar {...address} onSubmit={onNavigate} favorite={favorite} favoritable={/^https?:/i.test(activeTab?.url ?? '')} />
      <IconButton variant="secondary" title="Nouvel onglet" onClick={() => void window.arbalete.createTab()}><Plus size={16}/></IconButton>
      <IconButton variant="secondary" title="Thème : changer le mode" onClick={() => void window.arbalete.setTheme(nextTheme[themeChoice])}>
        {themeChoice === 'system' ? <Monitor size={16}/> : themeChoice === 'dark' ? <Moon size={16}/> : <Sun size={16}/>}
      </IconButton>
    </header>
  )
}

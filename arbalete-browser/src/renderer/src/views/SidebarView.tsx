import { useEffect } from 'react'
import { Sidebar } from '../components/Sidebar'
import { SuggestionsOverlay } from '../components/SuggestionsOverlay'
import { CommandPalette } from '../components/CommandPalette'
import { PermissionModal } from '../components/PermissionModal'
import { useBrowserState, useOverlay, usePalette, usePermissionRequest, useSidebar, useSuggestions, useTheme } from '../state'

// Document de la vue native de la barre latérale (?vue=barre), posée au-dessus de la page. Ses raccourcis clavier
// sont interceptés par le processus principal (ARB-18).
export function SidebarView() {
  const state = useBrowserState()
  const sidebar = useSidebar()
  useTheme()
  const overlay = useOverlay()
  const suggestions = useSuggestions()
  const palette = usePalette()
  const permission = usePermissionRequest()
  useEffect(() => { document.documentElement.classList.add('vue-barre') }, [])
  return (
    <>
      <Sidebar state={state} sidebar={sidebar} />
      {overlay && suggestions && <SuggestionsOverlay state={suggestions} />}
      {overlay && permission && <PermissionModal demande={permission} onClose={() => void window.arbalete.setOverlay(false)} />}
      {overlay && palette && <CommandPalette lignes={palette} onClose={() => void window.arbalete.setOverlay(false)} />}
    </>
  )
}

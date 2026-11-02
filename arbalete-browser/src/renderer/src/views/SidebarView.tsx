import { useEffect } from 'react'
import { Sidebar } from '../components/Sidebar'
import { handleTabShortcut } from '../shortcuts'
import { useBrowserState, useSidebar, useTheme } from '../state'

// Document de la vue native de la barre latérale (?vue=barre), posée au-dessus de la page.
export function SidebarView() {
  const state = useBrowserState()
  const sidebar = useSidebar()
  const theme = useTheme()
  useEffect(() => { document.documentElement.classList.add('vue-barre') }, [])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { handleTabShortcut(event, state.activeTabId) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.activeTabId])
  return <Sidebar state={state} sidebar={sidebar} theme={theme.effective} />
}

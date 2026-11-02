import { useEffect } from 'react'
import { Sidebar } from '../components/Sidebar'
import { useBrowserState, useSidebar, useTheme } from '../state'

// Document de la vue native de la barre latérale (?vue=barre), posée au-dessus de la page. Ses raccourcis clavier
// sont interceptés par le processus principal (ARB-18).
export function SidebarView() {
  const state = useBrowserState()
  const sidebar = useSidebar()
  const theme = useTheme()
  useEffect(() => { document.documentElement.classList.add('vue-barre') }, [])
  return <Sidebar state={state} sidebar={sidebar} theme={theme.effective} />
}

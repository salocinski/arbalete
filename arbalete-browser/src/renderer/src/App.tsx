import { FindView } from './views/FindView'
import { MainView } from './views/MainView'
import { PopupNoticeView } from './views/PopupNoticeView'
import { SidebarView } from './views/SidebarView'

// La barre latérale (ARB-33) et la recherche dans la page (ARB-70) vivent dans leur propre vue native, chargée avec
// ?vue=barre ou ?vue=recherche ; l'avis de pop-up bloquée (ARB-108) de même, avec ?vue=popup.
const vue = new URLSearchParams(window.location.search).get('vue')

export default function App() {
  if (vue === 'barre') return <SidebarView />
  if (vue === 'recherche') return <FindView />
  if (vue === 'popup') return <PopupNoticeView />
  return <MainView />
}

import { MainView } from './views/MainView'
import { SidebarView } from './views/SidebarView'

// La barre latérale vit dans sa propre vue native, chargée avec ?vue=barre (ARB-33).
const vueBarre = new URLSearchParams(window.location.search).get('vue') === 'barre'

export default function App() {
  return vueBarre ? <SidebarView /> : <MainView />
}

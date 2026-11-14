import { AppWindow, X } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import { useBrowserState, useTheme } from '../state'

// Document de la vue native de l'avis « pop-up bloquée » (?vue=popup, ARB-108), en bas à gauche de la page. Le processus
// principal l'affiche 6 s et la retire ; « Autoriser » mémorise le site, la croix ferme.
export function PopupNoticeView() {
  useTheme()
  const { popupsBloquees } = useBrowserState()
  useEffect(() => { document.documentElement.classList.add('vue-popup') }, [])

  return (
    <div className="popup-notice" role="status" data-testid="popup-notice">
      <AppWindow size={16} className="popup-notice-icon"/>
      <span className="popup-notice-text">{popupsBloquees > 1 ? `${popupsBloquees} pop-ups bloquées` : 'Pop-up bloquée'}</span>
      <Button size="sm" variant="primary" onClick={() => void window.arbalete.allowPopups()}>Autoriser</Button>
      <IconButton title="Fermer" onClick={() => void window.arbalete.closePopupNotice()}><X size={16}/></IconButton>
    </div>
  )
}

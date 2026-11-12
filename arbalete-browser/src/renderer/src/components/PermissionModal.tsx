import { phraseDemande, type DemandePermission } from '../../../shared/permissions'
import { Button } from './ui/Button'
import { Overlay } from './Overlay'

// Invite de permission d'un site (ARB-15), modale de la couche d'overlays. Autoriser ou Refuser est mémorisé pour le site ;
// Échap ou un clic à côté refuse cette fois seulement. Refuser prend le focus : une touche Entrée distraite n'accorde rien.
export function PermissionModal({ demande, onClose }: { demande: DemandePermission; onClose: () => void }) {
  const repondre = (reponse: 'autoriser' | 'refuser') => void window.arbalete.answerPermission(reponse)
  return (
    <Overlay centre onClose={onClose}>
      <div className="permission-modal" role="alertdialog" aria-modal="true" aria-label={`Permission demandée par ${demande.hote}`} data-testid="permission-modal">
        <div><strong>{demande.hote}</strong> souhaite {phraseDemande(demande.permissions)}.</div>
        <div className="permission-modal-actions">
          <Button size="sm" autoFocus onClick={() => repondre('refuser')}>Refuser</Button>
          <Button size="sm" variant="primary" onClick={() => repondre('autoriser')}>Autoriser</Button>
        </div>
      </div>
    </Overlay>
  )
}

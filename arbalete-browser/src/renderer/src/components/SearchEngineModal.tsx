import { useEffect, useState } from 'react'
import { MOTEURS, MOTEUR_DEFAUT, modeleValide, type ChoixMoteur, type MoteurId } from '../../../shared/moteurs'
import { Overlay } from './Overlay'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

const OPTIONS: { id: MoteurId; nom: string }[] = [...MOTEURS.map(({ id, nom }) => ({ id, nom })), { id: 'perso', nom: 'Personnalisé' }]

// Modale du moteur de recherche de la barre d'adresse (ARB-58), dans la couche d'overlays. Le choix courant est lu au
// montage ; « Personnalisé » demande une adresse https contenant %s. Enregistrer applique et ferme, Échap ou un clic à
// côté ferment sans rien changer.
export function SearchEngineModal({ onClose }: { onClose: () => void }) {
  const [choix, setChoix] = useState<ChoixMoteur>(MOTEUR_DEFAUT)
  useEffect(() => {
    void window.arbalete.getSearchEngine().then(setChoix).catch(() => {})
  }, [])

  const perso = choix.id === 'perso'
  const invalide = perso && !modeleValide(choix.modele)
  const enregistrer = () => {
    void window.arbalete.setSearchEngine(choix).then(onClose, () => {})
  }

  return (
    <Overlay centre onClose={onClose}>
      <div className="color-modal" role="dialog" aria-modal="true" aria-label="Moteur de recherche">
        <div className="color-modal-title">Moteur de recherche</div>
        <div className="engine-list" role="radiogroup" aria-label="Moteurs">
          {OPTIONS.map(({ id, nom }) => (
            <button key={id} role="radio" className="engine-option" aria-checked={id === choix.id} autoFocus={id === choix.id}
              onClick={() => setChoix({ id, modele: id === 'perso' ? choix.modele : '' })}>
              {nom}
            </button>
          ))}
        </div>
        {perso && (
          <Input aria-label="Adresse de recherche" placeholder="https://exemple.org/?q=%s" value={choix.modele} autoFocus
            error={invalide && choix.modele ? 'Une adresse https avec un seul %s, remplacé par le texte tapé.' : undefined}
            onChange={(event) => setChoix({ id: 'perso', modele: event.target.value })}
            onKeyDown={(event) => { if (event.key === 'Enter' && !invalide) enregistrer() }} />
        )}
        <Button variant="primary" disabled={invalide} onClick={enregistrer}>Enregistrer</Button>
      </div>
    </Overlay>
  )
}

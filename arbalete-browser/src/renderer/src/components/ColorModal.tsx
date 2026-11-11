import { COULEURS_ESPACE, NOMS_COULEUR_ESPACE, type CouleurEspace, type Espace } from '../../../shared/espaces'
import { Overlay } from './Overlay'

const PAR_LIGNE = 7

// Modale de choix de la couleur d'un espace (ARB-134), dans la couche d'overlays. Les pastilles prennent les variantes du
// thème courant (tokens `--color-workspace-*`) ; un clic ou Entrée applique la couleur et ferme la modale, Échap ou un clic
// à côté la ferment sans rien changer. Flèches, Début et Fin parcourent la grille, comme pour un groupe de boutons radio.
export function ColorModal({ espace, onChoisir, onClose }: { espace: Espace; onChoisir: (couleur: CouleurEspace) => void; onClose: () => void }) {
  const parcourir = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const pastilles = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    const courant = pastilles.indexOf(document.activeElement as HTMLButtonElement)
    const cible = { ArrowRight: courant + 1, ArrowLeft: courant - 1, ArrowDown: courant + PAR_LIGNE, ArrowUp: courant - PAR_LIGNE, Home: 0, End: pastilles.length - 1 }[event.key]
    if (cible === undefined || courant < 0) return
    event.preventDefault()
    pastilles[(cible + pastilles.length) % pastilles.length].focus()
  }

  return (
    <Overlay centre onClose={onClose}>
      <div className="color-modal" role="dialog" aria-modal="true" aria-label={`Couleur de l’espace ${espace.nom}`}>
        <div className="color-modal-title">Couleur de l’espace</div>
        <div className="color-modal-card" data-testid="color-modal-card">
          <span className="workspace-dot" style={{ background: `var(--color-workspace-${espace.couleur})` }} />
          <span className="workspace-name">{espace.nom}</span>
        </div>
        <div className="color-grid" role="radiogroup" aria-label="Couleurs" onKeyDown={parcourir}>
          {COULEURS_ESPACE.map((couleur) => (
            <button key={couleur} role="radio" className="color-swatch" aria-checked={couleur === espace.couleur}
              aria-label={NOMS_COULEUR_ESPACE[couleur]} title={NOMS_COULEUR_ESPACE[couleur]} data-couleur={couleur}
              autoFocus={couleur === espace.couleur} style={{ background: `var(--color-workspace-${couleur})` }}
              onClick={() => onChoisir(couleur)} />
          ))}
        </div>
      </div>
    </Overlay>
  )
}

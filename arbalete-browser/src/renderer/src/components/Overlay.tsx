import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// Couche d'overlays (ARB-39, décision 0002) : rendue dans la vue de la barre, que le processus principal agrandit à
// toute la fenêtre tant que l'overlay est ouvert. Un clic hors du contenu le ferme sans atteindre la page ; Échap est
// traité par le processus principal, où que soit le focus.
export function Overlay({ x, y, onClose, children }: { x: number; y: number; onClose: () => void; children: ReactNode }) {
  const contenuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  // Un overlay ne déborde pas de la fenêtre : près d'un bord, le contenu s'ouvre de l'autre côté du point.
  useLayoutEffect(() => {
    const contenu = contenuRef.current
    if (!contenu) return
    const { width, height } = contenu.getBoundingClientRect()
    setPosition({
      left: x + width > window.innerWidth ? Math.max(0, x - width) : x,
      top: y + height > window.innerHeight ? Math.max(0, y - height) : y
    })
  }, [x, y])

  const fermerHorsContenu = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div className="overlay-layer" data-testid="overlay-layer" onMouseDown={fermerHorsContenu}
      onContextMenu={(event) => { event.preventDefault(); fermerHorsContenu(event) }}>
      <div ref={contenuRef} className="overlay-content" style={position}>{children}</div>
    </div>
  )
}

export type EntreeMenu = { label: string; action: () => void }

// Menu flottant : chaque entrée ferme l'overlay puis agit. La première entrée prend le focus, pour le clavier.
export function MenuOverlay({ x, y, entrees, onClose, label }: { x: number; y: number; entrees: EntreeMenu[]; onClose: () => void; label: string }) {
  return (
    <Overlay x={x} y={y} onClose={onClose}>
      <div className="overlay-menu" role="menu" aria-label={label}>
        {entrees.map((entree, index) => (
          <button key={entree.label} role="menuitem" autoFocus={index === 0} onClick={() => { onClose(); entree.action() }}>
            {entree.label}
          </button>
        ))}
      </div>
    </Overlay>
  )
}

import { Clock, Globe, Search } from 'lucide-react'
import type { Suggestion, SuggestionsState } from '../../../shared/types'
import { Overlay } from './Overlay'

const icones: Record<Suggestion['kind'], typeof Search> = { recherche: Search, adresse: Globe, historique: Clock }

// Suggestions de la barre d'adresse (ARB-53) : liste posée sous le champ, dans la couche d'overlays de la vue de la barre.
// Le champ reste dans la fenêtre et garde le clavier (flèches, Entrée) ; ici on n'affiche que, et un clic ouvre la ligne.
export function SuggestionsOverlay({ state }: { state: SuggestionsState }) {
  const { anchor, items, selection } = state
  return (
    <Overlay x={anchor.x} y={anchor.y} onClose={() => void window.arbalete.setOverlay(false)}>
      <div className="suggestions" role="listbox" aria-label="Suggestions" style={{ width: anchor.width }}>
        {items.map((item, index) => {
          const Icone = icones[item.kind]
          return (
            <button key={`${item.kind}:${item.url}`} type="button" role="option" tabIndex={-1} aria-selected={index === selection}
              className="suggestion" onClick={() => void window.arbalete.chooseSuggestion(index)}>
              <Icone size={14} className="muted-icon" aria-hidden="true"/>
              <span className="suggestion-title">{item.kind === 'recherche' ? `Rechercher « ${item.titre} »` : item.titre}</span>
              {item.kind === 'historique' && <span className="suggestion-url">{item.url}</span>}
            </button>
          )
        })}
      </div>
    </Overlay>
  )
}

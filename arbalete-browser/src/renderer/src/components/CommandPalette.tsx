import { useEffect, useState } from 'react'
import { AppWindow, Clock, Search, Star, Zap } from 'lucide-react'
import type { EntreePalette, TypePalette } from '../../../shared/palette'
import { Overlay } from './Overlay'
import { Input } from './ui/Input'

const icones: Record<TypePalette, typeof Search> = { onglet: AppWindow, action: Zap, favori: Star, historique: Clock }

// Palette de commandes Ctrl+K (ARB-67) : modale de la couche d'overlays. Le champ garde le clavier (flèches, Entrée) ; le
// processus principal cherche et agit, la vue n'envoie que le texte et l'index de la ligne choisie. Échap et le clic hors de
// la modale ferment l'overlay.
export function CommandPalette({ lignes, onClose }: { lignes: EntreePalette[]; onClose: () => void }) {
  const [texte, setTexte] = useState('')
  const [selection, setSelection] = useState(0)

  // Une nouvelle liste (frappe) repart de la première ligne.
  useEffect(() => { setSelection(0) }, [lignes])

  const changer = (valeur: string) => {
    setTexte(valeur)
    void window.arbalete.searchPalette(valeur)
  }
  const touche = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (lignes.length) setSelection((selection + (event.key === 'ArrowDown' ? 1 : -1) + lignes.length) % lignes.length)
    } else if (event.key === 'Enter' && lignes[selection]) {
      event.preventDefault()
      void window.arbalete.choosePalette(selection, lignes[selection].cle)
    }
  }

  return (
    <Overlay centre onClose={onClose}>
      <div className="palette" role="dialog" aria-label="Palette de commandes">
        <Input autoFocus value={texte} onChange={(event) => changer(event.target.value)} onKeyDown={touche}
          placeholder="Rechercher un onglet, un favori, une page ou une action" aria-label="Rechercher" role="combobox"
          aria-expanded={lignes.length > 0} aria-autocomplete="list" aria-controls="palette-liste" aria-activedescendant={lignes[selection] ? `palette-${selection}` : undefined}
          leading={<Search size={14} className="muted-icon" aria-hidden="true" />} />
        <div id="palette-liste" className="palette-liste" role="listbox" aria-label="Résultats">
          {lignes.length === 0 && <p className="palette-vide">Aucun résultat</p>}
          {lignes.map((ligne, index) => {
            const Icone = icones[ligne.kind]
            return (
              <button key={`${ligne.kind}:${ligne.cle}`} id={`palette-${index}`} type="button" role="option" tabIndex={-1}
                aria-selected={index === selection} className="suggestion" onMouseMove={() => setSelection(index)}
                onClick={() => void window.arbalete.choosePalette(index, ligne.cle)}>
                <Icone size={14} className="muted-icon" aria-hidden="true" />
                <span className="suggestion-title">{ligne.titre}</span>
                {ligne.detail && <span className="suggestion-url">{ligne.detail}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </Overlay>
  )
}

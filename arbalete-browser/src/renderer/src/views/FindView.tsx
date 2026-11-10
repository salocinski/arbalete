import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FindResult } from '../../../shared/types'
import { compteur } from '../../../shared/recherche'
import { IconButton } from '../components/ui/IconButton'
import { useTheme } from '../state'

// Document de la vue native de la recherche dans la page (?vue=recherche, ARB-70). Entrée / Maj+Entrée parcourent les
// résultats, Échap ferme ; Ctrl+F est intercepté par le processus principal.
export function FindView() {
  useTheme()
  const champ = useRef<HTMLInputElement>(null)
  const [texte, setTexte] = useState('')
  const [resultat, setResultat] = useState<FindResult | null>(null)

  useEffect(() => {
    document.documentElement.classList.add('vue-recherche')
    champ.current?.focus()
    const retirerResultat = window.arbalete.onFindResult(setResultat)
    const retirerFocus = window.arbalete.onFindFocus((reouverte) => {
      if (reouverte) { setTexte(''); setResultat(null) }
      champ.current?.focus()
      champ.current?.select()
    })
    return () => { retirerResultat(); retirerFocus() }
  }, [])

  const chercher = (valeur: string, avant: boolean, suivant: boolean) => {
    if (valeur) void window.arbalete.findInPage(valeur, avant, suivant)
    else {
      void window.arbalete.findInPage('', true, false)
      setResultat(null)
    }
  }
  const fermer = () => void window.arbalete.closeFind()

  return (
    <div className="find-bar" role="search">
      <input ref={champ} className="find-input" type="text" value={texte} placeholder="Rechercher dans la page"
        aria-label="Rechercher dans la page" spellCheck={false}
        onChange={(event) => { setTexte(event.target.value); chercher(event.target.value, true, false) }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); fermer() }
          else if (event.key === 'Enter') { event.preventDefault(); chercher(texte, !event.shiftKey, true) }
        }} />
      <span className="find-count" aria-live="polite">{compteur(texte, resultat)}</span>
      <IconButton title="Résultat précédent (Maj+Entrée)" disabled={!texte} onClick={() => chercher(texte, false, true)}><ChevronUp size={16}/></IconButton>
      <IconButton title="Résultat suivant (Entrée)" disabled={!texte} onClick={() => chercher(texte, true, true)}><ChevronDown size={16}/></IconButton>
      <IconButton title="Fermer (Échap)" onClick={fermer}><X size={16}/></IconButton>
    </div>
  )
}

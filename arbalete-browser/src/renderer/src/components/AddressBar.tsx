import { useRef, type KeyboardEvent, type RefObject } from 'react'
import { AppWindow, ShieldCheck, Star } from 'lucide-react'
import { useSuggestions } from '../state'
import { IconButton } from './ui/IconButton'
import { Input } from './ui/Input'

type AddressBarProps = {
  address: string
  addressRef: RefObject<HTMLInputElement | null>
  onAddressChange: (value: string) => void
  onAddressFocusChange: (focused: boolean) => void
  onSubmit: () => void
  // Étoile (ARB-47) : la page est un favori ; elle peut en devenir un (adresse web seulement).
  favorite: boolean
  favoritable: boolean
  // Pop-ups bloquées sur la page (ARB-108) : l'icône, à droite de l'étoile, n'existe que s'il y en a.
  popupsBloquees: number
}

// Champ contrôlé par MainView : Ctrl+L y place le focus et la page d'accueil partage sa saisie.
// Suggestions (ARB-53) : le champ garde le clavier. Il envoie le texte et les flèches au processus principal, qui tient la
// liste et la fait afficher par la vue de la barre (SuggestionsOverlay), au-dessus de la page.
export function AddressBar({ address, addressRef, onAddressChange, onAddressFocusChange, onSubmit, favorite, favoritable, popupsBloquees }: AddressBarProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const suggestions = useSuggestions()

  const demander = (texte: string) => {
    const zone = formRef.current?.getBoundingClientRect()
    if (zone) void window.arbalete.suggest(texte, { x: zone.left, y: zone.bottom + 4, width: zone.width, height: 0 })
  }

  const surTouche = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (suggestions) void window.arbalete.moveSuggestion(event.key === 'ArrowDown' ? 1 : -1)
      else if (event.key === 'ArrowDown') demander(address)
    } else if (event.key === 'Tab') {
      void window.arbalete.closeSuggestions()
    }
  }

  // Entrée ouvre la ligne choisie aux flèches ; sans ligne choisie (ou si le processus principal n'en a plus), elle navigue
  // vers le texte tapé.
  const valider = async () => {
    const ouverte = suggestions && suggestions.selection >= 0 ? await window.arbalete.chooseSuggestion() : false
    if (!ouverte) onSubmit()
  }

  return (
    <form ref={formRef} className="address-bar" onSubmit={(event) => { event.preventDefault(); void valider() }}>
      <Input
        ref={addressRef}
        value={address}
        onChange={(event) => { onAddressChange(event.target.value); demander(event.target.value) }}
        onKeyDown={surTouche}
        onFocus={() => onAddressFocusChange(true)}
        onBlur={() => onAddressFocusChange(false)}
        role="combobox"
        aria-expanded={suggestions !== null}
        aria-autocomplete="list"
        aria-label="Adresse ou recherche"
        spellCheck={false}
        leading={<ShieldCheck size={16} className="secure-icon"/>}
        trailing={
          <>
            <IconButton size="sm" title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={favorite}
              disabled={!favoritable} className={favorite ? 'favorite-on' : undefined}
              onClick={() => void window.arbalete.toggleFavorite()}>
              <Star size={14} fill={favorite ? 'currentColor' : 'none'}/>
            </IconButton>
            {popupsBloquees > 0 && (
              <IconButton size="sm" title="Pop-up bloquée : afficher l’avis" className="popup-blocked" data-testid="popup-blocked"
                onClick={() => void window.arbalete.showBlockedPopups()}>
                <AppWindow size={14}/>
                {popupsBloquees > 1 && <span className="popup-blocked-count">{popupsBloquees}</span>}
              </IconButton>
            )}
          </>
        }
      />
    </form>
  )
}

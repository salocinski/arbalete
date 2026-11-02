import type { RefObject } from 'react'
import { ShieldCheck, Star } from 'lucide-react'

type AddressBarProps = {
  address: string
  addressFocused: boolean
  addressRef: RefObject<HTMLInputElement | null>
  onAddressChange: (value: string) => void
  onAddressFocusChange: (focused: boolean) => void
  onSubmit: () => void
}

// Champ contrôlé par MainView : Ctrl+L y place le focus et la page d'accueil partage sa saisie.
export function AddressBar({ address, addressFocused, addressRef, onAddressChange, onAddressFocusChange, onSubmit }: AddressBarProps) {
  return (
    <form className={`address-bar ${addressFocused ? 'is-focused' : ''}`} onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
      <ShieldCheck size={15} className="secure-icon"/>
      <input ref={addressRef} value={address} onChange={(event) => onAddressChange(event.target.value)} onFocus={() => onAddressFocusChange(true)} onBlur={() => onAddressFocusChange(false)} aria-label="Adresse ou recherche" spellCheck={false}/>
      <button type="button" className="address-action" title="Ajouter aux favoris"><Star size={15}/></button>
    </form>
  )
}

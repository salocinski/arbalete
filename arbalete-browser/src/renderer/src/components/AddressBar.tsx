import type { RefObject } from 'react'
import { ShieldCheck, Star } from 'lucide-react'
import { IconButton } from './ui/IconButton'
import { Input } from './ui/Input'

type AddressBarProps = {
  address: string
  addressFocused: boolean
  addressRef: RefObject<HTMLInputElement | null>
  onAddressChange: (value: string) => void
  onAddressFocusChange: (focused: boolean) => void
  onSubmit: () => void
}

// Champ contrôlé par MainView : Ctrl+L y place le focus et la page d'accueil partage sa saisie.
export function AddressBar({ address, addressRef, onAddressChange, onAddressFocusChange, onSubmit }: AddressBarProps) {
  return (
    <form className="address-bar" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
      <Input
        ref={addressRef}
        value={address}
        onChange={(event) => onAddressChange(event.target.value)}
        onFocus={() => onAddressFocusChange(true)}
        onBlur={() => onAddressFocusChange(false)}
        aria-label="Adresse ou recherche"
        spellCheck={false}
        leading={<ShieldCheck size={16} className="secure-icon"/>}
        trailing={<IconButton size="sm" title="Ajouter aux favoris"><Star size={14}/></IconButton>}
      />
    </form>
  )
}

import { Pin, PinOff } from 'lucide-react'
import { IconButton } from './ui/IconButton'

// Épingle ou libère la barre latérale ; présent dans la barre elle-même et dans la barre d'outils.
export function PinButton({ pinned, className }: { pinned: boolean; className?: string }) {
  return (
    <IconButton className={className} title={pinned ? 'Libérer la barre latérale (Ctrl+Maj+B)' : 'Épingler la barre latérale (Ctrl+Maj+B)'} onClick={() => void window.arbalete.setSidebar('toggle-pin')}>
      {pinned ? <PinOff size={16} /> : <Pin size={16} />}
    </IconButton>
  )
}

import { ChevronDown } from 'lucide-react'
import type { Espace } from '../../../shared/espaces'

type WorkspaceSwitcherProps = {
  workspaces: Espace[]
  active: number | null
  onWorkspaceChange: (id: number) => void
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  compact?: boolean
}

// La couleur d'un espace est le nom d'un token (ARB-60) : jamais de valeur en dur.
const couleur = (espace: Espace) => `var(--color-workspace-${espace.couleur})`

// L'espace actif vient du processus principal (ARB-61) ; l'ouverture du menu reste dans Sidebar : le menu ouvert retient
// la barre au départ de la souris.
// shortcut: en mode compact, un clic passe à l'espace suivant, le menu n'ayant pas la place de s'ouvrir dans 68 px ; à
// reprendre avec la couche d'overlays (EP-06).
export function WorkspaceSwitcher({ workspaces, active, onWorkspaceChange, menuOpen, onMenuOpenChange, compact = false }: WorkspaceSwitcherProps) {
  // Sans espaces (base indisponible), il n'y a rien à choisir.
  if (workspaces.length === 0) return null
  const index = Math.max(0, workspaces.findIndex((item) => item.id === active))
  const activeWorkspace = workspaces[index]
  const onClick = compact ? () => onWorkspaceChange(workspaces[(index + 1) % workspaces.length].id) : () => onMenuOpenChange(!menuOpen)
  return (
    <>
      <button className="workspace-switcher" title={compact ? `Espace : ${activeWorkspace.nom} (cliquer pour changer)` : undefined} onClick={onClick}>
        <span className="workspace-dot" style={{ background: couleur(activeWorkspace) }} />
        <span>{activeWorkspace.nom}</span>
        <ChevronDown size={14} className="muted-icon" />
      </button>
      {menuOpen && !compact && <div className="workspace-menu">
        {workspaces.map((item) => <button key={item.id} onClick={() => { onWorkspaceChange(item.id); onMenuOpenChange(false) }}>
          <span className="workspace-dot" style={{ background: couleur(item) }} />{item.nom}
        </button>)}
      </div>}
    </>
  )
}

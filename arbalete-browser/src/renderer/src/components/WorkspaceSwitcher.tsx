import { ChevronDown } from 'lucide-react'

export const workspaces = [
  { id: 'dev', name: 'Développement', color: 'var(--color-workspace-development)', icon: '◆' },
  { id: 'personal', name: 'Personnel', color: 'var(--color-workspace-personal)', icon: '✳' },
  { id: 'research', name: 'Recherche', color: 'var(--color-workspace-research)', icon: '◈' }
]

type WorkspaceSwitcherProps = {
  workspace: string
  onWorkspaceChange: (id: string) => void
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  compact?: boolean
}

// L'espace choisi et l'ouverture du menu restent dans Sidebar : l'espace survit au repli de la barre, et le menu
// ouvert la retient au départ de la souris.
// shortcut: en mode compact, un clic passe à l'espace suivant, le menu n'ayant pas la place de s'ouvrir dans 68 px ; à
// reprendre avec la couche d'overlays (EP-06) quand les espaces seront réels.
export function WorkspaceSwitcher({ workspace, onWorkspaceChange, menuOpen, onMenuOpenChange, compact = false }: WorkspaceSwitcherProps) {
  const index = Math.max(0, workspaces.findIndex((item) => item.id === workspace))
  const activeWorkspace = workspaces[index]
  const onClick = compact ? () => onWorkspaceChange(workspaces[(index + 1) % workspaces.length].id) : () => onMenuOpenChange(!menuOpen)
  return (
    <>
      <button className="workspace-switcher" title={compact ? `Espace : ${activeWorkspace.name} (cliquer pour changer)` : undefined} onClick={onClick}>
        <span className="workspace-dot" style={{ background: activeWorkspace.color }} />
        <span>{activeWorkspace.name}</span>
        <ChevronDown size={14} className="muted-icon" />
      </button>
      {menuOpen && !compact && <div className="workspace-menu">
        {workspaces.map((item) => <button key={item.id} onClick={() => { onWorkspaceChange(item.id); onMenuOpenChange(false) }}>
          <span className="workspace-dot" style={{ background: item.color }} />{item.name}
        </button>)}
      </div>}
    </>
  )
}

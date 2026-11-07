import { ChevronDown } from 'lucide-react'

export const workspaces = [
  { id: 'dev', name: 'Développement', color: 'var(--color-workspace-development)', icon: '⌘' },
  { id: 'personal', name: 'Personnel', color: 'var(--color-workspace-personal)', icon: '✳' },
  { id: 'research', name: 'Recherche', color: 'var(--color-workspace-research)', icon: '◈' }
]

type WorkspaceSwitcherProps = {
  workspace: string
  onWorkspaceChange: (id: string) => void
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}

// L'espace choisi et l'ouverture du menu restent dans Sidebar : l'espace survit au repli de la barre, et le menu
// ouvert la retient au départ de la souris.
export function WorkspaceSwitcher({ workspace, onWorkspaceChange, menuOpen, onMenuOpenChange }: WorkspaceSwitcherProps) {
  const activeWorkspace = workspaces.find((item) => item.id === workspace) ?? workspaces[0]
  return (
    <>
      <button className="workspace-switcher" onClick={() => onMenuOpenChange(!menuOpen)}>
        <span className="workspace-dot" style={{ background: activeWorkspace.color }} />
        <span>{activeWorkspace.name}</span>
        <ChevronDown size={14} className="muted-icon" />
      </button>
      {menuOpen && <div className="workspace-menu">
        {workspaces.map((item) => <button key={item.id} onClick={() => { onWorkspaceChange(item.id); onMenuOpenChange(false) }}>
          <span className="workspace-dot" style={{ background: item.color }} />{item.name}
        </button>)}
      </div>}
    </>
  )
}

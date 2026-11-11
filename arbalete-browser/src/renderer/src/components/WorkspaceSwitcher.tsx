import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { LONGUEUR_MAX_NOM_ESPACE, type Espace } from '../../../shared/espaces'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'
import { Input } from './ui/Input'

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

// Ce que le menu est en train de faire d'une ligne : renommer un espace, en créer un, ou attendre la confirmation d'une
// suppression (qui ferme les onglets de l'espace).
type Action = { kind: 'renommer', id: number } | { kind: 'creer' } | { kind: 'supprimer', id: number }

// Champ de nom d'un espace (ARB-62) : Entrée valide, Échap annule, un nom vide ne se valide pas ; le processus principal
// revalide longueur et contenu.
function ChampNom({ initial, onValider, onAnnuler }: { initial: string, onValider: (nom: string) => void, onAnnuler: () => void }) {
  const [nom, setNom] = useState(initial)
  const valide = nom.trim().length > 0
  return (
    <Input autoFocus value={nom} maxLength={LONGUEUR_MAX_NOM_ESPACE} aria-label="Nom de l’espace" placeholder="Nom de l’espace"
      onChange={(event) => setNom(event.target.value)}
      onKeyDown={(event) => {
        // Les touches du champ ne doivent pas atteindre les raccourcis de la page ni fermer la barre.
        event.stopPropagation()
        if (event.key === 'Enter' && valide) onValider(nom.trim())
        if (event.key === 'Escape') onAnnuler()
      }} />
  )
}

// L'espace actif vient du processus principal (ARB-61) ; l'ouverture du menu reste dans Sidebar : le menu ouvert retient
// la barre au départ de la souris. Le menu gère les espaces (ARB-62) : création, renommage, ordre, suppression.
// shortcut: en mode compact, un clic passe à l'espace suivant, le menu n'ayant pas la place de s'ouvrir dans 68 px ; la
// gestion des espaces n'y est pas offerte. À reprendre avec la couche d'overlays (EP-06).
export function WorkspaceSwitcher({ workspaces, active, onWorkspaceChange, menuOpen, onMenuOpenChange, compact = false }: WorkspaceSwitcherProps) {
  const [action, setAction] = useState<Action | null>(null)
  // Un menu refermé ne garde ni saisie ni suppression en attente.
  useEffect(() => {
    if (!menuOpen) setAction(null)
  }, [menuOpen])
  // Sans espaces (base indisponible), il n'y a rien à choisir.
  if (workspaces.length === 0) return null
  const index = Math.max(0, workspaces.findIndex((item) => item.id === active))
  const activeWorkspace = workspaces[index]
  const onClick = compact ? () => onWorkspaceChange(workspaces[(index + 1) % workspaces.length].id) : () => onMenuOpenChange(!menuOpen)
  const terminer = () => setAction(null)
  return (
    <>
      <button className="workspace-switcher" title={compact ? `Espace : ${activeWorkspace.nom} (cliquer pour changer)` : undefined} onClick={onClick}>
        <span className="workspace-dot" style={{ background: couleur(activeWorkspace) }} />
        <span>{activeWorkspace.nom}</span>
        <ChevronDown size={14} className="muted-icon" />
      </button>
      {menuOpen && !compact && <div className="workspace-menu">
        {workspaces.map((item, rang) => {
          if (action?.kind === 'renommer' && action.id === item.id) {
            return <div key={item.id} className="workspace-row">
              <ChampNom initial={item.nom} onAnnuler={terminer}
                onValider={(nom) => { void window.arbalete.renameWorkspace(item.id, nom); terminer() }} />
            </div>
          }
          if (action?.kind === 'supprimer' && action.id === item.id) {
            return <div key={item.id} className="workspace-row workspace-row--confirm">
              <span className="workspace-confirm-text">Supprimer « {item.nom} » et fermer ses onglets ?</span>
              <Button size="sm" variant="destructive" onClick={() => { void window.arbalete.deleteWorkspace(item.id); terminer() }}>Supprimer</Button>
              <Button size="sm" onClick={terminer}>Annuler</Button>
            </div>
          }
          return <div key={item.id} className="workspace-row">
            <button className="workspace-choice" onClick={() => { onWorkspaceChange(item.id); onMenuOpenChange(false) }}>
              <span className="workspace-dot" style={{ background: couleur(item) }} /><span className="workspace-name">{item.nom}</span>
            </button>
            <IconButton size="sm" title={`Monter ${item.nom}`} disabled={rang === 0} onClick={() => void window.arbalete.moveWorkspace(item.id, -1)}><ArrowUp size={13} /></IconButton>
            <IconButton size="sm" title={`Descendre ${item.nom}`} disabled={rang === workspaces.length - 1} onClick={() => void window.arbalete.moveWorkspace(item.id, 1)}><ArrowDown size={13} /></IconButton>
            <IconButton size="sm" title={`Renommer ${item.nom}`} onClick={() => setAction({ kind: 'renommer', id: item.id })}><Pencil size={13} /></IconButton>
            <IconButton size="sm" title={`Supprimer ${item.nom}`} disabled={workspaces.length < 2} onClick={() => setAction({ kind: 'supprimer', id: item.id })}><Trash2 size={13} /></IconButton>
          </div>
        })}
        {action?.kind === 'creer'
          ? <div className="workspace-row">
              <ChampNom initial="" onAnnuler={terminer}
                onValider={(nom) => { void window.arbalete.createWorkspace(nom); terminer(); onMenuOpenChange(false) }} />
            </div>
          : <button className="workspace-add" onClick={() => setAction({ kind: 'creer' })}><Plus size={13} />Nouvel espace</button>}
      </div>}
    </>
  )
}

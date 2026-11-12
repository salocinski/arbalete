import { AlertTriangle, Globe2, Loader2, Pin, ShieldCheck, Volume2, VolumeX, X } from 'lucide-react'
import { IconButton } from './ui/IconButton'
import { cx } from './ui/cx'
import { etatsOnglet, iconeFavicon, iconeSonore } from './tabState'
import type { BrowserTab } from '../../../shared/types'

// Onglet de la barre latérale (DESIGN.md §5.3). Les états passent par des classes `tab-item--<état>` (tabState.ts) ;
// l'indicateur sonore et l'état Muted sont des icônes en plus de la couleur, jamais la couleur seule.
// shortcut: Muted s'affiche sans bouton pour couper le son ; à brancher avec la gestion du son par onglet.
// Glisser-déposer (ARB-68) : `drag` relie l'élément à la liste, qui garde l'onglet tenu et décide du déplacement.
// L'identifiant voyage dans le glissé : un dépôt venu d'ailleurs (texte, fichier) n'en porte pas et ne déplace rien.
const TYPE_GLISSE = 'application/x-arbalete-tab'
export type GlisserOnglet = { onDragStart: () => void; onDrop: (id: string) => void; onDragEnd: () => void; dragging: boolean }
export function TabItem({ tab, active, onSelect, onClose, onMenu, drag }: { tab: BrowserTab; active: boolean; onSelect: () => void; onClose: () => void; onMenu: (x: number, y: number) => void; drag?: GlisserOnglet }) {
  const etats = etatsOnglet(tab, active)
  const son = iconeSonore(tab)
  const favicon = iconeFavicon(tab)
  const sonore = son === 'muet' ? <span className="tab-audio" title="Onglet muet"><VolumeX size={12}/></span>
    : son === 'son' ? <span className="tab-audio" title="Cet onglet joue du son"><Volume2 size={12}/></span> : null
  return (
    <div className={cx('tab-item', ...etats.map((etat) => `tab-item--${etat}`), drag?.dragging && 'tab-item--dragging')} data-tab-id={tab.id}
      draggable={!!drag} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(TYPE_GLISSE, tab.id); drag?.onDragStart() }}
      onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); drag?.onDrop(event.dataTransfer.getData(TYPE_GLISSE)) }} onDragEnd={drag?.onDragEnd}
      onContextMenu={(event) => { event.preventDefault(); onMenu(event.clientX, event.clientY) }}>
      <button className="tab-select" title={tab.title} aria-current={active ? 'page' : undefined} onClick={onSelect}>
        <span className="tab-favicon">{favicon === 'erreur' ? <AlertTriangle size={14}/> : favicon === 'chargement' ? <Loader2 size={14} className="tab-spinner"/> : tab.favicon ? <img className="tab-favicon-img" draggable={false} src={tab.favicon} alt="" width={14} height={14}/> : <Globe2 size={14}/>}</span>
        <span className="tab-title">{tab.title}</span>
        {sonore}
        {etats.includes('error') && <span className="sr-only">, erreur de chargement</span>}
        {son && <span className="sr-only">{son === 'muet' ? ', muet' : ', joue du son'}</span>}
        {tab.pinned && <span className="sr-only">, épinglé</span>}
        {tab.url.startsWith('https://') && <span className="tab-secure"><ShieldCheck size={12}/></span>}
        {tab.pinned && <span className="tab-pin" title="Onglet épinglé"><Pin size={12}/></span>}
      </button>
      {!tab.pinned && <IconButton size="sm" className="tab-close" title="Fermer l'onglet" onClick={(event) => { event.stopPropagation(); onClose() }}><X size={14}/></IconButton>}
    </div>
  )
}

import { useLayoutEffect, useRef } from 'react'
import { TabItem } from './TabItem'
import type { BrowserState } from '../../../shared/types'

// onMenu : clic droit sur un onglet, avec la position du pointeur dans la vue (menu de l'onglet, ARB-39).
export function TabList({ state, onMenu }: { state: BrowserState; onMenu?: (tabId: string, x: number, y: number) => void }) {
  const liste = useRef<HTMLDivElement>(null)
  const positions = useRef(new Map<string, number>())
  // Les positions ne changent que si la liste des identifiants change, pas à chaque mise à jour de titre ou d'état.
  const cleOrdre = state.tabs.map((tab) => tab.id).join()

  // Réorganisation animée (DESIGN.md, Motion : 160 ms) : technique FLIP, chaque onglet déplacé part de son ancienne
  // position et glisse vers la nouvelle. prefers-reduced-motion coupe la transition (styles.css).
  useLayoutEffect(() => {
    const apres = new Map<string, number>()
    for (const el of liste.current?.querySelectorAll<HTMLElement>('.tab-item') ?? []) {
      const id = el.dataset.tabId!
      const haut = el.offsetTop
      apres.set(id, haut)
      const avant = positions.current.get(id)
      if (avant === undefined || avant === haut) continue
      el.style.transition = 'none'
      el.style.transform = `translateY(${avant - haut}px)`
      el.getBoundingClientRect() // force le calcul de style avant de lancer la transition
      el.style.transition = ''
      el.style.transform = ''
    }
    positions.current = apres
  }, [cleOrdre])

  return (
    <div className="tab-list" ref={liste}>
      {state.tabs.map((tab) => <TabItem key={tab.id} tab={tab} active={tab.id === state.activeTabId} onSelect={() => void window.arbalete.activateTab(tab.id)} onClose={() => void window.arbalete.closeTab(tab.id)}
        onMenu={(x, y) => onMenu?.(tab.id, x, y)} />)}
    </div>
  )
}

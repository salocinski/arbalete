// Raccourcis d'onglets de l'aperçu web (npm run dev:web). Dans Electron, le processus principal les intercepte avant
// l'interface, où que soit le focus (ARB-18), et ce code ne les reçoit pas. Renvoie true si la touche a été traitée.
export function handleTabShortcut(event: KeyboardEvent, activeTabId: string | null): boolean {
  const mod = event.ctrlKey || event.metaKey
  if (mod && event.key.toLowerCase() === 't') {
    event.preventDefault()
    void window.arbalete.createTab()
  } else if (mod && event.key.toLowerCase() === 'w') {
    event.preventDefault()
    if (activeTabId) void window.arbalete.closeTab(activeTabId)
  } else if (event.altKey && event.key === 'ArrowLeft') {
    void window.arbalete.goBack()
  } else if (event.altKey && event.key === 'ArrowRight') {
    void window.arbalete.goForward()
  } else {
    return false
  }
  return true
}

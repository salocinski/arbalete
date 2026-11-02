// Raccourcis d'onglets communs à la fenêtre et à la barre latérale : chacune est un document distinct, qui ne
// reçoit les touches que lorsqu'il a le focus. Renvoie true si la touche a été traitée.
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

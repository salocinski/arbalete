import { contextBridge, ipcRenderer } from 'electron'
import type { BrowserAPI } from '../shared/types'

// Abonnement à un canal diffusé par le processus principal ; renvoie la fonction de désabonnement.
function ecouter<T>(canal: string, callback: (valeur: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, valeur: T) => callback(valeur)
  ipcRenderer.on(canal, listener)
  return () => ipcRenderer.removeListener(canal, listener)
}

const api: BrowserAPI = {
  getState: () => ipcRenderer.invoke('browser:get-state'),
  createTab: (url) => ipcRenderer.invoke('browser:create-tab', url),
  closeTab: (id) => ipcRenderer.invoke('browser:close-tab', id),
  activateTab: (id) => ipcRenderer.invoke('browser:activate-tab', id),
  navigate: (url) => ipcRenderer.invoke('browser:navigate', url),
  goBack: () => ipcRenderer.invoke('browser:back'),
  goForward: () => ipcRenderer.invoke('browser:forward'),
  reload: () => ipcRenderer.invoke('browser:reload'),
  setContentBounds: (bounds) => ipcRenderer.send('browser:set-content-bounds', bounds),
  getSystemTheme: () => ipcRenderer.invoke('browser:get-system-theme'),
  onSystemTheme: (callback) => ecouter('browser:system-theme', callback),
  onState: (callback) => ecouter('browser:state', callback),
  getSidebar: () => ipcRenderer.invoke('browser:get-sidebar'),
  setSidebar: (action) => ipcRenderer.invoke('browser:set-sidebar', action),
  onSidebar: (callback) => ecouter('browser:sidebar', callback),
  setSidebarWidth: (width) => ipcRenderer.invoke('browser:set-sidebar-width', width),
  getOverlay: () => ipcRenderer.invoke('browser:get-overlay'),
  setOverlay: (open) => ipcRenderer.invoke('browser:set-overlay', open),
  onOverlay: (callback) => ecouter('browser:overlay', callback),
  suggest: (text, anchor) => ipcRenderer.invoke('browser:suggest', text, anchor),
  moveSuggestion: (step) => ipcRenderer.invoke('browser:suggest-move', step),
  chooseSuggestion: (index): Promise<boolean> => ipcRenderer.invoke('browser:suggest-choose', index),
  closeSuggestions: () => ipcRenderer.invoke('browser:suggest-close'),
  getSuggestions: () => ipcRenderer.invoke('browser:get-suggestions'),
  onSuggestions: (callback) => ecouter('browser:suggestions', callback),
  findInPage: (text, forward, next) => ipcRenderer.invoke('browser:find', text, forward, next),
  closeFind: () => ipcRenderer.invoke('browser:find-close'),
  onFindResult: (callback) => ecouter('browser:find-result', callback),
  onFindFocus: (callback) => ecouter('browser:find-focus', callback),
  getTheme: () => ipcRenderer.invoke('browser:get-theme'),
  setTheme: (choice) => ipcRenderer.invoke('browser:set-theme', choice),
  onTheme: (callback) => ecouter('browser:theme', callback),
  onFocusAddress: (callback) => ecouter('browser:focus-address', callback),
  getRestoreOffer: () => ipcRenderer.invoke('browser:get-restore-offer'),
  onRestoreOffer: (callback) => ecouter('browser:restore-offer', callback),
  answerRestoreOffer: (answer) => ipcRenderer.invoke('browser:answer-restore-offer', answer),
  getDataIncident: () => ipcRenderer.invoke('browser:get-data-incident'),
  onDataIncident: (callback) => ecouter('browser:data-incident', callback),
  dismissDataIncident: () => ipcRenderer.invoke('browser:dismiss-data-incident')
}

contextBridge.exposeInMainWorld('arbalete', api)

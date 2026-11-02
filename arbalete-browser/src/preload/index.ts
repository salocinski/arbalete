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
  getTheme: () => ipcRenderer.invoke('browser:get-theme'),
  setTheme: (choice) => ipcRenderer.invoke('browser:set-theme', choice),
  onTheme: (callback) => ecouter('browser:theme', callback),
  onFocusAddress: (callback) => ecouter('browser:focus-address', callback)
}

contextBridge.exposeInMainWorld('arbalete', api)

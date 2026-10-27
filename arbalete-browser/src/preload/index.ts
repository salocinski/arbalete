import { contextBridge, ipcRenderer } from 'electron'
import type { BrowserAPI, BrowserState } from '../shared/types'

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
  onSystemTheme: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: 'dark' | 'light') => callback(theme)
    ipcRenderer.on('browser:system-theme', listener)
    return () => ipcRenderer.removeListener('browser:system-theme', listener)
  },
  onState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: BrowserState) => callback(state)
    ipcRenderer.on('browser:state', listener)
    return () => ipcRenderer.removeListener('browser:state', listener)
  }
}

contextBridge.exposeInMainWorld('arbalete', api)

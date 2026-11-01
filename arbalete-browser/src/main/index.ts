import { app, BrowserWindow, WebContentsView, ipcMain, session, nativeTheme, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { BrowserState, BrowserTab } from '../shared/types'

const CHEMIN_INTERFACE = join(__dirname, '../renderer/index.html')

type TabRecord = {
  data: BrowserTab
  view: WebContentsView
}

let mainWindow: BrowserWindow | null = null
const tabs = new Map<string, TabRecord>()
let activeTabId: string | null = null
let nextTabNumber = 1
let contentBounds = { x: 252, y: 106, width: 900, height: 600 }

function normalizeUrl(input: string): string {
  const value = input.trim()
  if (!value) return 'https://www.google.com'
  if (/^(https?:\/\/|file:\/\/)/i.test(value)) return value
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(value)) return `http://${value}`
  if (!value.includes(' ') && value.includes('.') && !value.startsWith('about:')) return `https://${value}`
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`
}

function stateSnapshot(): BrowserState {
  return {
    tabs: [...tabs.values()].map((tab) => ({ ...tab.data })),
    activeTabId
  }
}

function broadcastState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('browser:state', stateSnapshot())
  }
}

function setActiveView() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  for (const [id, record] of tabs) {
    try {
      mainWindow.contentView.removeChildView(record.view)
    } catch {
      // La vue peut déjà être détachée.
    }
    if (id === activeTabId) {
      mainWindow.contentView.addChildView(record.view)
      record.view.setBounds(contentBounds)
    }
  }
}

function updateTabFromView(id: string) {
  const record = tabs.get(id)
  if (!record) return
  const wc = record.view.webContents
  record.data = {
    ...record.data,
    title: wc.getTitle() || record.data.title || 'Nouvel onglet',
    url: wc.getURL() || record.data.url,
    isLoading: wc.isLoading(),
    canGoBack: wc.navigationHistory.canGoBack(),
    canGoForward: wc.navigationHistory.canGoForward()
  }
  broadcastState()
}

function createTab(initialUrl = 'https://www.google.com'): string {
  const id = `tab-${nextTabNumber++}`
  const view = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      session: session.defaultSession
    }
  })

  const record: TabRecord = {
    data: {
      id,
      title: 'Nouvel onglet',
      url: normalizeUrl(initialUrl),
      isLoading: true,
      canGoBack: false,
      canGoForward: false
    },
    view
  }
  tabs.set(id, record)

  view.webContents.on('page-title-updated', () => updateTabFromView(id))
  view.webContents.on('did-navigate', () => updateTabFromView(id))
  view.webContents.on('did-navigate-in-page', () => updateTabFromView(id))
  view.webContents.on('did-start-loading', () => updateTabFromView(id))
  view.webContents.on('did-stop-loading', () => updateTabFromView(id))
  view.webContents.setWindowOpenHandler(({ url }) => {
    void createTab(url)
    return { action: 'deny' }
  })
  view.webContents.on('will-navigate', (event, url) => {
    if (!/^https?:\/\//i.test(url) && !/^file:\/\//i.test(url)) event.preventDefault()
  })

  activeTabId = id
  setActiveView()
  void view.webContents.loadURL(record.data.url).catch((error) => {
    console.error('Navigation impossible:', error)
  })
  broadcastState()
  return id
}

function closeTab(id: string) {
  const record = tabs.get(id)
  if (!record) return
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.contentView.removeChildView(record.view) } catch {}
  }
  record.view.webContents.close()
  tabs.delete(id)

  if (activeTabId === id) {
    activeTabId = [...tabs.keys()].at(-1) ?? null
  }
  if (!tabs.size) createTab()
  else {
    setActiveView()
    broadcastState()
  }
}

function activeRecord(): TabRecord | undefined {
  return activeTabId ? tabs.get(activeTabId) : undefined
}

// L'interface est servie par Vite en développement (ELECTRON_RENDERER_URL) et depuis out/renderer en build.
function estUrlInterface(url: string): boolean {
  let adresse: URL
  try { adresse = new URL(url) } catch { return false }
  const urlDev = process.env.ELECTRON_RENDERER_URL
  if (urlDev) return adresse.origin === new URL(urlDev).origin
  return adresse.protocol === 'file:' && adresse.pathname === pathToFileURL(CHEMIN_INTERFACE).pathname
}

// Seul le cadre principal de la fenêtre d'interface pilote le processus principal (ARB-14) :
// une autre page qui obtiendrait le preload, un iframe ou une fenêtre intruse est refusé.
function emetteurAutorise(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const cadre = event.senderFrame
  const autorise = !!mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents
    && cadre !== null && cadre.parent === null && estUrlInterface(cadre.url)
  if (!autorise) console.warn(`IPC refusé : émetteur non autorisé (${cadre?.url ?? 'cadre détruit'})`)
  return autorise
}

function traiter(canal: string, gestionnaire: (...args: unknown[]) => unknown) {
  ipcMain.handle(canal, (event, ...args) => {
    if (!emetteurAutorise(event)) throw new Error('Émetteur IPC non autorisé')
    return gestionnaire(...args)
  })
}

function exigerTexte(valeur: unknown): string {
  if (typeof valeur !== 'string') throw new Error('Argument IPC invalide : texte attendu')
  return valeur
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#101116',
    title: 'Arbalète',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // L'interface ne navigue jamais et n'ouvre aucune fenêtre (ARB-12) : un lien glissé sur la barre
  // latérale ou un script injecté ne peut pas remplacer l'interface, qui garde l'accès au preload.
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(CHEMIN_INTERFACE)
  }

  mainWindow.on('resize', () => {
    activeRecord()?.view.setBounds(contentBounds)
  })
  mainWindow.on('closed', () => { mainWindow = null })
  createTab()
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    // Politique de départ restrictive : aucune permission distante n'est accordée automatiquement.
    callback(false)
  })

  traiter('browser:get-state', () => stateSnapshot())
  traiter('browser:get-system-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('browser:system-theme', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  })
  traiter('browser:create-tab', (url) => createTab(url === undefined ? undefined : exigerTexte(url)))
  traiter('browser:close-tab', (id) => closeTab(exigerTexte(id)))
  traiter('browser:activate-tab', (valeur) => {
    const id = exigerTexte(valeur)
    if (!tabs.has(id)) return
    activeTabId = id
    setActiveView()
    updateTabFromView(id)
  })
  traiter('browser:navigate', (valeur) => {
    const url = exigerTexte(valeur)
    const record = activeRecord()
    if (!record) return
    const normalized = normalizeUrl(url)
    record.data.url = normalized
    void record.view.webContents.loadURL(normalized).catch(console.error)
    broadcastState()
  })
  traiter('browser:back', () => {
    const wc = activeRecord()?.view.webContents
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  })
  traiter('browser:forward', () => {
    const wc = activeRecord()?.view.webContents
    if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
  })
  traiter('browser:reload', () => activeRecord()?.view.webContents.reload())
  ipcMain.on('browser:set-content-bounds', (event, bounds) => {
    if (!emetteurAutorise(event)) return
    if (![bounds?.x, bounds?.y, bounds?.width, bounds?.height].every(Number.isFinite)) return
    contentBounds = {
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(0, Math.round(bounds.width)),
      height: Math.max(0, Math.round(bounds.height))
    }
    activeRecord()?.view.setBounds(contentBounds)
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

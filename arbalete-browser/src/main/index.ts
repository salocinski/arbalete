import { app, BrowserWindow, WebContentsView, ipcMain, session, nativeTheme } from 'electron'
import { join } from 'node:path'
import type { BrowserState, BrowserTab } from '../shared/types'

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

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
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

  ipcMain.handle('browser:get-state', () => stateSnapshot())
  ipcMain.handle('browser:get-system-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('browser:system-theme', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  })
  ipcMain.handle('browser:create-tab', (_event, url?: string) => createTab(url))
  ipcMain.handle('browser:close-tab', (_event, id: string) => closeTab(id))
  ipcMain.handle('browser:activate-tab', (_event, id: string) => {
    if (!tabs.has(id)) return
    activeTabId = id
    setActiveView()
    updateTabFromView(id)
  })
  ipcMain.handle('browser:navigate', (_event, url: string) => {
    const record = activeRecord()
    if (!record) return
    const normalized = normalizeUrl(url)
    record.data.url = normalized
    void record.view.webContents.loadURL(normalized).catch(console.error)
    broadcastState()
  })
  ipcMain.handle('browser:back', () => {
    const wc = activeRecord()?.view.webContents
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  })
  ipcMain.handle('browser:forward', () => {
    const wc = activeRecord()?.view.webContents
    if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
  })
  ipcMain.handle('browser:reload', () => activeRecord()?.view.webContents.reload())
  ipcMain.on('browser:set-content-bounds', (_event, bounds) => {
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

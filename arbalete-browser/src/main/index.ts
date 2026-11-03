import { app, BrowserWindow, Menu, WebContentsView, ipcMain, session, nativeTheme, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { isAbsolute, join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import type { BrowserState, BrowserTab, SidebarAction, SidebarState, ThemeChoice } from '../shared/types'
import { ouvrirBase } from './donnees/base.ts'
import { creerEcritureDifferee } from './donnees/ecritureDifferee.ts'
import { lireSession, ongletsARestaurer, sauverSession, type OngletSauve } from './donnees/session.ts'

const CHEMIN_INTERFACE = join(__dirname, '../renderer/index.html')

type TabRecord = {
  data: BrowserTab
  view: WebContentsView
  // Page demandée à la vue. Un onglet restauré en arrière-plan (ARB-45) attend d'être affiché pour charger.
  chargee: boolean
}

let mainWindow: BrowserWindow | null = null
// Base de données (ARB-43, décision 0001). null si elle n'a pas pu s'ouvrir : le navigateur marche sans persistance.
let base: DatabaseSync | null = null
// Barre latérale (ARB-33) : vue native au-dessus de l'onglet, car une WebContentsView masque tout HTML de la fenêtre
// (règle 4). Masquée, elle n'est qu'une bande transparente au bord gauche qui détecte le survol.
let barreView: WebContentsView | null = null
let barre: SidebarState = { open: false, pinned: false }
// Jumelles de .sidebar / .sidebar-reserve (252) et .sidebar-hover-strip (6) dans styles.css : les changer ensemble.
const LARGEUR_BARRE = 252
const LARGEUR_BANDE = 6
let choixTheme: ThemeChoice = 'system'
const tabs = new Map<string, TabRecord>()
let activeTabId: string | null = null
let nextTabNumber = 1
// Bornes de la vue web avant que l'interface envoie les siennes : pleine largeur sous la barre d'outils (64 px),
// la barre latérale étant masquée à l'ouverture (ARB-33).
let contentBounds = { x: 0, y: 64, width: 900, height: 600 }

// Une seule instance d'Arbalète (ARB-117) : deux instances partageraient arbalete.db et écraseraient la session l'une
// de l'autre. Un second lancement transmet ses adresses à la première instance, puis se ferme sans ouvrir la base.
const ADRESSES_MAX_PAR_LANCEMENT = 10

// Adresses web passées au lancement (arbalete.exe https://…) : seules les adresses http(s) sont ouvertes, les options
// de Chromium et les chemins sont ignorés.
function adressesLancees(valeurs: unknown): string[] {
  if (!Array.isArray(valeurs)) return []
  return valeurs
    .filter((valeur): valeur is string => typeof valeur === 'string' && /^https?:\/\/\S+$/i.test(valeur) && URL.canParse(valeur))
    .slice(0, ADRESSES_MAX_PAR_LANCEMENT)
}

// Profil de données des tests (ARB-118) : les tests Playwright lancent l'app avec ARBALETE_PROFIL_TEST pointant vers
// un dossier temporaire, pour ne jamais lire ni écrire l'arbalete.db de l'utilisateur. Lu avant le verrou d'instance
// unique, qui dépend du dossier userData : l'app des tests ne bute donc pas sur un Arbalète déjà ouvert. Ignoré dans
// l'app empaquetée.
const profilTest = app.isPackaged ? undefined : process.env.ARBALETE_PROFIL_TEST
if (profilTest && isAbsolute(profilTest)) app.setPath('userData', profilTest)

const adressesAuLancement = adressesLancees(process.argv.slice(1))
// Les adresses passent par additionalData : Windows peut réordonner ou compléter l'argv reçu par second-instance.
const instancePrincipale = app.requestSingleInstanceLock({ adresses: adressesAuLancement })
if (!instancePrincipale) app.quit()

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

// Les deux vues de l'interface : la fenêtre (barre d'outils, zone de page) et la barre latérale.
function contenusInterface(): WebContents[] {
  const fenetre = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : undefined
  return [fenetre, barreView?.webContents]
    .filter((contenu): contenu is WebContents => !!contenu && !contenu.isDestroyed())
}

function envoyerAuxInterfaces(canal: string, valeur: unknown) {
  for (const contenu of contenusInterface()) contenu.send(canal, valeur)
}

// Session des onglets (ARB-44) : écrite une seconde après le dernier changement, au plus tard 5 secondes après le
// premier, et à la fermeture. Les chargements changent l'état sans changer la session : une session identique à la
// dernière écrite n'est pas réécrite.
let derniereSessionEcrite = ''

function ecrireSession() {
  if (!base) return
  const onglets: OngletSauve[] = [...tabs.values()].map(({ data }) => ({
    url: data.url,
    titre: data.title,
    actif: data.id === activeTabId
  }))
  const serialisee = JSON.stringify(onglets)
  if (serialisee === derniereSessionEcrite) return
  try {
    sauverSession(base, onglets)
    derniereSessionEcrite = serialisee
  } catch (erreur) {
    console.error('Session des onglets non enregistrée :', erreur)
  }
}

const sauvegardeSession = creerEcritureDifferee(ecrireSession, 1000, 5000)

function broadcastState() {
  envoyerAuxInterfaces('browser:state', stateSnapshot())
  sauvegardeSession.demander()
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
      chargerOnglet(record)
    }
  }
  // Réajouter une vue déjà présente la remet au premier plan : la barre reste au-dessus de l'onglet affiché.
  if (barreView) mainWindow.contentView.addChildView(barreView)
}

// Ouverte ou épinglée : pleine largeur de barre sur toute la hauteur ; masquée : la bande de survol.
function placerBarre() {
  if (!mainWindow || mainWindow.isDestroyed() || !barreView) return
  const { height } = mainWindow.getContentBounds()
  barreView.setBounds({ x: 0, y: 0, width: barre.open ? LARGEUR_BARRE : LARGEUR_BANDE, height })
}

// Masquer n'agit pas sur une barre épinglée ; désépingler la referme.
function agirSurBarre(action: SidebarAction) {
  const suivant: SidebarState =
    action === 'open' ? { ...barre, open: true }
      : action === 'hide' ? (barre.pinned ? barre : { open: false, pinned: false })
        : barre.pinned ? { open: false, pinned: false } : { open: true, pinned: true }
  if (suivant.open === barre.open && suivant.pinned === barre.pinned) return
  barre = suivant
  placerBarre()
  envoyerAuxInterfaces('browser:sidebar', barre)
}

// Un clic dans la page ou dans la barre d'outils retire la barre non épinglée. Le clic, pas le focus : au démarrage le
// focus passe de lui-même d'une vue à l'autre, et une page le reprend à la fin de son chargement.
function masquerAuClic(contenu: WebContents) {
  contenu.on('before-mouse-event', (_event, souris) => {
    if (souris.type === 'mouseDown') agirSurBarre('hide')
  })
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

// Ouvertures demandées par les pages (window.open, target=_blank) : seules les adresses web passent (ARB-102),
// sinon une page http ouvrirait file:// via loadURL depuis le processus principal, que Chromium ne bloque pas.
// Une page ne peut ouvrir que OUVERTURES_MAX onglets par fenêtre glissante, contre les rafales de window.open, et
// toutes les pages réunies OUVERTURES_MAX_TOTAL : chaque onglet ouvert ayant son propre quota, une page qui se
// rouvre en chaîne passerait sinon de 5 à 25 puis 125 onglets.
// Le rythme ne suffit pas : à 20 par 10 s, une page qui s'entretient remplirait la mémoire. Au-delà de
// ONGLETS_MAX_POUR_LES_PAGES onglets ouverts, les pages n'en ouvrent plus ; l'utilisateur, lui, le peut toujours.
const OUVERTURES_MAX = 5
const OUVERTURES_MAX_TOTAL = 20
const ONGLETS_MAX_POUR_LES_PAGES = 50
const FENETRE_OUVERTURES_MS = 10_000
const TOUTES_LES_PAGES = '*'
const ouvertures = new Map<string, number[]>()

function ouverturesRecentes(cle: string, maintenant: number): number[] {
  const recentes = (ouvertures.get(cle) ?? []).filter((instant) => maintenant - instant < FENETRE_OUVERTURES_MS)
  ouvertures.set(cle, recentes)
  return recentes
}

function ouvertureAutorisee(onglet: string, url: string): boolean {
  if (!/^https?:\/\//i.test(url) || tabs.size >= ONGLETS_MAX_POUR_LES_PAGES) return false
  const maintenant = Date.now()
  const parOnglet = ouverturesRecentes(onglet, maintenant)
  const total = ouverturesRecentes(TOUTES_LES_PAGES, maintenant)
  const autorisee = parOnglet.length < OUVERTURES_MAX && total.length < OUVERTURES_MAX_TOTAL
  if (autorisee) {
    parOnglet.push(maintenant)
    total.push(maintenant)
  }
  return autorisee
}

// Sans menu d'application, F12 n'ouvre plus rien : on le garde en développement seulement. La touche arrive au
// webContents qui a le focus (l'interface ou la page d'un onglet) : on écoute les deux, et F12 ouvre toujours les
// DevTools de l'interface (règle 5). Tout F12 est consommé (relâchement et répétitions d'un appui long compris) ;
// seul le premier appui bascule les DevTools.
function brancherF12(contenu: WebContents) {
  if (!URL_DEV) return
  contenu.on('before-input-event', (event, input) => {
    if (input.key !== 'F12') return
    event.preventDefault()
    if (input.type === 'keyDown' && !input.isAutoRepeat) mainWindow?.webContents.toggleDevTools()
  })
}

function reculer() {
  const wc = activeRecord()?.view.webContents
  if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
}

function avancer() {
  const wc = activeRecord()?.view.webContents
  if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
}

// Ctrl+L depuis une page ou la barre latérale : le focus clavier passe à la fenêtre, puis l'interface sélectionne la
// barre d'adresse.
function focaliserAdresse() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.focus()
  mainWindow.webContents.send('browser:focus-address')
}

// Action du raccourci d'Arbalète que forme la touche, ou undefined. AltGr arrive comme Ctrl+Alt : il est écarté.
function actionDuRaccourci(input: Electron.Input): (() => void) | undefined {
  // Disposition non latine (russe, grec…) : key est une lettre d'un autre alphabet, la touche physique (code) prend le
  // relais. Une lettre latine accentuée (é, è du BÉPO) garde son sens : Ctrl+é ne ferme pas l'onglet.
  const nonLatine = /^\p{L}$/u.test(input.key) && !/\p{Script=Latin}/u.test(input.key)
  const touche = nonLatine ? input.code.replace(/^Key/, '').toLowerCase() : input.key.toLowerCase()
  if (input.control && !input.alt && !input.meta) {
    if (input.shift) return touche === 'b' ? () => agirSurBarre('toggle-pin') : undefined
    // Comme Chrome : le nouvel onglet donne la main à la barre d'adresse, la fermeture à l'onglet qui devient actif.
    if (touche === 't') return () => { createTab(); focaliserAdresse() }
    if (touche === 'w') return () => {
      if (activeTabId) closeTab(activeTabId)
      activeRecord()?.view.webContents.focus()
    }
    if (touche === 'l') return focaliserAdresse
  } else if (input.alt && !input.control && !input.shift && !input.meta) {
    if (input.key === 'ArrowLeft') return reculer
    if (input.key === 'ArrowRight') return avancer
  }
  return undefined
}

// Raccourcis d'Arbalète (ARB-18) : Ctrl+T, Ctrl+W, Ctrl+L, Alt+←/→ et Ctrl+Maj+B agissent quel que soit le
// webContents qui a le focus, la fenêtre, la barre latérale ou la page d'un onglet (règle 5). Le webContents ne reçoit
// pas la combinaison (relâchement et répétitions compris) ; seul le premier appui agit.
function brancherRaccourcis(contenu: WebContents) {
  contenu.on('before-input-event', (event, input) => {
    const action = actionDuRaccourci(input)
    if (!action) return
    event.preventDefault()
    if (input.type === 'keyDown' && !input.isAutoRepeat) action()
  })
}

// Chargement paresseux (ARB-45) : la page d'un onglet n'est demandée qu'une fois, quand il est affiché.
function chargerOnglet(record: TabRecord) {
  if (record.chargee) return
  record.chargee = true
  void record.view.webContents.loadURL(record.data.url).catch((error) => {
    console.error('Navigation impossible:', error)
  })
}

// Un onglet restauré (ARB-45) s'ouvre en arrière-plan avec son titre enregistré ; sa page attend d'être affichée.
function createTab(initialUrl = 'https://www.google.com', restaure?: { titre: string }): string {
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
      title: restaure?.titre || 'Nouvel onglet',
      url: normalizeUrl(initialUrl),
      isLoading: !restaure,
      canGoBack: false,
      canGoForward: false
    },
    view,
    chargee: false
  }
  tabs.set(id, record)

  view.webContents.on('page-title-updated', () => updateTabFromView(id))
  view.webContents.on('did-navigate', () => updateTabFromView(id))
  view.webContents.on('did-navigate-in-page', () => updateTabFromView(id))
  view.webContents.on('did-start-loading', () => updateTabFromView(id))
  view.webContents.on('did-stop-loading', () => updateTabFromView(id))
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (ouvertureAutorisee(id, url)) void createTab(url)
    return { action: 'deny' }
  })
  view.webContents.on('will-navigate', (event, url) => {
    if (!/^https?:\/\//i.test(url) && !/^file:\/\//i.test(url)) event.preventDefault()
  })
  brancherF12(view.webContents)
  brancherRaccourcis(view.webContents)
  masquerAuClic(view.webContents)

  if (!restaure) {
    activeTabId = id
    setActiveView()
  }
  broadcastState()
  return id
}

// Rouvre les onglets de la dernière session (ARB-45), dans leur ordre ; seul l'onglet actif charge sa page. Renvoie
// false si rien n'a été rouvert : pas de base, session vide ou illisible.
function restaurerSession(): boolean {
  if (!base || tabs.size) return false
  let session: OngletSauve[]
  try {
    session = lireSession(base)
  } catch (erreur) {
    console.error('Session des onglets illisible, rien n’est restauré :', erreur)
    return false
  }
  const { onglets, actif } = ongletsARestaurer(session)
  const ids = onglets.map((onglet) => createTab(onglet.url, { titre: onglet.titre }))
  if (!ids.length) return false
  activeTabId = ids[actif]
  setActiveView()
  broadcastState()
  return true
}

function closeTab(id: string) {
  const record = tabs.get(id)
  if (!record) return
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.contentView.removeChildView(record.view) } catch {}
  }
  record.view.webContents.close()
  tabs.delete(id)
  ouvertures.delete(id)

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
// Une app empaquetée ignore la variable : sinon elle chargerait, avec le preload, l'URL qu'on lui désigne.
const URL_DEV = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL

function estUrlInterface(url: string): boolean {
  let adresse: URL
  try { adresse = new URL(url) } catch { return false }
  if (URL_DEV) return adresse.origin === new URL(URL_DEV).origin
  // L'hôte vide écarte un chemin UNC (file://serveur/...) de même chemin que l'interface.
  return adresse.protocol === 'file:' && adresse.host === ''
    && adresse.pathname === pathToFileURL(CHEMIN_INTERFACE).pathname
}

// Seul le cadre principal des vues de l'interface (fenêtre et barre latérale) pilote le processus principal (ARB-14) :
// une autre page qui obtiendrait le preload, un iframe ou une fenêtre intruse est refusé.
function emetteurAutorise(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const cadre = event.senderFrame
  const autorise = contenusInterface().includes(event.sender)
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

const PREFERENCES_INTERFACE = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}

// L'interface ne navigue jamais et n'ouvre aucune fenêtre (ARB-12) : un lien glissé sur la barre
// latérale ou un script injecté ne peut pas remplacer l'interface, qui garde l'accès au preload.
function verrouillerInterface(contenu: WebContents) {
  contenu.on('will-navigate', (event) => event.preventDefault())
  contenu.setWindowOpenHandler(() => ({ action: 'deny' }))
  contenu.on('will-attach-webview', (event) => event.preventDefault())
  brancherF12(contenu)
  brancherRaccourcis(contenu)
}

// Même page que la fenêtre, avec ?vue=barre : le renderer n'y affiche que la barre latérale.
function chargerInterface(contenu: WebContents, vue?: string) {
  if (URL_DEV) {
    const url = new URL(URL_DEV)
    if (vue) url.searchParams.set('vue', vue)
    void contenu.loadURL(url.href)
  } else {
    void contenu.loadFile(CHEMIN_INTERFACE, vue ? { query: { vue } } : undefined)
  }
}

function createWindow(adresses: readonly string[] = []) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#101116',
    title: 'Arbalète',
    autoHideMenuBar: true,
    webPreferences: PREFERENCES_INTERFACE
  })
  verrouillerInterface(mainWindow.webContents)
  masquerAuClic(mainWindow.webContents)
  chargerInterface(mainWindow.webContents)

  barreView = new WebContentsView({ webPreferences: PREFERENCES_INTERFACE })
  barreView.setBackgroundColor('#00000000')
  verrouillerInterface(barreView.webContents)
  chargerInterface(barreView.webContents, 'barre')
  // Au démarrage, le focus clavier revient sinon à la dernière vue chargée, parfois la barre masquée (ARB-110) : on
  // le rend à la page de l'onglet actif.
  barreView.webContents.once('did-finish-load', () => {
    if (!barre.open) activeRecord()?.view.webContents.focus()
  })
  mainWindow.contentView.addChildView(barreView)
  placerBarre()

  mainWindow.on('resize', () => {
    activeRecord()?.view.setBounds(contentBounds)
    placerBarre()
  })
  // Avant que les vues des onglets disparaissent : la session écrite est celle que l'utilisateur ferme.
  mainWindow.on('close', () => sauvegardeSession.vider())
  mainWindow.on('closed', () => {
    mainWindow = null
    barreView = null
  })
  // Les adresses du lancement s'ouvrent après la session restaurée, la dernière au premier plan (ARB-117, ARB-45).
  const restauree = restaurerSession()
  if (adresses.length) adresses.forEach((adresse) => createTab(adresse))
  else if (!restauree) createTab()
}

function exigerChoix<T extends string>(valeur: unknown, choix: readonly T[]): T {
  if (!choix.includes(valeur as T)) throw new Error(`Argument IPC invalide : ${choix.join(', ')} attendu`)
  return valeur as T
}

app.whenReady().then(() => {
  if (!instancePrincipale) return
  // Pas de menu d'application (ARB-101) : celui d'Electron, même masqué par autoHideMenuBar, ouvre les DevTools de
  // l'interface (Ctrl+Maj+I, avec window.arbalete dans la console) et la recharge (Ctrl+R). Les raccourcis
  // d'Arbalète passent par l'interface ou le processus principal, pas par ce menu.
  Menu.setApplicationMenu(null)

  try {
    base = ouvrirBase(join(app.getPath('userData'), 'arbalete.db'))
  } catch (erreur) {
    console.error('Base de données indisponible, aucune donnée ne sera conservée :', erreur)
  }

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    // Politique de départ restrictive : aucune permission distante n'est accordée automatiquement.
    callback(false)
  })

  traiter('browser:get-state', () => stateSnapshot())
  traiter('browser:get-system-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  nativeTheme.on('updated', () => {
    envoyerAuxInterfaces('browser:system-theme', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  })
  // Le thème choisi est tenu ici pour que la fenêtre et la barre latérale l'affichent ensemble.
  traiter('browser:get-theme', () => choixTheme)
  traiter('browser:set-theme', (valeur) => {
    choixTheme = exigerChoix(valeur, ['system', 'dark', 'light'] as const)
    envoyerAuxInterfaces('browser:theme', choixTheme)
  })
  traiter('browser:get-sidebar', () => ({ ...barre }))
  traiter('browser:set-sidebar', (valeur) => agirSurBarre(exigerChoix(valeur, ['open', 'hide', 'toggle-pin'] as const)))
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
  traiter('browser:back', reculer)
  traiter('browser:forward', avancer)
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

  createWindow(adressesAuLancement)
  app.on('second-instance', (_event, _argv, _dossier, donnees) => {
    if (!mainWindow) return
    adressesLancees((donnees as { adresses?: unknown } | null)?.adresses).forEach((adresse) => createTab(adresse))
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  sauvegardeSession.vider()
  base?.close()
  base = null
})

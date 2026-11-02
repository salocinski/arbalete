import { resolve } from 'node:path'
import { createServer, type InlineConfig, type ViteDevServer } from 'vite'
import { _electron as electron, expect, test, type ConsoleMessage, type ElectronApplication, type Page } from '@playwright/test'
import configElectron from '../electron.vite.config'

// Mode développement (npm run dev) : l'interface est servie par le serveur Vite et le processus principal construit
// (out/main) la charge via ELECTRON_RENDERER_URL. On réutilise la configuration renderer d'electron.vite.config.ts
// (plugins React et CSP, alias) pour lancer le même serveur que electron-vite dev, sans dépendance supplémentaire.

let serveur: ViteDevServer | undefined
let app: ElectronApplication | undefined
let ui: Page
let origineDev: string

test.describe.configure({ mode: 'serial' })

// Serveur Vite et app lancés une fois pour tous les tests du fichier : chacun peut tourner seul (--grep, relance).
test.beforeAll(async () => {
  const renderer = (configElectron as { renderer: InlineConfig }).renderer
  serveur = await createServer({
    configFile: false,
    root: resolve(__dirname, '../src/renderer'),
    resolve: renderer.resolve,
    plugins: renderer.plugins,
    logLevel: 'warn',
    server: { host: 'localhost', port: 0, strictPort: false }
  })
  await serveur.listen()
  const urlDev = serveur.resolvedUrls?.local[0]
  expect(urlDev).toBeTruthy()
  origineDev = new URL(urlDev!).origin

  app = await electron.launch({
    args: ['.'],
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, ELECTRON_RENDERER_URL: urlDev! }
  })
  const estInterface = (url: string) => url.startsWith(origineDev)
  ui = app.windows().find((page) => estInterface(page.url()))
    ?? await app.waitForEvent('window', { predicate: (page) => estInterface(page.url()) })
})

test.afterAll(async () => {
  await app?.close()
  await serveur?.close()
})

// Value: protects=branche de développement d'ARB-13/14 : l'interface servie par Vite (origine d'ELECTRON_RENDERER_URL)
//   est acceptée par emetteurAutorise, et la CSP de développement laisse passer le préambule React Refresh et le
//   WebSocket du rechargement à chaud;
//   fails_when=estUrlInterface ne reconnaît plus l'origine de dev (localhost contre 127.0.0.1, port, comparaison
//   d'URL complète), ou la CSP stricte (ou une CSP de dev trop serrée) est servie en dev : React ne démarre pas,
//   « Refused to … » dans la console ou HMR déconnecté;
//   why_new=C1-C17 tournent sur l'app construite (file://), la branche dev n'était vérifiée qu'à la main; seam=none
//   (variable d'environnement déjà lue par le processus principal);
//   no_claim=ne couvre ni le rechargement à chaud d'un fichier modifié, ni electron-vite dev lui-même (rebuild de main).
test('C18 : en développement, l’interface servie par Vite pilote l’IPC sous sa CSP assouplie', async () => {
  // Rechargement depuis le processus principal pour capturer la console dès le premier script.
  const messages: string[] = []
  ui.on('console', (message: ConsoleMessage) => messages.push(message.text()))
  await app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.reload())

  await expect.poll(() => messages.some((texte) => texte.includes('[vite] connected'))).toBe(true)
  await expect(ui.locator('.new-tab-button')).toBeVisible()
  const etat = await ui.evaluate(() => window.arbalete.getState())
  expect(etat.tabs.length).toBeGreaterThan(0)
  expect(messages.filter((texte) => /Refused to/.test(texte))).toEqual([])
})

// Value: protects=F12 en développement (ARB-101) : sans menu d'application, le before-input-event de l'interface
//   ouvre puis ferme les DevTools ; c'est aussi la preuve que la touche simulée atteint before-input-event (C24);
//   fails_when=le gestionnaire F12 disparaît ou n'est posé que hors développement; why_new=C18 ne presse aucune
//   touche, C19 ne regarde que le menu; seam=none;
//   no_claim=ne couvre ni F12 quand le focus est dans une page web (gestionnaire posé sur l'interface seulement),
//   ni le filtrage keyDown/keyUp (sans ce filtre, le test passe encore : mutation vérifiée).
test('C25 : en développement, F12 ouvre et ferme les DevTools de l’interface', async () => {
  const devtoolsOuverts = () => app!.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.isDevToolsOpened())
  // sendInputEvent passe par le circuit d'entrée natif (before-input-event) ; ui.keyboard (CDP) ne l'atteint pas.
  const presserF12 = () => app!.evaluate(({ BrowserWindow }) => {
    const contenu = BrowserWindow.getAllWindows()[0].webContents
    contenu.sendInputEvent({ type: 'keyDown', keyCode: 'F12' })
    contenu.sendInputEvent({ type: 'keyUp', keyCode: 'F12' })
  })
  expect(await devtoolsOuverts()).toBe(false)

  await presserF12()
  await expect.poll(devtoolsOuverts).toBe(true)
  await presserF12()
  await expect.poll(devtoolsOuverts).toBe(false)
})

// Value: protects=F12 en développement quand le focus est dans la page d'un onglet (ARB-101), cas du démarrage :
//   la touche arrive au webContents de l'onglet, pas à celui de l'interface;
//   fails_when=le gestionnaire F12 n'est posé que sur l'interface (régression signalée en relecture de la PR #8);
//   why_new=C25 envoie la touche à l'interface seulement; seam=none;
//   no_claim=ne couvre pas un onglet ouvert après coup (même createTab) ni le build (C24).
test('C28 : en développement, F12 dans un onglet ouvre et ferme les DevTools de l’interface', async () => {
  const devtoolsOuverts = () => app!.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.isDevToolsOpened())
  const presserF12DansOnglet = () => app!.evaluate(({ BrowserWindow, webContents }) => {
    const interfaceUi = BrowserWindow.getAllWindows()[0].webContents
    const onglet = webContents.getAllWebContents()
      .find((contenu) => contenu !== interfaceUi && /^https?:/.test(contenu.getURL())
        && !contenu.getURL().startsWith(new URL(interfaceUi.getURL()).origin))
    if (!onglet) throw new Error('aucun onglet trouvé')
    onglet.sendInputEvent({ type: 'keyDown', keyCode: 'F12' })
    onglet.sendInputEvent({ type: 'keyUp', keyCode: 'F12' })
  })
  expect(await devtoolsOuverts()).toBe(false)

  await presserF12DansOnglet()
  await expect.poll(devtoolsOuverts).toBe(true)
  await presserF12DansOnglet()
  await expect.poll(devtoolsOuverts).toBe(false)
})

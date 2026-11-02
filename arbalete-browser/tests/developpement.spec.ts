import { createServer as createHttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
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

// Les DevTools de l'interface restent fermés entre deux tests : un échec en cours de test ne fait pas échouer les suivants.
test.afterEach(async () => {
  await app?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.closeDevTools())
})

function devtoolsOuverts() {
  return app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.isDevToolsOpened())
}

// Exécute une action dans le processus principal sur le webContents de l'onglet : le premier en http(s) qui n'est pas
// l'interface. L'action est une fonction écrite en texte (app.evaluate ne transporte pas les fermetures).
function dansOnglet<T>(action: string, arg?: unknown): Promise<T> {
  return app!.evaluate(async ({ BrowserWindow, webContents }, { action, arg }) => {
    const interfaceUi = BrowserWindow.getAllWindows()[0].webContents
    const onglet = webContents.getAllWebContents()
      .find((wc) => wc !== interfaceUi && /^https?:/.test(wc.getURL())
        && !wc.getURL().startsWith(new URL(interfaceUi.getURL()).origin))
    if (!onglet) throw new Error('aucun onglet trouvé')
    return await (new Function('onglet', 'arg', `return (${action})(onglet, arg)`))(onglet, arg)
  }, { action, arg }) as Promise<T>
}

type Touche = { type: 'keyDown' | 'keyUp'; keyCode: string; modifiers?: Array<'isautorepeat'> }
const appuiF12: Touche[] = [{ type: 'keyDown', keyCode: 'F12' }, { type: 'keyUp', keyCode: 'F12' }]

// sendInputEvent passe par le circuit d'entrée natif (before-input-event) ; ui.keyboard (CDP) ne l'atteint pas.
function envoyerTouches(evenements: Touche[], cible: 'interface' | 'onglet'): Promise<void> {
  if (cible === 'onglet') {
    return dansOnglet(`(onglet, evenements) => {
      onglet.focus()
      for (const evenement of evenements) onglet.sendInputEvent(evenement)
    }`, evenements)
  }
  return app!.evaluate(({ BrowserWindow }, evenements) => {
    const contenu = BrowserWindow.getAllWindows()[0].webContents
    for (const evenement of evenements) contenu.sendInputEvent(evenement)
  }, evenements)
}

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
//   no_claim=ne couvre ni F12 quand le focus est dans la page d'un onglet (C28 à C30 s'en chargent),
//   ni le filtrage keyDown/keyUp (sans ce filtre, le test passe encore : mutation vérifiée).
test('C25 : en développement, F12 ouvre et ferme les DevTools de l’interface', async () => {
  expect(await devtoolsOuverts()).toBe(false)

  await envoyerTouches(appuiF12, 'interface')
  await expect.poll(devtoolsOuverts).toBe(true)
  await envoyerTouches(appuiF12, 'interface')
  await expect.poll(devtoolsOuverts).toBe(false)
})

// Value: protects=F12 en développement quand le focus est dans la page d'un onglet (ARB-101), cas du démarrage :
//   la touche arrive au webContents de l'onglet, pas à celui de l'interface;
//   fails_when=le gestionnaire F12 n'est posé que sur l'interface (régression signalée en relecture de la PR #8);
//   why_new=C25 envoie la touche à l'interface seulement; seam=none;
//   no_claim=ne couvre pas un onglet ouvert après coup (même createTab) ni le build (C24).
test('C28 : en développement, F12 dans un onglet ouvre et ferme les DevTools de l’interface', async () => {
  expect(await devtoolsOuverts()).toBe(false)

  await envoyerTouches(appuiF12, 'onglet')
  await expect.poll(devtoolsOuverts).toBe(true)
  await envoyerTouches(appuiF12, 'onglet')
  await expect.poll(devtoolsOuverts).toBe(false)
})

// Value: protects=en développement, seule la touche F12 bascule les DevTools (ARB-101), dans l'interface comme dans un
//   onglet : une autre touche ou la répétition automatique de F12 ne les ouvre pas, F12 si;
//   fails_when=le filtre input.key !== 'F12' (toute frappe ouvre les DevTools) ou le test input.isAutoRepeat disparaît;
//   why_new=C25 et C28 n'envoient que F12; seam=none;
//   no_claim=ne couvre pas le filtre keyDown/keyUp : un keyUp seul envoyé par sendInputEvent n'atteint pas
//   before-input-event, si bien que le test passe encore sans ce filtre (mutation vérifiée) ; ni le build (C24).
test('C29 : en développement, seule la touche F12 bascule les DevTools, dans l’interface comme dans un onglet', async () => {
  expect(await devtoolsOuverts()).toBe(false)

  for (const cible of ['interface', 'onglet'] as const) {
    await envoyerTouches([{ type: 'keyDown', keyCode: 'F2' }, { type: 'keyUp', keyCode: 'F2' }], cible)
    // Répétition automatique d'un appui long : ignorée, sinon les DevTools clignotent.
    await envoyerTouches([{ type: 'keyDown', keyCode: 'F12', modifiers: ['isautorepeat'] }], cible)
  }
  await ui.waitForTimeout(1_000)
  expect(await devtoolsOuverts()).toBe(false)

  // Témoin positif : F12 ouvre depuis l'onglet, puis referme depuis l'interface.
  await envoyerTouches([{ type: 'keyDown', keyCode: 'F12' }], 'onglet')
  await expect.poll(devtoolsOuverts).toBe(true)
  await envoyerTouches([{ type: 'keyDown', keyCode: 'F12' }], 'interface')
  await expect.poll(devtoolsOuverts).toBe(false)
})

// Value: protects=en développement, F12 pressée dans un onglet est consommée par Arbalète (ARB-101) : la page ne
//   reçoit ni la touche, ni ses répétitions d'un appui long, ni son relâchement ; les DevTools de l'interface basculent;
//   fails_when=event.preventDefault() disparaît de brancherF12, ou ne vaut plus que pour le premier keyDown : la page
//   reçoit aussi F12 (raccourci du site);
//   why_new=C25, C28 et C29 ne regardent que les DevTools, jamais ce que la page reçoit; seam=none;
//   no_claim=page locale servie en http sur 127.0.0.1 à la place d'un vrai site ; ne couvre pas l'interface ni le build.
test('C30 : en développement, F12 dans un onglet n’atteint pas la page', async () => {
  // Page locale : le témoin ne dépend pas du réseau ni de google.com. Dernier test du fichier : il garde l'onglet.
  const serveurPage = createHttpServer((_requete, reponse) => {
    reponse.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    reponse.end('<!doctype html><title>Page témoin</title><p>témoin</p>')
  })
  await new Promise<void>((pret) => serveurPage.listen(0, '127.0.0.1', pret))
  const urlPage = `http://127.0.0.1:${(serveurPage.address() as AddressInfo).port}/`
  try {
    const presser = (keyCode: string) =>
      envoyerTouches([{ type: 'keyDown', keyCode }, { type: 'keyUp', keyCode }], 'onglet')
    const compte = (touche: string) => dansOnglet<number>(
      `(onglet, touche) => onglet.executeJavaScript('window.__touches.filter((t) => t === ' + JSON.stringify(touche) + ').length')`,
      touche)

    await dansOnglet(`(onglet, url) => onglet.loadURL(url)`, urlPage)
    await dansOnglet(`(onglet) => onglet.executeJavaScript(
      "window.__touches = []; window.addEventListener('keydown', (e) => window.__touches.push(e.key), true); " +
      "window.addEventListener('keyup', (e) => window.__touches.push('haut:' + e.key), true); true")`)
    expect(await devtoolsOuverts()).toBe(false)

    // Témoin positif : une touche ordinaire arrive bien à la page par ce circuit.
    await presser('F2')
    await expect.poll(() => compte('F2')).toBeGreaterThan(0)

    await presser('F12')
    await expect.poll(devtoolsOuverts).toBe(true)
    // Appui long : répétitions de F12, consommées elles aussi, sans rebasculer les DevTools.
    await envoyerTouches([{ type: 'keyDown', keyCode: 'F12', modifiers: ['isautorepeat'] }], 'onglet')
    await presser('F2')
    await expect.poll(() => compte('F2')).toBeGreaterThan(1)
    expect(await compte('F12')).toBe(0)
    expect(await compte('haut:F12')).toBe(0)
    expect(await devtoolsOuverts()).toBe(true)

    await presser('F12')
    await expect.poll(devtoolsOuverts).toBe(false)
    expect(await compte('F12')).toBe(0)
  } finally {
    serveurPage.close()
  }
})

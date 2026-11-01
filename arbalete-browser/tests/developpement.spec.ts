import { resolve } from 'node:path'
import { createServer, type InlineConfig, type ViteDevServer } from 'vite'
import { _electron as electron, expect, test, type ConsoleMessage, type ElectronApplication } from '@playwright/test'
import configElectron from '../electron.vite.config'

// Mode développement (npm run dev) : l'interface est servie par le serveur Vite et le processus principal construit
// (out/main) la charge via ELECTRON_RENDERER_URL. On réutilise la configuration renderer d'electron.vite.config.ts
// (plugins React et CSP, alias) pour lancer le même serveur que electron-vite dev, sans dépendance supplémentaire.

let serveur: ViteDevServer | undefined
let app: ElectronApplication | undefined

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
  const origineDev = new URL(urlDev!).origin

  app = await electron.launch({
    args: ['.'],
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, ELECTRON_RENDERER_URL: urlDev! }
  })
  const estInterface = (url: string) => url.startsWith(origineDev)
  const ui = app.windows().find((page) => estInterface(page.url()))
    ?? await app.waitForEvent('window', { predicate: (page) => estInterface(page.url()) })

  // Rechargement depuis le processus principal pour capturer la console dès le premier script.
  const messages: string[] = []
  ui.on('console', (message: ConsoleMessage) => messages.push(message.text()))
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.reload())

  await expect.poll(() => messages.some((texte) => texte.includes('[vite] connected'))).toBe(true)
  await expect(ui.locator('.new-tab-button')).toBeVisible()
  const etat = await ui.evaluate(() => window.arbalete.getState())
  expect(etat.tabs.length).toBeGreaterThan(0)
  expect(messages.filter((texte) => /Refused to/.test(texte))).toEqual([])
})

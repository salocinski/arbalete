// POC ARB-25 : teste la bibliothèque electron-chrome-extensions (API chrome.* manquantes, barre d'actions, popup, chrome.tabs).
// Sans lien avec l'application : aucune extension n'est chargée par Arbalète (EP-04, audit de sécurité avant activation).
// Prérequis : extensions décompressées dans .poc/ext/ (voir arb-24) et la bibliothèque dans .poc/lib (`npm i electron-chrome-extensions --ignore-scripts`).
// Lancer : npx electron scripts/poc-electron-chrome-extensions.mjs   (résultat dans .poc/resultats-ece.json, voir docs/extensions/arb-25-poc-electron-chrome-extensions.md)
import { app, BrowserWindow, session } from 'electron'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const RACINE = resolve(import.meta.dirname, '..', '.poc')
const EXT = join(RACINE, 'ext')
const ATTENTE_MS = 4000
// Bibliothèque lue depuis .poc/lib : elle n'est pas une dépendance d'Arbalète tant que l'architecture d'EP-04 n'est pas décidée.
const requireLib = createRequire(join(RACINE, 'lib', 'x.js'))
const { ElectronChromeExtensions } = requireLib('electron-chrome-extensions')
const sourceBrowserAction = readFileSync(requireLib.resolve('electron-chrome-extensions/browser-action'), 'utf8')
// shortcut: profil jetable sous %TEMP%, jamais celui de l'utilisateur ; supprimé par l'OS, pas par ce script.
app.setPath('userData', mkdtempSync(join(tmpdir(), 'arbalete-poc-ece-')))

// Le bundle de la bibliothèque ne demande que `electron` : il sert tel quel de preload sandboxé de la fenêtre hôte.
const PRELOAD_HOTE = join(RACINE, 'preload-hote.cjs')
writeFileSync(PRELOAD_HOTE, `${sourceBrowserAction}\nmodule.exports.injectBrowserAction()\n`)

const PUB = 'https://googleads.g.doubleclick.net/pagead/id'
const serveur = createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8')
  if (req.url.startsWith('/hote')) {
    const [, partition, tab] = decodeURIComponent(req.url).match(/^\/hote\/([^/]+)\/(\d+)/)
    res.end(`<!doctype html><title>hote</title><body><browser-action-list partition="${partition}" tab="${tab}"></browser-action-list>`)
    return
  }
  res.end(`<!doctype html><title>poc</title><body><h1>Page de test</h1><p>texte</p>
<script>fetch(${JSON.stringify(PUB)}, { mode: 'no-cors' }).catch(() => {})</script>`)
})
let origine

const log = (m) => appendFileSync(join(RACINE, 'journal-ece.txt'), `${new Date().toISOString()} ${m}\n`)
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms))
const resultats = []

async function essayer(dossier) {
  const chemin = join(EXT, dossier)
  const manifeste = JSON.parse(readFileSync(join(chemin, 'manifest.json'), 'utf8'))
  const r = {
    dossier,
    nom: manifeste.name,
    version: manifeste.version,
    charge: false,
    erreurChargement: null,
    journalSW: [],
    pagesBloquees: [],
    popupDeclare: manifeste.action?.default_popup ?? null,
    popup: null,
    onglets: null
  }
  const partition = `persist:poc-ece-${dossier}`
  const ses = session.fromPartition(partition)
  ElectronChromeExtensions.handleCRXProtocol(ses)
  ses.serviceWorkers.on('console-message', (_e, d) => {
    if (d.level === 'error' || d.level === 'warning' || /chrome\.|not supported|undefined/i.test(d.message))
      r.journalSW.push(`[${d.level}] ${String(d.message).slice(0, 300)}`)
  })
  ses.webRequest.onErrorOccurred((d) => {
    if (d.url.startsWith(PUB.slice(0, 30))) r.pagesBloquees.push(d.error)
  })
  const creations = []
  const extensions = new ElectronChromeExtensions({
    session: ses,
    createTab: async (details) => {
      creations.push(details.url ?? '')
      const fen = new BrowserWindow({ show: false, webPreferences: { session: ses, sandbox: true } })
      if (details.url) await fen.loadURL(details.url).catch(() => {})
      extensions.addTab(fen.webContents, fen)
      return [fen.webContents, fen]
    }
  })
  extensions.on('browser-action-popup-created', async (popup) => {
    r.popup = { cree: true, charge: false }
    try {
      await Promise.race([popup.whenReady(), pause(5000).then(() => { throw new Error('délai') })])
      const wc = popup.browserWindow?.webContents
      await pause(2500) // les popups en framework (Bitwarden) se dessinent après `whenReady`
      r.popup = {
        cree: true,
        charge: true,
        url: wc?.getURL(),
        texte: (await wc?.executeJavaScript('document.body.innerText.length').catch(() => -1)) ?? -1,
        // chrome.tabs depuis la popup : l'onglet de la page de test doit être visible.
        tabsQuery: await wc
          ?.executeJavaScript(`new Promise((ok) => chrome.tabs.query({}, (t) => ok(JSON.stringify((t ?? []).map((x) => x.url)))))`)
          .catch((e) => String(e))
      }
    } catch (e) {
      r.popup.erreur = String(e?.message ?? e)
    }
  })
  log(`chargement ${dossier}`)
  try {
    const ext = await ses.extensions.loadExtension(chemin)
    r.charge = true
    r.id = ext.id
  } catch (e) {
    r.erreurChargement = String(e?.message ?? e)
    return r
  }
  const page = new BrowserWindow({ show: false, webPreferences: { session: ses, sandbox: true } })
  extensions.addTab(page.webContents, page)
  extensions.selectTab(page.webContents)
  await page.loadURL(origine).catch((e) => (r.erreurPage = String(e)))
  await pause(ATTENTE_MS)
  r.contentScripts = await page.webContents
    .executeJavaScript(`document.querySelectorAll('style.darkreader, [data-darkreader-mode]').length`)
    .catch((e) => String(e))
  r.serviceWorkersActifs = Object.keys(ses.serviceWorkers.getAllRunning()).length

  // Barre d'actions : fenêtre hôte avec <browser-action-list>, puis clic sur l'action de l'extension.
  const hote = new BrowserWindow({ width: 600, height: 300, show: false, webPreferences: { session: ses, sandbox: true, preload: PRELOAD_HOTE } })
  hote.webContents.on('preload-error', (_e, chemin, erreur) => (r.erreurPreloadHote = String(erreur?.stack ?? erreur).slice(0, 400)))
  await hote.loadURL(`${origine}hote/${encodeURIComponent(partition)}/${page.webContents.id}`).catch((e) => (r.erreurHote = String(e)))
  await pause(2000)
  r.diagHote = await hote.webContents
    .executeJavaScript(`JSON.stringify({ defini: !!customElements.get('browser-action-list'), shadow: !!document.querySelector('browser-action-list')?.shadowRoot, html: document.body.innerHTML.slice(0, 300), api: typeof window.browserAction })`)
    .catch((e) => String(e))
  r.actionsAffichees = await hote.webContents
    .executeJavaScript(`document.querySelector('browser-action-list')?.shadowRoot?.querySelectorAll('[part=action]').length ?? -1`)
    .catch((e) => String(e))
  await hote.webContents.executeJavaScript(`document.querySelector('browser-action-list')?.shadowRoot?.querySelector('[part=action]')?.click()`).catch(() => {})
  await pause(7000)

  // chrome.tabs : une page de la session voit-elle le service worker agir sur les onglets ?
  r.onglets = { suivis: creations.length }
  for (const f of [page, hote]) f.destroy()
  return r
}

app.on('window-all-closed', () => {})
process.on('uncaughtException', (e) => log(`exception ${e?.stack ?? e}`))
async function principal() {
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok))
  origine = `http://127.0.0.1:${serveur.address().port}/`
  await app.whenReady()
  for (const dossier of readdirSync(EXT)) {
    const limite = pause(90000).then(() => ({ dossier, delaiDepasse: true }))
    resultats.push(await Promise.race([essayer(dossier).catch((e) => ({ dossier, exception: String(e?.stack ?? e) })), limite]))
    log(`fini ${dossier}`)
  }
  writeFileSync(join(RACINE, 'resultats-ece.json'), JSON.stringify({ electron: process.versions.electron, chrome: process.versions.chrome, resultats }, null, 2))
  serveur.close()
  app.quit()
}
principal()

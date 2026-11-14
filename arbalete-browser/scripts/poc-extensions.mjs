// POC ARB-24 : charge des extensions Chrome non empaquetées dans une session Electron jetable et note ce qui marche.
// Sans lien avec l'application : aucune extension n'est chargée par Arbalète (EP-04, audit de sécurité avant activation).
// Lancer : npx electron scripts/poc-extensions.mjs   (extensions décompressées dans .poc/ext/, voir docs/extensions/arb-24-poc-loadextension.md)
import { app, BrowserWindow, session } from 'electron'
import { createServer } from 'node:http'
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const RACINE = resolve(import.meta.dirname, '..', '.poc')
const EXT = join(RACINE, 'ext')
const ATTENTE_MS = 8000
// shortcut: profil jetable sous %TEMP%, jamais celui de l'utilisateur ; supprimé par l'OS, pas par ce script.
app.setPath('userData', mkdtempSync(join(tmpdir(), 'arbalete-poc-ext-')))

// Page locale servie en http : une image « publicitaire » et un appel vers un hôte de pub connu (pour uBOL).
const PUB = 'https://googleads.g.doubleclick.net/pagead/id'
const serveur = createServer((_req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.end(`<!doctype html><title>poc</title><body><h1>Page de test</h1><p>texte</p>
<script>fetch(${JSON.stringify(PUB)}, { mode: 'no-cors' }).catch(() => {})</script>`)
})
let url

// Electron sous Windows n'attache pas stdout à un tube : le journal va dans un fichier.
const log = (m) => appendFileSync(join(RACINE, 'journal.txt'), `${new Date().toISOString()} ${m}
`)
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms))
const resultats = []

async function essayer(dossier) {
  const chemin = join(EXT, dossier)
  const manifeste = JSON.parse(readFileSync(join(chemin, 'manifest.json'), 'utf8'))
  const r = {
    dossier,
    nom: manifeste.name,
    version: manifeste.version,
    manifest: manifeste.manifest_version,
    charge: false,
    erreurChargement: null,
    journalSW: [],
    sansHote: [],
    pagesBloquees: [],
    contentScripts: null,
    popupDeclare: Boolean(manifeste.action?.default_popup)
  }
  const ses = session.fromPartition(`persist:poc-${dossier}`)
  // Journal du service worker : erreurs `chrome.* is undefined` et autres.
  ses.serviceWorkers.on('console-message', (_e, d) => {
    if (d.level === 'error' || d.level === 'warning' || /chrome\.|not supported|undefined/i.test(d.message))
      r.journalSW.push(`[${d.level}] ${String(d.message).slice(0, 300)}`)
  })
  // Requêtes refusées : ERR_BLOCKED_BY_CLIENT = blocage par une extension (DNR ou webRequest).
  ses.webRequest.onErrorOccurred((d) => {
    if (d.url.startsWith(PUB.slice(0, 30))) r.pagesBloquees.push(d.error)
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
  log(`charge ${dossier} id=${r.id}`)
  const fenetre = new BrowserWindow({ show: false, webPreferences: { session: ses, sandbox: true } })
  await fenetre.loadURL(url).catch((e) => (r.erreurPage = String(e)))
  await pause(ATTENTE_MS)
  r.contentScripts = await fenetre.webContents
    .executeJavaScript(
      `({ darkreader: document.querySelectorAll('style.darkreader, [data-darkreader-mode]').length,
          scripts: document.documentElement.outerHTML.length })`
    )
    .catch((e) => String(e))
  r.serviceWorkersActifs = Object.keys(ses.serviceWorkers.getAllRunning()).length
  r.extensionsListees = ses.extensions.getAllExtensions().map((x) => x.name)
  fenetre.destroy()
  return r
}

app.on('window-all-closed', () => {}) // sinon Electron quitte dès que la première fenêtre est détruite
process.on('uncaughtException', (e) => log(`exception ${e?.stack ?? e}`))
// Pas d'await de plus haut niveau : Electron ne charge un main ESM qu'une fois le module évalué, `ready` ne viendrait jamais.
async function principal() {
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok))
  url = `http://127.0.0.1:${serveur.address().port}/`
  await app.whenReady()
  log('prêt')
  for (const dossier of readdirSync(EXT)) {
    const limite = pause(60000).then(() => ({ dossier, delaiDepasse: true }))
    resultats.push(await Promise.race([essayer(dossier).catch((e) => ({ dossier, exception: String(e) })), limite]))
    log(`fini ${dossier}`)
  }
  writeFileSync(join(RACINE, 'resultats.json'), JSON.stringify({ electron: process.versions.electron, chrome: process.versions.chrome, resultats }, null, 2))
  serveur.close()
  app.quit()
}
principal()

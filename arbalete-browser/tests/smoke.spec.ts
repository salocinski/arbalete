import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import type { BrowserState } from '../src/shared/types'

// Contrat de régression d'ARB-4 (C1-C7, C9, C11, C12), exécuté sur l'app construite (out/).
// C8 (thème système) et C10 (aperçu web) restent dans la liste manuelle de la PR.
// Le premier onglet charge https://www.google.com : le démarrage dépend du réseau, pas les assertions.

const pages: Record<string, string> = {
  '/page-a.html': `<!doctype html><title>Page A</title>
    <a id="suivante" href="/page-b.html">suivante</a>
    <a id="popup" href="/page-b.html" target="_blank">popup</a>
    <a id="bloquee" href="arbalete-test:bloquee">bloquée</a>`,
  '/page-b.html': '<!doctype html><title>Page B</title><p>Page B</p>'
}

// Nombre de requêtes reçues par chemin : prouve qu'un rechargement repasse bien par le réseau.
const requetes: Record<string, number> = {}

let serveur: Server
let origine: string
let app: ElectronApplication
let ui: Page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  serveur = createServer((req, res) => {
    const corps = pages[req.url ?? '']
    requetes[req.url ?? ''] = (requetes[req.url ?? ''] ?? 0) + 1
    res.writeHead(corps ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' })
    res.end(corps ?? 'introuvable')
  })
  await new Promise<void>((done) => serveur.listen(0, '127.0.0.1', done))
  origine = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`

  app = await electron.launch({ args: ['.'], cwd: resolve(__dirname, '..') })
  ui = await fenetreInterface(app)
})

test.afterAll(async () => {
  await app?.close()
  await new Promise((done) => serveur?.close(done))
})

// Les WebContentsView des onglets apparaissent aussi comme pages : on choisit l'interface par son URL.
async function fenetreInterface(electronApp: ElectronApplication): Promise<Page> {
  const estInterface = (page: Page) => page.url().endsWith('/renderer/index.html')
  const deja = electronApp.windows().find(estInterface)
  if (deja) return deja
  return electronApp.waitForEvent('window', { predicate: estInterface })
}

function etat(): Promise<BrowserState> {
  return ui.evaluate(() => window.arbalete.getState())
}

function ongletActif(state: BrowserState) {
  return state.tabs.find((tab) => tab.id === state.activeTabId)
}

// Exécute du code dans la page de l'onglet actif, comme un geste utilisateur (navigation initiée par la page).
async function dansOngletActif(code: string) {
  await resultatDansOngletActif(code)
}

// Le champ suit l'URL de l'onglet tant qu'il n'a pas le focus : on le focalise d'abord,
// puis on vérifie que la saisie n'a pas été écrasée par une mise à jour d'état avant Entrée.
async function saisirAdresse(valeur: string) {
  const adresse = ui.getByLabel('Adresse ou recherche')
  await expect(async () => {
    await adresse.focus()
    await adresse.fill(valeur)
    await expect(adresse).toHaveValue(valeur, { timeout: 500 })
  }).toPass()
  await adresse.press('Enter')
}

async function attendreUrlActive(url: string) {
  await expect.poll(async () => ongletActif(await etat())?.url).toBe(url)
}

// Exécute du code dans la page de l'onglet actif (geste utilisateur) et renvoie son résultat, promesse résolue.
async function resultatDansOngletActif<T>(code: string): Promise<T> {
  return app.evaluate(async ({ BrowserWindow, WebContentsView }, source) => {
    const fenetre = BrowserWindow.getAllWindows()[0]
    const vue = fenetre.contentView.children.find((enfant) => enfant instanceof WebContentsView) as InstanceType<typeof WebContentsView>
    return vue.webContents.executeJavaScript(source, true)
  }, code) as Promise<T>
}

// Rectangle de la zone .web-content de l'interface et bornes de la vue web affichée, pour les comparer.
function rectangleZoneContenu() {
  return ui.locator('.web-content').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }
  })
}

function boundsVueActive() {
  return app.evaluate(({ BrowserWindow, WebContentsView }) => {
    const vue = BrowserWindow.getAllWindows()[0].contentView.children.find((enfant) => enfant instanceof WebContentsView)
    return vue?.getBounds()
  })
}

async function attendreVueAlignee() {
  await expect.poll(async () => {
    const [vue, zone] = [await boundsVueActive(), await rectangleZoneContenu()]
    return JSON.stringify(vue) === JSON.stringify(zone)
  }).toBe(true)
}

test('C1 : l’app démarre avec le pont window.arbalete et un onglet', async () => {
  expect(await ui.evaluate(() => typeof window.arbalete)).toBe('object')
  const state = await etat()
  expect(state.tabs).toHaveLength(1)
  expect(state.activeTabId).toBe(state.tabs[0].id)
})

test('C2 : la barre d’adresse charge localhost sans schéma et une URL complète', async () => {
  // Domaine nu et recherche partent vers Internet : vérifiés à la main (liste C1-C10).
  await saisirAdresse(`${origine.replace('http://', '')}/page-a.html`)
  await attendreUrlActive(`${origine}/page-a.html`)
  await expect.poll(async () => ongletActif(await etat())?.title).toBe('Page A')

  await saisirAdresse(`${origine}/page-b.html`)
  await attendreUrlActive(`${origine}/page-b.html`)
})

test('C3 : précédent et suivant suivent l’historique', async () => {
  await saisirAdresse(`${origine}/page-a.html`)
  await attendreUrlActive(`${origine}/page-a.html`)
  await dansOngletActif("document.getElementById('suivante').click()")
  await attendreUrlActive(`${origine}/page-b.html`)
  await expect.poll(async () => ongletActif(await etat())?.canGoBack).toBe(true)

  await ui.getByTitle('Précédent (Alt+←)').click()
  await attendreUrlActive(`${origine}/page-a.html`)
  await expect.poll(async () => ongletActif(await etat())?.canGoForward).toBe(true)

  await ui.getByTitle('Suivant (Alt+→)').click()
  await attendreUrlActive(`${origine}/page-b.html`)
})

test('C5 : un lien target=_blank ouvre un onglet, pas une fenêtre', async () => {
  await saisirAdresse(`${origine}/page-a.html`)
  await attendreUrlActive(`${origine}/page-a.html`)
  const avant = (await etat()).tabs.length

  await dansOngletActif("document.getElementById('popup').click()")
  await expect.poll(async () => (await etat()).tabs.length).toBe(avant + 1)
  await attendreUrlActive(`${origine}/page-b.html`)
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
})

// Chromium refuse aussi un schéma inconnu : ce test protège le résultat (la page reste en place),
// pas l'appel à will-navigate. about:blank n'émet pas will-navigate et passe, sous Electron 42 comme 45.
test('C6 : une navigation de la page vers un schéma non http est bloquée', async () => {
  await saisirAdresse(`${origine}/page-a.html`)
  await attendreUrlActive(`${origine}/page-a.html`)

  await dansOngletActif("document.getElementById('bloquee').click()")
  await ui.waitForTimeout(1_000)
  expect(ongletActif(await etat())?.url).toBe(`${origine}/page-a.html`)
})

// Value: protects=bouton Recharger -> pont reload -> webContents.reload() de l'onglet actif sous Electron 45;
//   fails_when=le canal browser:reload, le bouton ou reload() ne rechargent plus la page (aucune nouvelle requête,
//   ou l'onglet quitte l'URL courante); why_new=C1-C6 n'appellent jamais reload, seul canal IPC du pont non exercé;
//   seam=none; no_claim=ne vérifie ni le cache HTTP, ni Ctrl+R, ni le rechargement d'une page en erreur.
test('C11 : le bouton Recharger recharge la page de l’onglet actif', async () => {
  // L'onglet peut déjà être sur page-a : on attend que la requête de cette navigation soit arrivée
  // avant de prendre la référence, sinon elle compterait comme un rechargement.
  const avantNavigation = requetes['/page-a.html'] ?? 0
  await saisirAdresse(`${origine}/page-a.html`)
  await expect.poll(() => requetes['/page-a.html'] ?? 0).toBeGreaterThan(avantNavigation)
  await attendreUrlActive(`${origine}/page-a.html`)
  await expect.poll(async () => ongletActif(await etat())?.isLoading).toBe(false)
  const avant = requetes['/page-a.html'] ?? 0

  await ui.getByTitle('Recharger').click()
  await expect.poll(() => requetes['/page-a.html'] ?? 0).toBeGreaterThan(avant)
  await attendreUrlActive(`${origine}/page-a.html`)
})

// Value: protects=pont setContentBounds (ipcRenderer.send, seul canal non invoke) -> WebContentsView.setBounds :
//   la page web occupe exactement la zone .web-content de l'interface, y compris après un redimensionnement;
//   fails_when=le canal browser:set-content-bounds, le ResizeObserver du renderer ou setBounds d'Electron 45
//   cessent de positionner la vue (vue à 0x0, sur la barre latérale, ou figée à l'ancienne taille);
//   why_new=C1-C6 lisent l'état via getState et ne regardent jamais où la vue est affichée; seam=none;
//   no_claim=ne couvre ni le repli de la barre latérale (C9), ni le facteur de zoom Windows != 100 %.
test('C12 : la vue de l’onglet actif couvre la zone de contenu et suit le redimensionnement', async () => {
  const initiale = await rectangleZoneContenu()
  expect(initiale.width).toBeGreaterThan(0)
  expect(initiale.height).toBeGreaterThan(0)
  await expect.poll(boundsVueActive).toEqual(initiale)

  await app.evaluate(({ BrowserWindow }) => {
    const fenetre = BrowserWindow.getAllWindows()[0]
    fenetre.unmaximize()
    fenetre.setSize(1100, 760)
  })
  await expect.poll(async () => (await rectangleZoneContenu()).width).not.toBe(initiale.width)
  await attendreVueAlignee()
  expect(await boundsVueActive()).toEqual(await rectangleZoneContenu())
})

// Value: protects=politique de permissions restrictive (session.setPermissionRequestHandler -> callback(false))
//   appliquée aux onglets sous Electron 45 : une page web ne reçoit ni notifications ni géolocalisation;
//   fails_when=le gestionnaire n'est plus installé ou plus consulté (API de session modifiée, onglet sur une autre
//   session), et Chromium accorde ou laisse en attente la demande ('granted'/'default', ou pas d'erreur code 1);
//   why_new=C1-C12 ne déclenchent aucune demande de permission, la vérification C7 était manuelle; seam=none;
//   no_claim=ne couvre ni les autres permissions (caméra, micro, presse-papiers), ni setPermissionCheckHandler.
test('C7 : les demandes de permission d’une page web sont refusées', async () => {
  await saisirAdresse(`${origine}/page-a.html`)
  await attendreUrlActive(`${origine}/page-a.html`)
  await expect.poll(async () => ongletActif(await etat())?.isLoading).toBe(false)

  expect(await resultatDansOngletActif<string>('Notification.requestPermission()')).toBe('denied')

  const geolocalisation = await resultatDansOngletActif<string>(`new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('accordée'),
      (erreur) => resolve(erreur.code === erreur.PERMISSION_DENIED ? 'refusée' : 'erreur ' + erreur.code),
      { timeout: 5000 }
    )
  })`)
  expect(geolocalisation).toBe('refusée')
})

// Value: protects=repli/déploiement de la barre latérale -> ResizeObserver -> setContentBounds -> setBounds :
//   la page web reste exactement sur .web-content quand la zone s'élargit puis se rétrécit;
//   fails_when=le renderer (React 19 + plugin-react 6) ne renvoie plus les bornes au repli, ou setBounds d'Electron 45
//   les ignore : la vue reste à l'ancienne position et laisse un vide ou recouvre la barre latérale;
//   why_new=C12 ne change que la taille de la fenêtre, pas la largeur de la barre latérale; seam=none;
//   no_claim=ne couvre ni le raccourci Ctrl+Shift+B, ni le redimensionnement de la barre à la souris.
test('C9 : replier puis déployer la barre latérale réaligne la vue web', async () => {
  await attendreVueAlignee()
  const deploye = await rectangleZoneContenu()

  await ui.locator('[title^="Replier la barre latérale"]').click()
  await expect.poll(async () => (await rectangleZoneContenu()).x).toBeLessThan(deploye.x)
  await attendreVueAlignee()

  await ui.locator('[title^="Déployer la barre latérale"]').click()
  await expect.poll(async () => (await rectangleZoneContenu()).x).toBe(deploye.x)
  await attendreVueAlignee()
  expect(await boundsVueActive()).toEqual(await rectangleZoneContenu())
})

test('C4 : créer, activer et fermer des onglets ; seul l’onglet actif est affiché', async () => {
  const vuesAffichees = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.length)
  const vuesAvecUnOnglet = await vuesAffichees()

  const avant = (await etat()).tabs.length
  await ui.locator('.new-tab-button').click()
  await expect.poll(async () => (await etat()).tabs.length).toBe(avant + 1)
  expect(await vuesAffichees()).toBe(vuesAvecUnOnglet)

  const premier = (await etat()).tabs[0]
  await ui.locator('.tab-select').first().click()
  await expect.poll(async () => (await etat()).activeTabId).toBe(premier.id)

  // Fermer tous les onglets : le dernier fermé est remplacé par un nouvel onglet.
  const idsInitiaux = (await etat()).tabs.map((tab) => tab.id)
  for (let restant = idsInitiaux.length; restant > 1; restant--) {
    await ui.locator('.tab-close').first().click()
    await expect.poll(async () => (await etat()).tabs.length).toBe(restant - 1)
  }
  await ui.locator('.tab-close').first().click()
  await expect.poll(async () => idsInitiaux.includes((await etat()).tabs[0]?.id)).toBe(false)
  expect((await etat()).tabs).toHaveLength(1)
  expect(await vuesAffichees()).toBe(vuesAvecUnOnglet)
})

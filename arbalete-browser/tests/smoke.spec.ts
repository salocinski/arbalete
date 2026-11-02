import { createServer, type Server } from 'node:http'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type { AddressInfo } from 'node:net'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import type { BrowserState } from '../src/shared/types'

// Contrat de régression d'ARB-4 (C1-C7, C9, C11, C12), verrouillage de l'interface d'ARB-12/13/14 (C13-C17) et
// ouvertures d'ARB-101/102 (C19-C24, C26, C27 : menu, F12, window.open), exécutés sur l'app construite (out/).
// C18 et C25 (mode développement) sont dans developpement.spec.ts.
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

// Charge une URL dans la fenêtre d'interface depuis le processus principal (sans passer par will-navigate).
function chargerInterface(url: string) {
  return app.evaluate(({ BrowserWindow }, cible) => BrowserWindow.getAllWindows()[0].webContents.loadURL(cible), url)
}

// Statut de deux appels IPC depuis la page affichée dans la fenêtre d'interface.
function statutsAppelsIpc(): Promise<string[]> {
  return ui.evaluate(() => Promise.allSettled([
    window.arbalete.getState(),
    window.arbalete.createTab('http://127.0.0.1:1/intrus')
  ]).then((reponses) => reponses.map((reponse) => reponse.status)))
}

// Après un rechargement de l'interface : mêmes onglets, interface affichée, vue alignée.
async function verifierInterfaceIntacte(avant: BrowserState) {
  const apres = await etat()
  expect(apres.tabs.map((tab) => tab.id)).toEqual(avant.tabs.map((tab) => tab.id))
  await expect(ui.locator('.new-tab-button')).toBeVisible()
  await attendreVueAlignee()
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

// Value: protects=Content-Security-Policy stricte de l'interface construite (ARB-13) : aucun script inline ne s'exécute;
//   fails_when=la balise CSP n'est plus injectée au build, ou script-src accepte 'unsafe-inline';
//   why_new=aucun test ne regardait la CSP, absente avant ARB-13; seam=none;
//   no_claim=ne couvre ni la CSP assouplie du serveur de dev, ni les autres directives (style-src, connect-src…).
test('C13 : l’interface refuse les scripts inline (Content-Security-Policy)', async () => {
  const resultat = await ui.evaluate(() => new Promise<string>((termine) => {
    document.addEventListener('securitypolicyviolation', (event) => termine(event.violatedDirective), { once: true })
    const script = document.createElement('script')
    script.textContent = 'document.documentElement.dataset.scriptInline = "exécuté"'
    document.head.append(script)
    // Sans CSP, le script s'exécute de façon synchrone et aucune violation n'arrive.
    setTimeout(() => termine(document.documentElement.dataset.scriptInline ?? 'aucune violation'), 2_000)
  }))
  expect(resultat).toMatch(/^script-src/)
})

// Value: protects=vérification de l'émetteur IPC (ARB-14) : une page qui obtient le preload hors de l'interface ne pilote rien;
//   fails_when=un canal n'appelle plus emetteurAutorise, ou le contrôle accepte une autre fenêtre ou une autre URL;
//   why_new=C1-C12 n'appellent l'IPC que depuis l'interface légitime; seam=none (fenêtre intruse créée par le test);
//   no_claim=ne couvre pas un iframe dans l'interface (bloqué en amont par la CSP et ARB-12).
test('C14 : un appel IPC venant d’une autre page que l’interface est refusé', async () => {
  const avant = await etat()
  const resultats = await app.evaluate(async ({ BrowserWindow }, { preload, url }) => {
    const intruse = new BrowserWindow({ show: false, webPreferences: { preload, contextIsolation: true, sandbox: true } })
    try {
      await intruse.loadURL(url)
      // set-content-bounds part avant les invocations : leur réponse prouve qu'il a déjà été traité.
      return await intruse.webContents.executeJavaScript(`
        window.arbalete.setContentBounds({ x: 0, y: 0, width: 10, height: 10 })
        Promise.allSettled([
          window.arbalete.getState(),
          window.arbalete.createTab('http://127.0.0.1:1/intrus'),
          window.arbalete.navigate('http://127.0.0.1:1/intrus')
        ]).then((resultats) => resultats.map((resultat) => resultat.status))`)
    } finally {
      intruse.destroy()
    }
  }, { preload: resolve(__dirname, '../out/preload/index.js'), url: `${origine}/page-a.html` })

  expect(resultats).toEqual(['rejected', 'rejected', 'rejected'])
  const apres = await etat()
  expect(apres.tabs.map((tab) => tab.id)).toEqual(avant.tabs.map((tab) => tab.id))
  expect(ongletActif(apres)?.url).toBe(ongletActif(avant)?.url)
  await attendreVueAlignee()
})

// Value: protects=verrouillage de la fenêtre d'interface (ARB-12) : elle ne navigue pas et n'ouvre pas de fenêtre;
//   fails_when=le gestionnaire will-navigate ou setWindowOpenHandler de mainWindow disparaît;
//   why_new=C5 et C6 ne visent que les onglets, jamais la fenêtre d'interface; seam=none;
//   no_claim=ne couvre pas le glisser-déposer réel d'un lien (même événement will-navigate, non simulé).
test('C15 : la fenêtre d’interface ne navigue pas et n’ouvre pas de fenêtre', async () => {
  const urlInterface = ui.url()
  const cible = `${origine}/page-b.html`

  expect(await ui.evaluate((url) => window.open(url) === null, cible)).toBe(true)
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)

  // L'écouteur est posé (évaluation attendue) avant la navigation : les deux passent par des canaux distincts.
  await app.evaluate(({ BrowserWindow }) => {
    const global = globalThis as { navigationEmpechee?: Promise<boolean> }
    global.navigationEmpechee = new Promise<boolean>((termine) => {
      BrowserWindow.getAllWindows()[0].webContents.once('will-navigate', (event) => {
        setImmediate(() => termine(event.defaultPrevented))
      })
    })
  })
  await ui.evaluate((url) => { location.href = url }, cible)
  expect(await app.evaluate(() => (globalThis as { navigationEmpechee?: Promise<boolean> }).navigationEmpechee))
    .toBe(true)
  expect(ui.url()).toBe(urlInterface)
  expect(await ui.evaluate(() => typeof window.arbalete)).toBe('object')
})

// Value: protects=contrôle de l'URL de l'émetteur IPC (estUrlInterface, ARB-14) : si la fenêtre d'interface affiche
//   une autre page que out/renderer/index.html, le preload qu'elle garde n'y pilote plus le processus principal;
//   fails_when=emetteurAutorise ne compare plus l'URL du cadre (seule l'identité de la fenêtre), ou estUrlInterface
//   accepte n'importe quelle page http ou file; why_new=C14 est refusé dès la comparaison des webContents (fenêtre
//   intruse) et C15 empêche la navigation initiée par la page, sans jamais exercer la vérification d'URL; seam=none
//   (le test charge la page depuis le processus principal, ce qui ne passe pas par will-navigate);
//   no_claim=ne couvre ni la branche de développement (origine d'ELECTRON_RENDERER_URL), ni un iframe dans l'interface.
test('C16 : la fenêtre d’interface chargée sur une autre page ne pilote plus l’IPC', async () => {
  const urlInterface = ui.url()
  const avant = await etat()

  let resultats: string[]
  try {
    await chargerInterface(`${origine}/page-a.html`)
    await expect(ui).toHaveURL(`${origine}/page-a.html`)
    resultats = await statutsAppelsIpc()
  } finally {
    // L'interface est rechargée même en cas d'échec : les tests suivants en dépendent.
    await chargerInterface(urlInterface)
  }

  expect(resultats).toEqual(['rejected', 'rejected'])
  await verifierInterfaceIntacte(avant)
})

// Value: protects=branche file:// d'estUrlInterface (ARB-14) : seule out/renderer/index.html, au chemin exact, pilote
//   l'IPC ; une page locale ailleurs sur le disque, même nommée renderer/index.html, est refusée;
//   fails_when=estUrlInterface accepte toute URL file:, ou ne compare plus que la fin du chemin (endsWith
//   '/renderer/index.html'), ou compare le nom de fichier seul; why_new=C16 charge une page http et passe déjà par le
//   test de protocole, sans jamais atteindre la comparaison de chemin; seam=none (pages écrites dans le dossier
//   temporaire et chargées depuis le processus principal, comme C16);
//   no_claim=ne couvre ni la casse ou les raccourcis 8.3 des chemins Windows, ni la branche de développement.
test('C17 : une page locale hors de out/renderer chargée dans l’interface ne pilote pas l’IPC', async () => {
  const urlInterface = ui.url()
  const avant = await etat()
  const dossier = mkdtempSync(join(tmpdir(), 'arbalete-c17-'))
  const page = '<!doctype html><title>Intruse locale</title>'
  const etrangere = join(dossier, 'intruse.html')
  // Quasi-homonyme : même fin de chemin que l'interface construite, autre emplacement.
  const homonyme = join(dossier, 'out', 'renderer', 'index.html')
  mkdirSync(join(dossier, 'out', 'renderer'), { recursive: true })
  writeFileSync(etrangere, page)
  writeFileSync(homonyme, page)

  const resultats: Record<string, string[]> = {}
  try {
    for (const [nom, chemin] of [['étrangère', etrangere], ['homonyme', homonyme]]) {
      const url = pathToFileURL(chemin).href
      await chargerInterface(url)
      await expect(ui).toHaveURL(url)
      resultats[nom] = await statutsAppelsIpc()
    }
  } finally {
    // L'interface est rechargée même en cas d'échec : les tests suivants en dépendent.
    await chargerInterface(urlInterface)
    rmSync(dossier, { recursive: true, force: true })
  }

  expect(resultats).toEqual({ étrangère: ['rejected', 'rejected'], homonyme: ['rejected', 'rejected'] })
  await verifierInterfaceIntacte(avant)
})

// Value: protects=absence de menu d'application dans le build (ARB-101) : le menu par défaut d'Electron ouvre les
//   DevTools de l'interface (Ctrl+Maj+I) avec window.arbalete dans la console;
//   fails_when=Menu.setApplicationMenu(null) disparaît ou un menu avec le rôle toggleDevTools revient;
//   why_new=aucun test ne regardait le menu; seam=none;
//   no_claim=ne presse pas Ctrl+Maj+I (les accélérateurs natifs ne reçoivent pas les touches simulées par Playwright).
test('C19 : l’app construite n’a pas de menu d’application (pas de DevTools par raccourci)', async () => {
  expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu() === null)).toBe(true)
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.isDevToolsOpened()))
    .toBe(false)
})

// Value: protects=filtre de schéma de setWindowOpenHandler des onglets (ARB-102) : une page http ne peut pas ouvrir
//   file:// ni un schéma inconnu dans un nouvel onglet chargé par le processus principal;
//   fails_when=ouvertureAutorisee ne teste plus le schéma (window.open passe tout à createTab);
//   why_new=C5 ne couvre qu'un target=_blank vers http, C6 que will-navigate; seam=none (l'ouverture http finale
//   sert de repère : les demandes sont traitées dans l'ordre, donc les refus sont acquis quand elle arrive);
//   no_claim=ne couvre pas about:blank (refusé aussi, même filtre).
test('C20 : window.open d’une page n’ouvre que des adresses web', async () => {
  await saisirAdresse(`${origine}/page-a.html`)
  await attendreUrlActive(`${origine}/page-a.html`)
  const avant = (await etat()).tabs.length

  await dansOngletActif(
    "window.open('file:///C:/Windows/win.ini'); window.open('arbalete-test:ouverte'); window.open('/page-b.html')"
  )
  await expect.poll(async () => (await etat()).tabs.length).toBe(avant + 1)
  await attendreUrlActive(`${origine}/page-b.html`)
  expect((await etat()).tabs.filter((tab) => !/^https?:\/\//.test(tab.url))).toEqual([])
})

// Value: protects=limite d'ouvertures par page (ARB-102) : une rafale de window.open n'ouvre que 5 onglets;
//   fails_when=la limite disparaît, ou le compte n'est plus tenu par onglet source;
//   why_new=aucun test n'ouvrait plusieurs fenêtres d'un coup; seam=none (onglet neuf : son compteur part de zéro);
//   no_claim=ne vérifie pas la remise à zéro après 10 s (attente trop longue pour le smoke test).
test('C21 : une rafale de window.open n’ouvre que 5 onglets', async () => {
  await ui.evaluate((url) => window.arbalete.createTab(url), `${origine}/page-a.html`)
  await attendreUrlActive(`${origine}/page-a.html`)
  const avant = (await etat()).tabs.length

  await dansOngletActif("for (let n = 0; n < 12; n++) window.open('/page-b.html?n=' + n)")
  await expect.poll(async () => (await etat()).tabs.length).toBe(avant + 5)
  await ui.waitForTimeout(1_000)
  expect((await etat()).tabs.length).toBe(avant + 5)
})

// Ouvre un onglet source sur page-a, y lance n window.open et attend les n onglets ouverts. Chaque ouverture
// devient l'onglet actif : on renvoie l'identifiant de la source pour pouvoir y revenir.
async function rafaleDepuisNouvelOnglet(n: number, marque: string): Promise<{ source: string, apres: number }> {
  const source = await ui.evaluate((url) => window.arbalete.createTab(url), `${origine}/page-a.html`)
  await expect.poll(async () => (await etat()).activeTabId).toBe(source)
  await attendreUrlActive(`${origine}/page-a.html`)
  const avant = (await etat()).tabs.length
  await dansOngletActif(`for (let n = 0; n < ${n}; n++) window.open('/page-b.html?${marque}=' + n)`)
  await expect.poll(async () => (await etat()).tabs.length).toBe(avant + n)
  return { source, apres: avant + n }
}

// Avance Date.now du processus principal (limite d'ouvertures) sans attendre ; restaurerHorloge le remet à l'heure.
function avancerHorloge(ms: number) {
  return app.evaluate((_electron, decalage) => {
    const global = globalThis as { dateNowOrigine?: () => number }
    global.dateNowOrigine ??= Date.now
    Date.now = () => global.dateNowOrigine!() + decalage
  }, ms)
}

function restaurerHorloge() {
  return app.evaluate(() => {
    const global = globalThis as { dateNowOrigine?: () => number }
    if (global.dateNowOrigine) Date.now = global.dateNowOrigine
    delete global.dateNowOrigine
  })
}

async function activerOnglet(id: string, url: string) {
  await ui.evaluate((onglet) => window.arbalete.activateTab(onglet), id)
  await expect.poll(async () => (await etat()).activeTabId).toBe(id)
  await attendreUrlActive(url)
}

// Value: protects=limite d'ouvertures tenue par onglet source (ARB-102) : un onglet ouvert par une rafale peut encore
//   ouvrir ses propres liens target=_blank, tandis que la source saturée reste bloquée;
//   fails_when=ouvertures est indexé par une clé commune (fenêtre, constante) au lieu de l'onglet source : l'enfant
//   est refusé; why_new=C21 n'ouvre que depuis un seul onglet et ne distingue pas compte global et compte par source;
//   seam=none; no_claim=ne couvre pas la remise à zéro dans le temps (C23), ni la fermeture de la source.
test('C22 : la limite d’ouvertures est comptée par onglet source', async () => {
  const { source, apres } = await rafaleDepuisNouvelOnglet(5, 'source')
  // L'onglet actif est désormais le dernier ouvert par la rafale : son propre compteur part de zéro.
  await dansOngletActif("window.open('/page-b.html?enfant')")
  await expect.poll(async () => (await etat()).tabs.length).toBe(apres + 1)
  await attendreUrlActive(`${origine}/page-b.html?enfant`)

  await activerOnglet(source, `${origine}/page-a.html`)
  await dansOngletActif("window.open('/page-b.html?source-saturee')")
  await ui.waitForTimeout(1_000)
  expect((await etat()).tabs.length).toBe(apres + 1)
})

// Value: protects=fenêtre glissante de 10 s de la limite d'ouvertures (ARB-102) : une page qui a ouvert 5 onglets
//   peut de nouveau en ouvrir une fois la fenêtre passée (un utilisateur qui clique des liens target=_blank);
//   fails_when=les instants anciens ne sont plus retirés (filtre supprimé ou inversé, durée mal comparée) : la page
//   reste bloquée pour toujours après 5 ouvertures; why_new=C21 ne regarde que la rafale, pas la suite (no_claim);
//   seam=none (Date.now du processus principal avancé de 11 s par le test, puis restauré);
//   no_claim=n'attend pas 10 s réelles ; ne couvre pas la frontière exacte des 10 000 ms.
test('C23 : la limite d’ouvertures se libère après 10 secondes', async () => {
  const { source, apres } = await rafaleDepuisNouvelOnglet(5, 'fenetre')
  await activerOnglet(source, `${origine}/page-a.html`)
  await dansOngletActif("window.open('/page-b.html?avant-delai')")
  await ui.waitForTimeout(1_000)
  expect((await etat()).tabs.length).toBe(apres)

  await avancerHorloge(11_000)
  try {
    await dansOngletActif("window.open('/page-b.html?apres-delai')")
    await expect.poll(async () => (await etat()).tabs.length).toBe(apres + 1)
    await attendreUrlActive(`${origine}/page-b.html?apres-delai`)
  } finally {
    await restaurerHorloge()
  }
})

// Value: protects=F12 réservé au développement (ARB-101) : dans l'app construite, F12 sur l'interface n'ouvre pas les
//   DevTools (qui exposeraient window.arbalete dans la console);
//   fails_when=le garde if (URL_DEV) autour du before-input-event F12 disparaît, ou un menu avec un accélérateur F12
//   revient; why_new=C19 vérifie l'absence de menu, pas le gestionnaire F12 ; C25 (developpement.spec.ts) prouve
//   que la touche simulée atteint before-input-event; seam=none;
//   no_claim=ne couvre ni Ctrl+Maj+I ni F12 dans une page web (ses DevTools restent possibles par d'autres voies).
test('C24 : F12 n’ouvre pas les DevTools de l’interface dans l’app construite', async () => {
  const devtoolsOuverts = () => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.isDevToolsOpened())
  // sendInputEvent passe par le circuit d'entrée natif (before-input-event) ; ui.keyboard (CDP) ne l'atteint pas.
  const presserF12 = () => app.evaluate(({ BrowserWindow }) => {
    const contenu = BrowserWindow.getAllWindows()[0].webContents
    contenu.sendInputEvent({ type: 'keyDown', keyCode: 'F12' })
    contenu.sendInputEvent({ type: 'keyUp', keyCode: 'F12' })
  })
  await presserF12()
  await ui.waitForTimeout(1_000)
  expect(await devtoolsOuverts()).toBe(false)
})

// Value: protects=plafond global des ouvertures (ARB-102) : toutes pages réunies, au plus 20 onglets ouverts par
//   window.open en 10 s, même si chaque page reste sous son quota de 5 (chaîne de pages qui se rouvrent);
//   fails_when=le compte TOUTES_LES_PAGES disparaît ou n'est plus incrémenté : la 21e ouverture passe;
//   why_new=C21-C23 ne regardent que le quota par onglet source; seam=none (Date.now avancé de 60 s pour partir d'une
//   fenêtre vide, puis restauré); no_claim=sources créées par l'interface, pas une vraie chaîne d'onglets enfants.
test('C26 : toutes pages réunies, 20 ouvertures au plus par 10 secondes', async () => {
  await avancerHorloge(60_000)
  try {
    for (let source = 0; source < 4; source++) await rafaleDepuisNouvelOnglet(5, `total${source}`)
    const nouvelleSource = await ui.evaluate((url) => window.arbalete.createTab(url), `${origine}/page-a.html`)
    await expect.poll(async () => (await etat()).activeTabId).toBe(nouvelleSource)
    await attendreUrlActive(`${origine}/page-a.html`)
    const avant = (await etat()).tabs.length
    await dansOngletActif("window.open('/page-b.html?au-dela-du-total')")
    await ui.waitForTimeout(1_000)
    expect((await etat()).tabs.length).toBe(avant)
  } finally {
    await restaurerHorloge()
  }
})

// Value: protects=plafond d'onglets ouverts par les pages (ARB-102) : à 50 onglets ouverts, window.open n'ouvre plus
//   rien, quel que soit le rythme ; l'utilisateur peut encore ouvrir un onglet depuis l'interface;
//   fails_when=le test tabs.size >= ONGLETS_MAX_POUR_LES_PAGES disparaît (une page entretenue remplit la mémoire), ou
//   s'applique aussi à createTab depuis l'interface; why_new=C21-C26 ne bornent que le rythme; seam=none (Date.now
//   avancé de 120 s pour vider les quotas de rythme, puis restauré); no_claim=ne mesure pas la mémoire.
test('C27 : à 50 onglets ouverts, les pages n’en ouvrent plus, l’utilisateur si', async () => {
  await avancerHorloge(120_000)
  try {
    while ((await etat()).tabs.length < 50) {
      await ui.evaluate((url) => window.arbalete.createTab(url), `${origine}/page-a.html`)
    }
    await attendreUrlActive(`${origine}/page-a.html`)
    await dansOngletActif("window.open('/page-b.html?au-dela-du-plafond')")
    await ui.waitForTimeout(1_000)
    expect((await etat()).tabs.length).toBe(50)

    await ui.evaluate((url) => window.arbalete.createTab(url), `${origine}/page-b.html`)
    await expect.poll(async () => (await etat()).tabs.length).toBe(51)
  } finally {
    await restaurerHorloge()
  }
})

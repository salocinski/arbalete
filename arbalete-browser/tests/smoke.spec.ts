import { createServer, type Server } from 'node:http'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type { AddressInfo } from 'node:net'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import type { BrowserState } from '../src/shared/types'

// Contrat de régression d'ARB-4 (C1-C7, C11, C12), verrouillage de l'interface d'ARB-12/13/14 (C13-C17),
// ouvertures d'ARB-101/102 (C19-C24, C26, C27 : menu, F12, window.open) et barre latérale masquée d'ARB-33
// (C9, C31 à C35 : masquée à l'ouverture, survol, épinglage, Ctrl+Maj+B, verrouillage de sa vue, thème partagé et
// arguments validés de set-theme et set-sidebar), exécutés sur
// l'app construite (out/).
// C18, C25 et C28 à C30 (mode développement) sont dans developpement.spec.ts.
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
// Vue native de la barre latérale (ARB-33) : même interface, chargée avec ?vue=barre.
let barreUi: Page

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
  barreUi = await vueBarre(app)
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

async function vueBarre(electronApp: ElectronApplication): Promise<Page> {
  const estBarre = (page: Page) => page.url().endsWith('/renderer/index.html?vue=barre')
  const deja = electronApp.windows().find(estBarre)
  if (deja) return deja
  return electronApp.waitForEvent('window', { predicate: estBarre })
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
  // Attendre le rendu d'abord : juste après un rechargement piloté par le processus principal, un evaluate peut viser
  // l'ancien contexte d'exécution (« Execution context was destroyed »).
  await expect(ui.getByLabel('Adresse ou recherche')).toBeVisible()
  const apres = await etat()
  expect(apres.tabs.map((tab) => tab.id)).toEqual(avant.tabs.map((tab) => tab.id))
  await attendreVueAlignee()
}

function etatBarre() {
  return ui.evaluate(() => window.arbalete.getSidebar())
}

function boundsBarre() {
  return app.evaluate(({ BrowserWindow, WebContentsView }) => BrowserWindow.getAllWindows()[0].contentView.children
    .find((enfant) => enfant instanceof WebContentsView && enfant.webContents.getURL().includes('vue=barre'))?.getBounds())
}

// Événements souris natifs (sendInputEvent) envoyés à la vue de la barre : entrée dans la bande, sortie de la barre.
function souris(type: 'mouseEnter' | 'mouseLeave', x: number) {
  return app.evaluate(({ BrowserWindow, WebContentsView }, { type, x }) => {
    const vue = BrowserWindow.getAllWindows()[0].contentView.children
      .find((enfant) => enfant instanceof WebContentsView && enfant.webContents.getURL().includes('vue=barre')) as InstanceType<typeof WebContentsView>
    vue.webContents.sendInputEvent({ type, x, y: 300 })
    if (type === 'mouseEnter') vue.webContents.sendInputEvent({ type: 'mouseMove', x, y: 300 })
  }, { type, x })
}

// Clic natif (sendInputEvent, bouton droit : aucune action dans la page ni la barre d'outils) dans la page de l'onglet
// actif ou dans la fenêtre d'interface, en haut à droite, hors des boutons.
function cliquerDans(cible: 'onglet' | 'fenetre') {
  return app.evaluate(({ BrowserWindow, WebContentsView }, cible) => {
    const fenetre = BrowserWindow.getAllWindows()[0]
    const contenu = cible === 'fenetre' ? fenetre.webContents
      : (fenetre.contentView.children.find((enfant) => enfant instanceof WebContentsView
        && !enfant.webContents.getURL().includes('vue=barre')) as InstanceType<typeof WebContentsView>).webContents
    const [x, y] = cible === 'fenetre' ? [700, 4] : [400, 300]
    contenu.sendInputEvent({ type: 'mouseDown', x, y, button: 'right', clickCount: 1 })
    contenu.sendInputEvent({ type: 'mouseUp', x, y, button: 'right', clickCount: 1 })
  }, cible)
}

// La dernière vue ajoutée est dessinée au-dessus des autres : la barre doit l'être, au-dessus de l'onglet.
function barreAuPremierPlan() {
  return app.evaluate(({ BrowserWindow, WebContentsView }) => {
    const derniere = BrowserWindow.getAllWindows()[0].contentView.children.at(-1)
    return derniere instanceof WebContentsView && derniere.webContents.getURL().includes('vue=barre')
  })
}

async function epinglerBarre(voulu: boolean) {
  if ((await etatBarre()).pinned !== voulu) await ui.locator('[title*="la barre latérale"]').click()
  await expect.poll(etatBarre).toEqual({ open: voulu, pinned: voulu })
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
    const vue = fenetre.contentView.children.find((enfant) => enfant instanceof WebContentsView && !enfant.webContents.getURL().includes('vue=barre')) as InstanceType<typeof WebContentsView>
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
    const vue = BrowserWindow.getAllWindows()[0].contentView.children.find((enfant) => enfant instanceof WebContentsView && !enfant.webContents.getURL().includes('vue=barre'))
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

// Value: protects=barre latérale masquée à l'ouverture (ARB-33) : la page web occupe toute la largeur, la vue de la
//   barre n'est qu'une bande de survol de 6 px au bord gauche, au-dessus de la page;
//   fails_when=l'état initial de la barre n'est plus masqué, placerBarre ne réduit plus la vue à la bande, la vue de
//   la barre passe sous l'onglet, ou la zone de contenu ne part plus du bord gauche; why_new=ARB-33 remplace la
//   barre repliée d'ARB-109 (ancien C31); seam=none; no_claim=ne vérifie pas la transparence de la bande à l'écran.
test('C31 : la barre latérale est masquée à l’ouverture et la page occupe toute la largeur', async () => {
  expect(await etatBarre()).toEqual({ open: false, pinned: false })
  expect(await boundsBarre()).toMatchObject({ x: 0, y: 0, width: 6 })
  await expect(barreUi.getByTestId('sidebar-hover-strip')).toBeAttached()
  await expect(barreUi.locator('.sidebar')).toHaveCount(0)
  await expect(ui.locator('.sidebar')).toHaveCount(0)
  await attendreVueAlignee()
  expect((await rectangleZoneContenu()).x).toBe(0)
  expect(await barreAuPremierPlan()).toBe(true)
  // Le focus clavier reste à la page (webContents.isFocused : Playwright émule document.hasFocus dans chaque page).
  expect(await app.evaluate(({ BrowserWindow, WebContentsView }) => BrowserWindow.getAllWindows()[0].contentView.children
    .some((enfant) => enfant instanceof WebContentsView && enfant.webContents.getURL().includes('vue=barre')
      && enfant.webContents.isFocused()))).toBe(false)
})

// Value: protects=apparition au survol par-dessus la page et retrait (ARB-33) : la souris entre dans la bande, la
//   barre s'ouvre sans déplacer la page ; elle se retire quand la souris sort, même après un clic sur un onglet, sauf menu des espaces ouvert,
//   et au clic dans la page;
//   fails_when=onMouseEnter n'ouvre plus la barre, l'ouverture redimensionne la page, onMouseLeave ne la ferme plus ou
//   la ferme malgré le menu ouvert, un clic sur un bouton la retient, ou un clic dans l'onglet ne la retire plus (masquerAuClic de createTab);
//   why_new=nouveau comportement d'ARB-33; seam=none (événements souris natifs par sendInputEvent);
//   no_claim=ne couvre pas un vrai mouvement de souris de l'utilisateur.
test('C33 : la barre apparaît au survol par-dessus la page et se retire', async () => {
  await attendreVueAlignee()
  const zone = await rectangleZoneContenu()

  await souris('mouseEnter', 2)
  await expect.poll(etatBarre).toEqual({ open: true, pinned: false })
  await expect(barreUi.locator('.sidebar')).toBeVisible()
  expect(await boundsBarre()).toMatchObject({ x: 0, width: 252 })
  // La page ne bouge pas : la barre la recouvre.
  expect(await rectangleZoneContenu()).toEqual(zone)
  await attendreVueAlignee()

  await souris('mouseLeave', 240)
  await expect.poll(etatBarre).toEqual({ open: false, pinned: false })
  await expect.poll(async () => (await boundsBarre())?.width).toBe(6)

  // Geste principal : un clic sur un onglet dans la barre ne la retient pas ; elle se retire à la sortie de la souris.
  await souris('mouseEnter', 2)
  await expect.poll(etatBarre).toEqual({ open: true, pinned: false })
  await barreUi.locator('.tab-select').first().click()
  await souris('mouseLeave', 240)
  await expect.poll(etatBarre).toEqual({ open: false, pinned: false })

  // Menu des espaces ouvert, la sortie de la souris ne ferme pas la barre ; un clic dans la page, si.
  await souris('mouseEnter', 2)
  await expect.poll(etatBarre).toEqual({ open: true, pinned: false })
  await barreUi.locator('.workspace-switcher').click()
  await expect(barreUi.locator('.workspace-menu')).toBeVisible()
  await souris('mouseLeave', 240)
  // gstack-timing-ok: vérification négative (rien ne doit changer) ; le processus principal traite l'événement de façon synchrone.
  await ui.waitForTimeout(500)
  expect((await etatBarre()).open).toBe(true)
  await cliquerDans('onglet')
  await expect.poll(etatBarre).toEqual({ open: false, pinned: false })

  // Extension (audit de couverture /ship, ARB-33).
  // Value: protects=la barre ouverte au survol se retire au clic dans la barre d'outils (before-mouse-event de la
  //   fenêtre) et ne rouvre pas le menu des espaces resté ouvert à sa fermeture;
  //   fails_when=mainWindow.webContents ne branche plus masquerAuClic, ou l'effet qui ferme le menu quand la
  //   barre se retire disparaît; why_new=le bloc précédent ne clique que dans l'onglet; seam=none;
  //   no_claim=clic simulé par sendInputEvent (bouton droit), pas un vrai clic de souris.
  await souris('mouseEnter', 2)
  await expect.poll(etatBarre).toEqual({ open: true, pinned: false })
  // La barre doit être redessinée avant de constater l'absence du menu (sinon le compte passerait trop tôt).
  await expect(barreUi.locator('.sidebar')).toBeVisible()
  await expect(barreUi.locator('.workspace-menu')).toHaveCount(0)
  await cliquerDans('fenetre')
  await expect.poll(etatBarre).toEqual({ open: false, pinned: false })
})

// Value: protects=Ctrl+Maj+B intercepté par le processus principal (ARB-33, règle 5) : depuis la page d'un onglet, il
//   épingle la barre (la page lui laisse sa place) puis la libère, et la page ne reçoit pas la combinaison;
//   fails_when=brancherRaccourciBarre n'est plus posé sur les onglets, ne fait plus preventDefault, ou toggle-pin
//   n'inverse plus l'épinglage; why_new=l'ancien C32 ne pressait le raccourci que dans l'interface (keydown React);
//   seam=none (sendInputEvent atteint before-input-event, comme F12 dans C28); no_claim=appui long simulé par le
//   modificateur isautorepeat (extension ci-dessous), pas par un vrai clavier.
test('C32 : Ctrl+Maj+B depuis la page épingle puis libère la barre latérale', async () => {
  await attendreVueAlignee()
  await resultatDansOngletActif(`window.touchesB = 0
    addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'b') window.touchesB++ }); true`)
  const presser = () => app.evaluate(({ BrowserWindow, WebContentsView }) => {
    const vue = BrowserWindow.getAllWindows()[0].contentView.children.find((enfant) => enfant instanceof WebContentsView
      && !enfant.webContents.getURL().includes('vue=barre')) as InstanceType<typeof WebContentsView>
    vue.webContents.focus()
    vue.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'B', modifiers: ['control', 'shift'] })
    vue.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'B', modifiers: ['control', 'shift'] })
  })

  await presser()
  await expect.poll(etatBarre).toEqual({ open: true, pinned: true })
  await expect.poll(async () => (await rectangleZoneContenu()).x).toBe(252)
  await attendreVueAlignee()

  await presser()
  await expect.poll(etatBarre).toEqual({ open: false, pinned: false })
  await expect.poll(async () => (await rectangleZoneContenu()).x).toBe(0)
  await attendreVueAlignee()
  expect(await resultatDansOngletActif<number>('window.touchesB')).toBe(0)

  // Extension (audit de couverture /ship, ARB-33).
  // Value: protects=Ctrl+Maj+B bascule une seule fois l'épinglage depuis la vue de la barre et depuis la barre
  //   d'outils ; la répétition d'un appui long est ignorée ; épinglée, la barre résiste au focus de la page et de
  //   la barre d'outils (masquer n'agit pas sur une barre épinglée);
  //   fails_when=verrouillerInterface ne branche plus brancherRaccourciBarre (rien dans la barre, ou double bascule
  //   avec le keydown React de la fenêtre), isAutoRepeat n'est plus filtré, ou hide ferme une barre épinglée;
  //   why_new=le bloc précédent ne presse le raccourci que dans l'onglet et n'y donne jamais le focus barre épinglée;
  //   seam=none; no_claim=modificateur isAutoRepeat simulé par sendInputEvent, pas un vrai appui long au clavier.
  const presserDans = (cible: 'onglet' | 'barre' | 'fenetre', repetition = false) =>
    app.evaluate(({ BrowserWindow, WebContentsView }, { cible, repetition }) => {
      const fenetre = BrowserWindow.getAllWindows()[0]
      const contenu = cible === 'fenetre' ? fenetre.webContents
        : (fenetre.contentView.children.find((enfant) => enfant instanceof WebContentsView
          && enfant.webContents.getURL().includes('vue=barre') === (cible === 'barre')) as InstanceType<typeof WebContentsView>).webContents
      contenu.focus()
      const modifiers: Array<'control' | 'shift' | 'isautorepeat'> = repetition ? ['control', 'shift', 'isautorepeat'] : ['control', 'shift']
      contenu.sendInputEvent({ type: 'keyDown', keyCode: 'B', modifiers })
      contenu.sendInputEvent({ type: 'keyUp', keyCode: 'B', modifiers: ['control', 'shift'] })
    }, { cible, repetition })

  await presserDans('onglet', true)
  // gstack-timing-ok: vérification négative (rien ne doit changer) ; le processus principal traite l'événement de façon synchrone.
  await ui.waitForTimeout(500)
  expect(await etatBarre()).toEqual({ open: false, pinned: false })

  await presserDans('barre')
  await expect.poll(etatBarre).toEqual({ open: true, pinned: true })
  await cliquerDans('onglet')
  await cliquerDans('fenetre')
  // gstack-timing-ok: vérification négative (rien ne doit changer) ; le processus principal traite l'événement de façon synchrone.
  await ui.waitForTimeout(500)
  expect(await etatBarre()).toEqual({ open: true, pinned: true })

  await presserDans('fenetre')
  await expect.poll(etatBarre).toEqual({ open: false, pinned: false })
  // gstack-timing-ok: vérification négative (rien ne doit changer) ; le processus principal traite l'événement de façon synchrone.
  await ui.waitForTimeout(500)
  expect(await etatBarre()).toEqual({ open: false, pinned: false })
  await attendreVueAlignee()
})

// Value: protects=verrouillage de la vue de la barre latérale (ARB-33), qui porte le preload comme la fenêtre :
//   elle ne navigue pas et n'ouvre pas de fenêtre, et ses appels IPC sont acceptés ; chargée sur une autre page,
//   elle perd l'IPC;
//   fails_when=verrouillerInterface n'est plus appliqué à la vue de la barre, ou emetteurAutorise ne reconnaît plus
//   son webContents; why_new=C15 ne vise que la fenêtre d'interface; seam=none; no_claim=ne couvre pas un fichier local quasi-homonyme (C17, fenêtre seule).
test('C34 : la vue de la barre ne navigue pas, n’ouvre pas de fenêtre et pilote l’IPC', async () => {
  const urlBarre = barreUi.url()
  expect(await barreUi.evaluate(() => window.arbalete.getState().then((etat) => etat.tabs.length > 0))).toBe(true)
  expect(await barreUi.evaluate((url) => window.open(url) === null, `${origine}/page-b.html`)).toBe(true)
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
  await barreUi.evaluate((url) => { location.href = url }, `${origine}/page-b.html`)
  // gstack-timing-ok: vérification négative (rien ne doit changer) ; le processus principal traite l'événement de façon synchrone.
  await barreUi.waitForTimeout(500)
  expect(barreUi.url()).toBe(urlBarre)

  // Chargée sur une autre page depuis le processus principal, la vue de la barre garde le preload mais perd l'IPC
  // (contrôle d'URL d'emetteurAutorise, comme C16 pour la fenêtre).
  const statuts = await app.evaluate(async ({ BrowserWindow, WebContentsView }, url) => {
    const vue = BrowserWindow.getAllWindows()[0].contentView.children.find((enfant) => enfant instanceof WebContentsView
      && enfant.webContents.getURL().includes('vue=barre')) as InstanceType<typeof WebContentsView>
    const urlInterface = vue.webContents.getURL()
    try {
      await vue.webContents.loadURL(url)
      return await vue.webContents.executeJavaScript(`Promise.allSettled([window.arbalete.getState(),
        window.arbalete.createTab('http://127.0.0.1:1/intrus')]).then((r) => r.map((x) => x.status))`)
    } finally {
      await vue.webContents.loadURL(urlInterface)
    }
  }, `${origine}/page-a.html`)
  expect(statuts).toEqual(['rejected', 'rejected'])

  // Playwright attend encore la navigation refusée : on recharge la vue depuis le processus principal pour la suite.
  await app.evaluate(({ BrowserWindow, WebContentsView }) => {
    const vue = BrowserWindow.getAllWindows()[0].contentView.children.find((enfant) => enfant instanceof WebContentsView
      && enfant.webContents.getURL().includes('vue=barre')) as InstanceType<typeof WebContentsView>
    vue.webContents.reload()
  })
  await expect(barreUi.getByTestId('sidebar-hover-strip')).toBeAttached()
})

// Généré par l'audit de couverture /ship (ARB-33).
// Value: protects=thème choisi tenu par le processus principal : le bouton de la barre d'outils l'applique à la fenêtre
//   et à la barre, le thème système (nativeTheme) aussi ; set-theme et set-sidebar refusent un argument hors liste;
//   fails_when=browser:theme ou browser:system-theme ne part plus qu'à la fenêtre, la barre n'écoute plus onTheme, le
//   bouton ne passe plus par setTheme, ou exigerChoix laisse passer une valeur inconnue (règle 2);
//   why_new=aucun test ne touchait au thème (C8 manuel) ni aux arguments des nouveaux canaux; seam=none (nativeTheme.
//   themeSource pilote le thème système); no_claim=ne vérifie ni les couleurs rendues ni le thème réel de Windows.
test('C35 : le thème s’applique à la fenêtre et à la barre ; set-theme et set-sidebar valident leur argument', async () => {
  const themes = async () => [
    await ui.locator('.app-shell').getAttribute('class'),
    await barreUi.locator('.sidebar-zone').getAttribute('class')
  ].map((classes) => /theme-(dark|light)/.exec(classes ?? '')?.[1])
  const choix = () => barreUi.evaluate(() => window.arbalete.getTheme())
  const bouton = ui.getByTitle('Thème : changer le mode')
  expect(await choix()).toBe('system')
  try {
    await bouton.click()
    await expect.poll(choix).toBe('dark')
    await expect.poll(themes).toEqual(['dark', 'dark'])
    await bouton.click()
    await expect.poll(choix).toBe('light')
    await expect.poll(themes).toEqual(['light', 'light'])
    await bouton.click()
    await expect.poll(choix).toBe('system')
    // Thème système : un changement de nativeTheme atteint la fenêtre et la barre.
    await app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'light' })
    await expect.poll(themes).toEqual(['light', 'light'])
    await app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'dark' })
    await expect.poll(themes).toEqual(['dark', 'dark'])
  } finally {
    await app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'system' })
  }

  const statuts = await ui.evaluate(() => Promise.allSettled([
    window.arbalete.setTheme('rouge' as never),
    window.arbalete.setSidebar('ouvrir' as never)
  ]).then((reponses) => reponses.map((reponse) => reponse.status)))
  expect(statuts).toEqual(['rejected', 'rejected'])
  expect(await choix()).toBe('system')
  expect(await etatBarre()).toEqual({ open: false, pinned: false })
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

  // Extension (audit de couverture /ship, ARB-33).
  // Value: protects=la vue de la barre latérale (bande de survol) couvre toute la hauteur de la fenêtre après un
  //   redimensionnement; fails_when=le gestionnaire resize n'appelle plus placerBarre (bande figée à l'ancienne
  //   hauteur, bas du bord gauche sans survol); why_new=C31 et C33 ne regardent que x et la largeur; seam=none;
  //   no_claim=ne couvre ni la maximisation ni le facteur de zoom Windows != 100 %.
  const hauteurFenetre = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentBounds().height)
  await expect.poll(async () => (await boundsBarre())?.height).toBe(hauteurFenetre)
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

// Value: protects=épinglage par les boutons (ARB-33) -> ResizeObserver -> setContentBounds -> setBounds : épinglée, la
//   barre prend sa place à gauche et la page se décale d'autant ; libérée, la page revient au bord, vue réalignée;
//   fails_when=le bouton de la barre d'outils ou celui de la barre n'appelle plus toggle-pin, la réserve de 252 px
//   disparaît (la barre épinglée recouvrirait la page), ou setBounds ignore les nouvelles bornes;
//   why_new=ARB-33 remplace le repli d'ARB-109 par l'épinglage; seam=none;
//   no_claim=ne couvre pas Ctrl+Maj+B (C32).
test('C9 : épingler puis libérer la barre latérale réaligne la vue web', async () => {
  await epinglerBarre(true)
  await expect.poll(async () => (await rectangleZoneContenu()).x).toBe(252)
  await attendreVueAlignee()
  expect(await boundsBarre()).toMatchObject({ x: 0, width: 252 })

  await barreUi.getByTitle('Libérer la barre latérale (Ctrl+Maj+B)').click()
  await expect.poll(etatBarre).toEqual({ open: false, pinned: false })
  await expect.poll(async () => (await rectangleZoneContenu()).x).toBe(0)
  await attendreVueAlignee()
  expect(await boundsVueActive()).toEqual(await rectangleZoneContenu())
})

test('C4 : créer, activer et fermer des onglets ; seul l’onglet actif est affiché', async () => {
  const vuesAffichees = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.length)
  const vuesAvecUnOnglet = await vuesAffichees()
  // Les onglets se gèrent dans la barre latérale : on l'épingle pour la garder ouverte pendant les clics.
  await epinglerBarre(true)

  const avant = (await etat()).tabs.length
  await barreUi.locator('.new-tab-button').click()
  await expect.poll(async () => (await etat()).tabs.length).toBe(avant + 1)
  expect(await vuesAffichees()).toBe(vuesAvecUnOnglet)

  const premier = (await etat()).tabs[0]
  await barreUi.locator('.tab-select').first().click()
  await expect.poll(async () => (await etat()).activeTabId).toBe(premier.id)

  // Fermer tous les onglets : le dernier fermé est remplacé par un nouvel onglet.
  const idsInitiaux = (await etat()).tabs.map((tab) => tab.id)
  for (let restant = idsInitiaux.length; restant > 1; restant--) {
    await barreUi.locator('.tab-close').first().click()
    await expect.poll(async () => (await etat()).tabs.length).toBe(restant - 1)
  }
  await barreUi.locator('.tab-close').first().click()
  await expect.poll(async () => idsInitiaux.includes((await etat()).tabs[0]?.id)).toBe(false)
  expect((await etat()).tabs).toHaveLength(1)
  expect(await vuesAffichees()).toBe(vuesAvecUnOnglet)
  // La barre reste au-dessus de l'onglet qui remplace le dernier fermé.
  expect(await barreAuPremierPlan()).toBe(true)
  await epinglerBarre(false)
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

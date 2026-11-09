import { spawn, spawnSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type { AddressInfo } from 'node:net'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import type { BrowserState } from '../src/shared/types'

// Contrat de régression d'ARB-4 (C1-C7, C11, C12), verrouillage de l'interface d'ARB-12/13/14 (C13-C17),
// ouvertures d'ARB-101/102 (C19-C24, C26, C27 : menu, F12, window.open) et barre latérale masquée d'ARB-33
// (C9, C31 à C35 : masquée à l'ouverture, survol, épinglage, Ctrl+Maj+B, verrouillage de sa vue, thème partagé et
// arguments validés de set-theme et set-sidebar), raccourcis du processus principal d'ARB-18 (C36) et instance unique
// d'ARB-117 (C37) et profil de données des tests d'ARB-118 (C38, C39) et
// sauvegarde et restauration de la session d'ARB-44/45 (C40, C41), invite après un arrêt forcé d'ARB-46 (C42) et
// incidents de la base d'ARB-119 (C43, C44), refus des permissions d'ARB-120 (C45) et historique des visites
// d'ARB-51 (C46), couche d'overlays d'ARB-39 (C47),
// exécutés sur l'app construite (out/).
// C18, C25 et C28 à C30 (mode développement) sont dans developpement.spec.ts.
// C8 (thème système) et C10 (aperçu web) restent dans la liste manuelle de la PR.
// Le premier onglet charge https://www.google.com : le démarrage dépend du réseau, pas les assertions.

const pages: Record<string, string> = {
  '/page-a.html': `<!doctype html><title>Page A</title>
    <a id="suivante" href="/page-b.html">suivante</a>
    <a id="popup" href="/page-b.html" target="_blank">popup</a>
    <a id="bloquee" href="arbalete-test:bloquee">bloquée</a>
    <a id="vide" href="about:blank">vide</a>
    <iframe id="cadre" srcdoc="<p>cadre</p>"></iframe>`,
  '/page-b.html': '<!doctype html><title>Page B</title><p>Page B</p>',
  // Un grand lien à position connue (ARB-36) : le survol à (200, 150) le touche, (600, 400) non.
  '/page-survol.html': `<!doctype html><title>Page survol</title><body style="margin:0">
    <a href="/page-b.html?q=survol" style="position:absolute;left:100px;top:100px;width:300px;height:100px;display:block">lien</a>`,
  // Favicon data: de 1 pixel (ARB-35) ; page-b n'en déclare pas.
  '/page-icone.html': `<!doctype html><title>Page icône</title>
    <link rel="icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==">`
}

// Nombre de requêtes reçues par chemin : prouve qu'un rechargement repasse bien par le réseau.
const requetes: Record<string, number> = {}

let serveur: Server
let origine: string
// Dossier userData temporaire de l'app lancée par les tests (ARB-118), supprimé à la fin.
let profil: string
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

  profil = mkdtempSync(join(tmpdir(), 'arbalete-test-'))
  app = await electron.launch({ args: ['.'], cwd: resolve(__dirname, '..'), env: envTest() })
  ui = await fenetreInterface(app)
  barreUi = await vueBarre(app)
  // Le vrai curseur de l'utilisateur ne doit pas interférer : la barre s'ouvre au survol réel du bord gauche (onMouseEnter).
  // Les événements de Playwright (CDP) et de sendInputEvent ne passent pas par la souris du système, donc restent actifs.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setIgnoreMouseEvents(true))
})

test.afterAll(async () => {
  await app?.close()
  await new Promise((done) => serveur?.close(done))
  if (profil) rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
})

// Profil de données propre aux tests (ARB-118) : jamais l'arbalete.db de l'utilisateur, et un verrou d'instance
// unique distinct du sien.
function envTest(dossier = profil): Record<string, string> {
  const env = { ...process.env, ARBALETE_PROFIL_TEST: dossier } as Record<string, string>
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

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

// Ouverte ou non, épinglée ou non : le mode compact et la largeur (ARB-123) ont leur propre test (C59).
function etatBarre() {
  return ui.evaluate(() => window.arbalete.getSidebar().then(({ open, pinned }) => ({ open, pinned })))
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
//   la barre passe sous l'onglet, ou la zone de contenu ne part plus de la marge de 8 px du bord gauche; why_new=ARB-33 remplace la
//   barre repliée d'ARB-109 (ancien C31); seam=none; no_claim=ne vérifie pas la transparence de la bande à l'écran.
test('C31 : la barre latérale est masquée à l’ouverture et la page occupe toute la largeur', async () => {
  expect(await etatBarre()).toEqual({ open: false, pinned: false })
  expect(await boundsBarre()).toMatchObject({ x: 0, y: 0, width: 6 })
  await expect(barreUi.getByTestId('sidebar-hover-strip')).toBeAttached()
  await expect(barreUi.locator('.sidebar')).toHaveCount(0)
  await expect(ui.locator('.sidebar')).toHaveCount(0)
  await attendreVueAlignee()
  // Cadre de page (ARB-32) : marge de 8 px (--space-2) de chaque côté, la vue web alignée dessus.
  const zone = await rectangleZoneContenu()
  expect(zone.x).toBe(8)
  expect(zone.x + zone.width).toBe((await ui.evaluate(() => window.innerWidth)) - 8)
  // Marge basse de 8 px sous la page et coins de 10 px (--radius-md), mesurés sur le rendu de l'interface.
  const cadre = await ui.locator('.web-content').evaluate((el) => ({
    bas: Math.round((el.parentElement as HTMLElement).getBoundingClientRect().bottom - el.getBoundingClientRect().bottom),
    rayon: getComputedStyle(el).borderTopLeftRadius
  }))
  expect(cadre).toEqual({ bas: 8, rayon: '10px' })
  expect(await barreAuPremierPlan()).toBe(true)
  // Le focus clavier reste à la page (webContents.isFocused : Playwright émule document.hasFocus dans chaque page).
  expect(await app.evaluate(({ BrowserWindow, WebContentsView }) => BrowserWindow.getAllWindows()[0].contentView.children
    .some((enfant) => enfant instanceof WebContentsView && enfant.webContents.getURL().includes('vue=barre')
      && enfant.webContents.isFocused()))).toBe(false)
  // Extension (audit de couverture /ship, ARB-110).
  // Value: protects=au démarrage, barre masquée, le focus clavier va à la page de l'onglet actif;
  //   fails_when=le focus rendu à l'onglet au did-finish-load de la barre disparaît ou vise une autre vue;
  //   why_new=la vérification précédente ne prouve que l'absence de focus sur la barre; seam=none;
  //   no_claim=focus des webContents, pas le focus réel du système ; passe aussi sans le correctif, la course
  //   d'ARB-110 étant intermittente (contrôle positif, pas une preuve de régression).
  await expect.poll(() => app.evaluate(({ BrowserWindow, WebContentsView }) => BrowserWindow.getAllWindows()[0].contentView.children
    .some((enfant) => enfant instanceof WebContentsView && /^https?:/.test(enfant.webContents.getURL())
      && enfant.webContents.isFocused()))).toBe(true)
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
  await expect.poll(async () => (await rectangleZoneContenu()).x).toBe(260)
  await attendreVueAlignee()

  await presser()
  await expect.poll(etatBarre).toEqual({ open: false, pinned: false })
  await expect.poll(async () => (await rectangleZoneContenu()).x).toBe(8)
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
// Étendu par l'audit /ship (ARB-34) : protects=setBackgroundColor suit set-theme et nativeTheme 'updated';
//   fails_when=un des deux appels setBackgroundColor ou themeEffectif() est retiré ou faux; seam=none.
// Étendu (ARB-30) : protects=les boutons Windows (titleBarOverlay) reçoivent les couleurs et la hauteur du thème effectif à
//   chaque changement; fails_when=appliquerThemeFenetre n'appelle plus setTitleBarOverlay ou lui passe le mauvais thème;
//   seam=none (espion posé sur l'instance de la fenêtre); no_claim=ne prouve pas que Windows affiche ces couleurs.
test('C35 : le thème s’applique à la fenêtre et à la barre ; set-theme et set-sidebar valident leur argument', async () => {
  // data-theme sur <html> choisit la palette de design-system/tokens.css (ARB-34).
  const themes = async () => [
    await ui.locator('html').getAttribute('data-theme'),
    await barreUi.locator('html').getAttribute('data-theme'),
    // Fond natif de la fenêtre (FOND_FENETRE, ARB-34) : suit le thème effectif, choisi ou système.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBackgroundColor().toLowerCase()),
    // Boutons Windows (titleBarOverlay, ARB-30) : dernières couleurs et hauteur envoyées par appliquerThemeFenetre, relevées
    // par l'espion posé ci-dessous (Playwright ne peut pas les relire sur la fenêtre).
    await app.evaluate(() => {
      const dernier = (globalThis as unknown as { __overlays: { color: string, symbolColor: string, height: number }[] }).__overlays.at(-1)
      return dernier && `${dernier.color}/${dernier.symbolColor}/${dernier.height}`.toLowerCase()
    })
  ]
  await app.evaluate(({ BrowserWindow }) => {
    const fenetre = BrowserWindow.getAllWindows()[0]
    const relevees: unknown[] = []
    ;(globalThis as unknown as { __overlays: unknown[] }).__overlays = relevees
    const original = fenetre.setTitleBarOverlay.bind(fenetre)
    fenetre.setTitleBarOverlay = (options) => { relevees.push(options); original(options) }
  })
  const choix = () => barreUi.evaluate(() => window.arbalete.getTheme())
  const bouton = ui.getByTitle('Thème : changer le mode')
  expect(await choix()).toBe('system')
  try {
    await bouton.click()
    await expect.poll(choix).toBe('dark')
    await expect.poll(themes).toEqual(['dark', 'dark', '#111820', '#111820/#e8edf2/48'])
    await bouton.click()
    await expect.poll(choix).toBe('light')
    await expect.poll(themes).toEqual(['light', 'light', '#f3f5f7', '#f3f5f7/#202b36/48'])
    await bouton.click()
    await expect.poll(choix).toBe('system')
    // Thème système : un changement de nativeTheme atteint la fenêtre et la barre.
    await app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'light' })
    await expect.poll(themes).toEqual(['light', 'light', '#f3f5f7', '#f3f5f7/#202b36/48'])
    await app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'dark' })
    await expect.poll(themes).toEqual(['dark', 'dark', '#111820', '#111820/#e8edf2/48'])
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

// Value: protects=couche d'overlays (ARB-39, décision 0002) : le menu d'un onglet s'affiche dans la vue de la barre,
//   agrandie à toute la fenêtre et au premier plan, se ferme par Échap (depuis la page, que la page ne reçoit pas),
//   par un clic hors du menu, par une entrée, par la perte de focus, par un raccourci (qui agit ensuite) ou quand son
//   onglet est fermé ailleurs, rend à la barre sa taille, suit le redimensionnement, suspend le retrait de la barre,
//   laisse Échap à la page hors overlay, et seule la vue de la barre ouvre ou ferme un overlay;
//   fails_when=placerBarre ignore overlayOuvert, Échap n'est plus intercepté par brancherRaccourcis ou l'est aussi hors
//   overlay, un raccourci ou blur ne ferme plus l'overlay, la barre garde un menu sans onglet, agirSurBarre retire la
//   barre pendant l'overlay, ou set-overlay accepte la fenêtre, une page intruse ou un non-booléen;
//   why_new=aucun test n'agrandissait la vue de la barre; seam=none;
//   no_claim=clics simulés (Playwright, sendInputEvent) adressés à la vue de la barre : l'ordre natif des vues, qui
//   empêche la page de recevoir le clic, est vérifié par barreAuPremierPlan, pas par un vrai pointeur.
test('C47 : le menu d’un onglet s’ouvre en overlay sur toute la fenêtre et se ferme par Échap, clic ou entrée', async () => {
  const fenetre = () => app.evaluate(({ BrowserWindow }) => {
    const { width, height } = BrowserWindow.getAllWindows()[0].getContentBounds()
    return { x: 0, y: 0, width, height }
  })
  const overlay = () => barreUi.evaluate(() => window.arbalete.getOverlay())
  const menu = barreUi.getByRole('menu')
  const ouvrirMenu = async (titre: string) => {
    await barreUi.locator('.tab-item').filter({ hasText: titre }).click({ button: 'right' })
    await expect(menu).toBeVisible()
    await expect.poll(boundsBarre).toEqual(await fenetre())
  }
  // Touche native envoyée à la page de l'onglet actif, focus compris : before-input-event la voit comme un vrai clavier.
  const toucheDansOnglet = (keyCode: string, modifiers: Array<'control'> = []) =>
    app.evaluate(({ BrowserWindow, WebContentsView }, { keyCode, modifiers }) => {
      const vue = BrowserWindow.getAllWindows()[0].contentView.children.find((enfant) => enfant instanceof WebContentsView
        && !enfant.webContents.getURL().includes('vue=barre')) as InstanceType<typeof WebContentsView>
      vue.webContents.focus()
      vue.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
      vue.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
    }, { keyCode, modifiers })
  const largeurRendue = async () => expect.poll(async () => (await boundsBarre())?.width).toBe(252)

  await ui.evaluate((url) => window.arbalete.createTab(url), `${origine}/page-a.html`)
  await attendreUrlActive(`${origine}/page-a.html`)
  await expect.poll(async () => ongletActif(await etat())?.title).toBe('Page A')
  await resultatDansOngletActif(`window.recus = { mousedown: 0, escape: 0 }
    addEventListener('mousedown', () => window.recus.mousedown++, true)
    addEventListener('keydown', (e) => { if (e.key === 'Escape') window.recus.escape++ }, true)
    window.relaches = 0
    addEventListener('keyup', (e) => { if (e.key === 'Escape') window.relaches++ }, true); true`)
  await epinglerBarre(true)
  try {
    expect(await overlay()).toBe(false)

    // Clic droit sur l'onglet : la vue de la barre couvre la fenêtre, au premier plan, menu visible.
    await ouvrirMenu('Page A')
    expect(await overlay()).toBe(true)
    expect(await ui.evaluate(() => window.arbalete.getOverlay())).toBe(true)
    expect(await barreAuPremierPlan()).toBe(true)

    // Redimensionner la fenêtre pendant l'overlay : la vue suit la nouvelle taille.
    const taille = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentSize())
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1000, 700))
      await expect.poll(boundsBarre).toEqual({ x: 0, y: 0, width: 1000, height: 700 })
    } finally {
      await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setContentSize(w, h), taille)
    }
    await expect.poll(boundsBarre).toEqual(await fenetre())

    // Échap depuis la page ferme l'overlay sans atteindre la page ; la barre épinglée reprend sa largeur.
    await toucheDansOnglet('Escape')
    await expect.poll(overlay).toBe(false)
    await expect(menu).toHaveCount(0)
    await expect.poll(async () => (await boundsBarre())?.width).toBe(252)
    await attendreVueAlignee()

    // Clic hors du menu : l'overlay se ferme, la page ne reçoit rien.
    await ouvrirMenu('Page A')
    const { width, height } = await fenetre()
    await barreUi.mouse.click(width - 40, height - 40)
    await expect.poll(overlay).toBe(false)
    await expect.poll(async () => (await boundsBarre())?.width).toBe(252)
    expect(await resultatDansOngletActif('window.recus')).toEqual({ mousedown: 0, escape: 0 })

    // Sans overlay, Échap revient à la page.
    await toucheDansOnglet('Escape')
    await expect.poll(async () => (await resultatDansOngletActif<{ escape: number }>('window.recus')).escape).toBe(1)
    // Seul ce relâchement atteint la page : celui de l'Échap qui fermait l'overlay est avalé avec son appui.
    await expect.poll(() => resultatDansOngletActif('window.relaches')).toBe(1)

    // La fenêtre perd le focus (Alt+Tab) : l'overlay se ferme.
    await ouvrirMenu('Page A')
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].emit('blur') })
    await expect.poll(overlay).toBe(false)
    await largeurRendue()

    // Un raccourci pendant l'overlay le ferme, puis agit : Ctrl+T ouvre un onglet.
    const avant = (await etat()).tabs.length
    await ouvrirMenu('Page A')
    await toucheDansOnglet('T', ['control'])
    await expect.poll(async () => (await etat()).tabs.length).toBe(avant + 1)
    await expect.poll(overlay).toBe(false)
    await largeurRendue()

    // L'onglet du menu fermé ailleurs : l'overlay se ferme avec lui.
    const { tabs, activeTabId } = await etat()
    const rang = tabs.findIndex((tab) => tab.id === activeTabId)
    await barreUi.locator('.tab-item').nth(rang).click({ button: 'right' })
    await expect(menu).toBeVisible()
    await ui.evaluate((id) => window.arbalete.closeTab(id), activeTabId as string)
    await expect.poll(overlay).toBe(false)
    await expect(menu).toHaveCount(0)
    await largeurRendue()

    // Entrée « Fermer l'onglet » : l'onglet visé est fermé, l'overlay aussi.
    const vise = (await etat()).tabs.find((tab) => tab.title === 'Page A')!
    await ouvrirMenu('Page A')
    await menu.getByRole('menuitem', { name: 'Fermer l’onglet' }).click()
    await expect.poll(async () => (await etat()).tabs.some((tab) => tab.id === vise.id)).toBe(false)
    await expect.poll(overlay).toBe(false)
    await expect.poll(async () => (await boundsBarre())?.width).toBe(252)
    await attendreVueAlignee()
  } finally {
    await barreUi.evaluate(() => window.arbalete.setOverlay(false))
    await epinglerBarre(false)
  }

  // Barre ouverte au survol : pendant l'overlay, ni la sortie de la souris ni set-sidebar 'hide' ne la retirent.
  // Le dernier clic simulé a laissé le pointeur dans la vue : on l'en fait sortir, sinon l'entrée peut être ignorée.
  await souris('mouseLeave', 240)
  await souris('mouseEnter', 2)
  await expect.poll(etatBarre).toEqual({ open: true, pinned: false })
  await barreUi.locator('.tab-item').first().click({ button: 'right' })
  await expect.poll(overlay).toBe(true)
  await souris('mouseLeave', 240)
  await ui.evaluate(() => window.arbalete.setSidebar('hide'))
  // gstack-timing-ok: vérification négative (rien ne doit changer) ; le processus principal traite l'appel de façon synchrone.
  await ui.waitForTimeout(300)
  expect(await etatBarre()).toEqual({ open: true, pinned: false })
  await expect.poll(boundsBarre).toEqual(await fenetre())
  await barreUi.evaluate(() => window.arbalete.setOverlay(false))
  await expect.poll(overlay).toBe(false)
  // Après la fermeture, le retrait dépend du vrai pointeur (hors test) : on retire la barre explicitement.
  await ui.evaluate(() => window.arbalete.setSidebar('hide'))
  await expect.poll(etatBarre).toEqual({ open: false, pinned: false })
  await expect.poll(async () => (await boundsBarre())?.width).toBe(6)

  // set-overlay : refusé depuis la fenêtre d'interface, avec un argument non booléen et depuis une page intruse.
  const refus = await Promise.all([
    ui.evaluate(() => window.arbalete.setOverlay(true).then(() => 'fulfilled', () => 'rejected')),
    barreUi.evaluate(() => window.arbalete.setOverlay('oui' as never).then(() => 'fulfilled', () => 'rejected'))
  ])
  expect(refus).toEqual(['rejected', 'rejected'])
  const intrus = await app.evaluate(async ({ BrowserWindow }, { preload, url }) => {
    const intruse = new BrowserWindow({ show: false, webPreferences: { preload, contextIsolation: true, sandbox: true } })
    try {
      await intruse.loadURL(url)
      return await intruse.webContents.executeJavaScript(`Promise.allSettled([window.arbalete.setOverlay(true),
        window.arbalete.getOverlay()]).then((r) => r.map((x) => x.status))`)
    } finally {
      intruse.destroy()
    }
  }, { preload: resolve(__dirname, '../out/preload/index.js'), url: `${origine}/page-a.html` })
  expect(intrus).toEqual(['rejected', 'rejected'])
  expect(await overlay()).toBe(false)
  expect((await boundsBarre())?.width).toBe(6)
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

  // Fin d'historique (ARB-31) : Suivant est désactivé, Précédent et Recharger restent actifs.
  await expect(ui.getByTitle('Suivant (Alt+→)')).toBeDisabled()
  await expect(ui.getByTitle('Précédent (Alt+←)')).toBeEnabled()
  await expect(ui.getByTitle('Recharger')).toBeEnabled()
})

// Value: protects=raccourcis d'Arbalète où que soit le focus (ARB-18) : depuis la page, Ctrl+L met le focus dans la
//   barre d'adresse, Alt+←/→ suivent l'historique, Ctrl+T ouvre un onglet et Ctrl+W le ferme ; la page ne reçoit pas
//   ces touches ; depuis la barre latérale et la fenêtre, Ctrl+T n'ouvre qu'un onglet;
//   fails_when=brancherRaccourcis n'est plus branché sur une vue, une combinaison n'est plus reconnue, ou le keydown
//   React de l'interface double l'action du processus principal; why_new=ces raccourcis n'existaient que dans le
//   keydown React de l'interface, sourd quand le focus est dans la page; seam=none (sendInputEvent atteint
//   before-input-event, comme C32); no_claim=pas de vrai clavier ni de disposition AZERTY.
test('C36 : Ctrl+L, Alt+←/→, Ctrl+T et Ctrl+W fonctionnent depuis la page, la barre et la fenêtre', async () => {
  await saisirAdresse(`${origine}/page-a.html`)
  await attendreUrlActive(`${origine}/page-a.html`)
  await dansOngletActif("document.getElementById('suivante').click()")
  await attendreUrlActive(`${origine}/page-b.html`)
  await resultatDansOngletActif(`window.touches = []
    addEventListener('keydown', (e) => window.touches.push(e.key)); true`)
  const presser = (cible: 'onglet' | 'barre' | 'fenetre', keyCode: string, modifiers: Array<'control' | 'alt'>) =>
    app.evaluate(({ BrowserWindow, WebContentsView }, { cible, keyCode, modifiers }) => {
      const fenetre = BrowserWindow.getAllWindows()[0]
      const contenu = cible === 'fenetre' ? fenetre.webContents
        : (fenetre.contentView.children.find((enfant) => enfant instanceof WebContentsView
          && enfant.webContents.getURL().includes('vue=barre') === (cible === 'barre')) as InstanceType<typeof WebContentsView>).webContents
      contenu.focus()
      contenu.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
      contenu.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
    }, { cible, keyCode, modifiers })
  const nombreOnglets = async () => (await etat()).tabs.length

  await presser('onglet', 'L', ['control'])
  await expect(ui.getByLabel('Adresse ou recherche')).toBeFocused()
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.isFocused())).toBe(true)
  expect(await resultatDansOngletActif<string[]>('window.touches')).toEqual([])

  await presser('onglet', 'Left', ['alt'])
  await attendreUrlActive(`${origine}/page-a.html`)
  await presser('onglet', 'Right', ['alt'])
  await attendreUrlActive(`${origine}/page-b.html`)

  const avant = await nombreOnglets()
  const ongletInitial = (await etat()).activeTabId
  await presser('onglet', 'T', ['control'])
  await expect.poll(nombreOnglets).toBe(avant + 1)
  await expect.poll(async () => (await etat()).activeTabId).not.toBe(ongletInitial)
  // Le nouvel onglet donne le focus à la barre d'adresse, sans refocalisation par le test.
  await expect(ui.getByLabel('Adresse ou recherche')).toBeFocused()
  await expect.poll(() => app.evaluate(({ BrowserWindow, webContents }) =>
    webContents.getFocusedWebContents() === BrowserWindow.getAllWindows()[0].webContents)).toBe(true)
  await presser('onglet', 'W', ['control'])
  await expect.poll(nombreOnglets).toBe(avant)
  // Après la fermeture, l'onglet redevenu actif reçoit le clavier.
  await expect.poll(() => app.evaluate(({ webContents }) => webContents.getFocusedWebContents()?.getURL() ?? '')).toBe(`${origine}/page-b.html`)

  for (const cible of ['barre', 'fenetre'] as const) {
    await presser(cible, 'T', ['control'])
    await expect.poll(nombreOnglets).toBe(avant + 1)
    // Le keydown React de l'interface ne reçoit pas la touche : pas de second onglet.
    await new Promise((attente) => setTimeout(attente, 500))
    expect(await nombreOnglets()).toBe(avant + 1)
    await presser('onglet', 'W', ['control'])
    await expect.poll(nombreOnglets).toBe(avant)
  }

  // Extension (audit de couverture /ship, ARB-18).
  // Value: protects=AltGr (Ctrl+Alt) n'est pas un raccourci : Ctrl+Alt+L (ł en polonais) et Ctrl+Alt+T arrivent à la
  //   page, sans onglet ouvert ni focus déplacé vers la barre d'adresse;
  //   fails_when=actionDuRaccourci ne vérifie plus !input.alt, ou brancherRaccourcis fait preventDefault sur toute
  //   touche; why_new=le bloc précédent ne presse que des combinaisons reconnues, jamais une touche qui doit passer;
  //   seam=none; no_claim=AltGr simulé par les modificateurs control+alt de sendInputEvent, pas une disposition réelle.
  // Alt+←/→ ont rechargé page-b : nouveau document, l'écouteur du début n'y est plus.
  await resultatDansOngletActif(`window.touches = []
    addEventListener('keydown', (e) => window.touches.push(e.key)); true`)
  await presser('onglet', 'L', ['control', 'alt'])
  await presser('onglet', 'T', ['control', 'alt'])
  await expect.poll(() => resultatDansOngletActif<string[]>(
    "window.touches.filter((t) => t.length === 1).map((t) => t.toLowerCase())")).toEqual(['l', 't'])
  expect(await nombreOnglets()).toBe(avant)
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.isFocused())).toBe(false)
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
// pas l'appel au gestionnaire. about:blank n'émet ni will-navigate ni will-frame-navigate : depuis ARB-97, le processus
// principal défait la navigation par un retour en arrière, pour le cadre principal seulement (un sous-cadre peut y
// aller, comme le font beaucoup de sites).
test('C6 : une navigation de la page vers un schéma non http ou vers about:blank est bloquée', async () => {
  await saisirAdresse(`${origine}/page-a.html`)
  await attendreUrlActive(`${origine}/page-a.html`)

  await dansOngletActif("document.getElementById('bloquee').click()")
  await ui.waitForTimeout(1_000)
  expect(ongletActif(await etat())?.url).toBe(`${origine}/page-a.html`)

  await dansOngletActif("document.getElementById('vide').click()")
  await ui.waitForTimeout(1_000)
  expect(ongletActif(await etat())?.url).toBe(`${origine}/page-a.html`)
  expect(await resultatDansOngletActif('document.title')).toBe('Page A')

  // Un sous-cadre garde le droit d'aller sur about:blank.
  await dansOngletActif("document.getElementById('cadre').contentWindow.location.replace('about:blank')")
  await expect.poll(() => resultatDansOngletActif("document.getElementById('cadre').contentWindow.location.href")).toBe('about:blank')
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

// Value: protects=refus par défaut étendu aux vérifications (setPermissionCheckHandler) et aux périphériques
//   (setDevicePermissionHandler, select-hid-device/select-serial-port/select-usb-device) (ARB-120);
//   fails_when=un gestionnaire manque : navigator.permissions rapporte 'granted' ou 'prompt', ou une demande de
//   périphérique reste sans réponse de l'app; why_new=C7 ne couvre que les demandes; seam=événements select-* émis depuis
//   le processus principal avec un périphérique fictif, la machine de test n'en ayant aucun à proposer;
//   no_claim=ne branche aucun périphérique réel ; setDevicePermissionHandler n'est pas observable sans périphérique.
test('C45 : les vérifications de permission et l’accès aux périphériques sont refusés', async () => {
  await saisirAdresse(`${origine}/page-a.html`)
  await attendreUrlActive(`${origine}/page-a.html`)
  await expect.poll(async () => ongletActif(await etat())?.isLoading).toBe(false)

  const etats = await resultatDansOngletActif<string[]>(`Promise.all(
    ['geolocation', 'notifications', 'camera', 'microphone', 'clipboard-read'].map((name) =>
      navigator.permissions.query({ name }).then((statut) => name + '=' + statut.state, () => name + '=erreur'))
  )`)
  expect(etats).toEqual(['geolocation=denied', 'notifications=denied', 'camera=denied', 'microphone=denied', 'clipboard-read=denied'])

  // Avec le geste utilisateur d'executeJavaScript : aucune demande n'aboutit à un périphérique.
  const peripheriques = await resultatDansOngletActif<string[]>(`Promise.all([
    navigator.hid.requestDevice({ filters: [] }).then((liste) => 'hid ' + liste.length, () => 'hid refus'),
    navigator.serial.requestPort().then(() => 'serie accordé', () => 'serie refus'),
    navigator.usb.requestDevice({ filters: [] }).then(() => 'usb accordé', () => 'usb refus')
  ])`)
  expect(peripheriques).toEqual(['hid 0', 'serie refus', 'usb refus'])

  // Un périphérique proposé à la sélection n'est jamais choisi : l'app annule elle-même chaque demande.
  const selections = await app.evaluate(({ session }) => {
    const ses = session.defaultSession
    const reponse = (evenement: string, ...args: unknown[]) => {
      let choix: unknown = 'sans réponse'
      let empeche = false
      const evt = { preventDefault: () => { empeche = true } }
      ses.emit(evenement, evt, ...args, (valeur?: unknown) => { choix = valeur || 'annulé' })
      return `${evenement} ${empeche ? 'gérée' : 'non gérée'} ${String(choix)}`
    }
    return [
      reponse('select-hid-device', { deviceList: [{ deviceId: 'hid-1' }], frame: null }),
      reponse('select-serial-port', [{ portId: 'port-1' }], null),
      reponse('select-usb-device', { deviceList: [{ deviceId: 'usb-1' }], frame: null })
    ]
  })
  expect(selections).toEqual([
    'select-hid-device gérée annulé',
    'select-serial-port gérée annulé',
    'select-usb-device gérée annulé'
  ])
})

// Value: protects=épinglage par les boutons (ARB-33) -> ResizeObserver -> setContentBounds -> setBounds : épinglée, la
//   barre prend sa place à gauche et la page se décale d'autant ; libérée, la page revient au bord, vue réalignée;
//   fails_when=le bouton de la barre d'outils ou celui de la barre n'appelle plus toggle-pin, la réserve de 252 px
//   disparaît (la barre épinglée recouvrirait la page), ou setBounds ignore les nouvelles bornes;
//   why_new=ARB-33 remplace le repli d'ARB-109 par l'épinglage; seam=none;
//   no_claim=ne couvre pas Ctrl+Maj+B (C32).
test('C9 : épingler puis libérer la barre latérale réaligne la vue web', async () => {
  await epinglerBarre(true)
  await expect.poll(async () => (await rectangleZoneContenu()).x).toBe(260)
  await attendreVueAlignee()
  expect(await boundsBarre()).toMatchObject({ x: 0, width: 252 })

  await barreUi.getByTitle('Libérer la barre latérale (Ctrl+Maj+B)').click()
  await expect.poll(etatBarre).toEqual({ open: false, pinned: false })
  await expect.poll(async () => (await rectangleZoneContenu()).x).toBe(8)
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

// Value: protects=polices embarquées de l'interface (ARB-121) : Inter, Manrope et JetBrains Mono se chargent hors ligne,
//   sous la CSP stricte (font-src 'self'), sans violation;
//   fails_when=un @font-face pointe vers un fichier absent du build, ou la CSP bloque les polices;
//   why_new=C13 ne regarde que les scripts inline; seam=none;
//   no_claim=ne couvre ni le rendu à 125 % / 150 % de mise à l'échelle Windows, ni les glyphes hors latin.
test('C48 : les polices embarquées se chargent sous la CSP de l’interface', async () => {
  const resultat = await ui.evaluate(async () => {
    const violations: string[] = []
    document.addEventListener('securitypolicyviolation', (e) => violations.push(e.violatedDirective))
    await Promise.all(['Inter', 'Manrope', 'JetBrains Mono'].map((f) => document.fonts.load(`14px "${f}"`, 'Aa')))
    const chargees = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replaceAll('"', ''))
    return { chargees: [...new Set(chargees)].sort(), violations }
  })
  expect(resultat).toEqual({ chargees: ['Inter', 'JetBrains Mono', 'Manrope'], violations: [] })
})

// Value: protects=barre de contrôle rendue (ARB-31) : 48 px, gap et padding par tokens, champ de 40 px, ordre Épingle →
//   navigation → adresse → actions, et parcours au Tab qui suit cet ordre en sautant les boutons désactivés;
//   fails_when=un contrôle change de place, le gap ou le padding quittent les tokens, la hauteur du champ ou de la barre dérive;
//   why_new=controls.test.ts ne lit que le texte du CSS, pas le rendu; seam=none;
//   no_claim=ne couvre ni le rendu Dark/Light (visuel), ni la mise à l'échelle Windows, ni l'état sans onglet actif.
test('C51 : la barre de contrôle est rendue à 48 px, dans l’ordre prévu, et se parcourt au Tab', async () => {
  const mesure = await ui.evaluate(() => {
    const barre = document.querySelector<HTMLElement>('.toolbar')!
    const style = getComputedStyle(barre)
    const jeton = (nom: string) => getComputedStyle(document.documentElement).getPropertyValue(nom).trim()
    const etiquette = (el: Element) => el.getAttribute('title') ?? el.getAttribute('aria-label') ?? ''
    const champ = barre.querySelector<HTMLElement>('.ui-field')!
    const controles = [...barre.querySelectorAll<HTMLElement>('button, input')]
    return {
      hauteur: barre.getBoundingClientRect().height,
      hauteurJeton: jeton('--size-control-bar'),
      gap: style.columnGap, gapJeton: jeton('--space-2'),
      // À droite, la place des boutons Windows (titleBarOverlay, ARB-30) s'ajoute : voir C53.
      paddingGauche: style.paddingLeft, paddingJeton: jeton('--space-4'),
      hauteurChamp: champ.getBoundingClientRect().height,
      ordre: controles.map(etiquette),
      activables: controles.filter((el) => !(el as HTMLButtonElement).disabled).map(etiquette)
    }
  })
  expect(mesure.hauteur).toBe(parseFloat(mesure.hauteurJeton))
  expect(mesure.hauteurChamp).toBe(40)
  expect(mesure.gap).toBe(mesure.gapJeton)
  expect(mesure.paddingGauche).toBe(mesure.paddingJeton)
  expect(mesure.ordre[0]).toMatch(/^(Épingler|Libérer) la barre latérale/)
  expect(mesure.ordre.slice(1, 4)).toEqual(['Précédent (Alt+←)', 'Suivant (Alt+→)', 'Recharger'])
  expect(mesure.ordre.slice(4)).toEqual(['Adresse ou recherche', 'Ajouter aux favoris', 'Nouvel onglet', 'Thème : changer le mode'])

  // Le Tab part du premier contrôle et visite chaque contrôle activable, dans l'ordre du DOM.
  await ui.locator('.toolbar button').first().focus()
  const parcours: string[] = []
  for (let i = 0; i < mesure.activables.length; i++) {
    parcours.push(await ui.evaluate(() => document.activeElement?.getAttribute('title') ?? document.activeElement?.getAttribute('aria-label') ?? ''))
    await ui.keyboard.press('Tab')
  }
  expect(parcours).toEqual(mesure.activables)
})

// Value: protects=fenêtre sans cadre (ARB-30) : pas de barre de titre native (la zone cliente couvre la fenêtre), les boutons
//   Windows de titleBarOverlay font 48 px de haut, la barre de contrôle leur laisse la place et déplace la fenêtre sans
//   voler le clic de ses boutons ni de son champ;
//   fails_when=titleBarStyle redevient 'default', la hauteur de l'overlay quitte --size-control-bar, le remplissage droit de
//   la barre ne suit plus la zone des boutons (adresse sous les boutons), ou un contrôle devient une zone de déplacement;
//   why_new=aucun test ne regardait le cadre de la fenêtre; seam=none;
//   no_claim=ne déplace pas réellement la fenêtre, ne vérifie ni les couleurs des boutons ni leur survol (natifs).
test('C53 : la fenêtre est sans cadre, la barre de contrôle laisse la place aux boutons Windows et déplace la fenêtre', async () => {
  const cadre = await app.evaluate(({ BrowserWindow }) => {
    const fenetre = BrowserWindow.getAllWindows()[0]
    return { fenetre: fenetre.getSize(), client: fenetre.getContentSize() }
  })
  // À 1 px près : la mise à l'échelle de Windows (125 %, 150 %) arrondit les tailles en pixels physiques.
  expect(Math.abs(cadre.client[0] - cadre.fenetre[0])).toBeLessThanOrEqual(1)
  expect(Math.abs(cadre.client[1] - cadre.fenetre[1])).toBeLessThanOrEqual(1)

  const mesurer = () => ui.evaluate(() => {
    const barre = document.querySelector<HTMLElement>('.toolbar')!
    const zone = (navigator as Navigator & { windowControlsOverlay: { visible: boolean, getTitlebarAreaRect(): DOMRect } }).windowControlsOverlay
    const region = (el: Element) => getComputedStyle(el).getPropertyValue('-webkit-app-region')
    const rect = zone.getTitlebarAreaRect()
    return {
      visible: zone.visible,
      hauteur: rect.height,
      droiteLibre: window.innerWidth - (rect.x + rect.width),
      remplissageDroit: parseFloat(getComputedStyle(barre).paddingRight),
      barre: region(barre),
      boutons: [...barre.querySelectorAll('button')].map(region),
      champ: region(barre.querySelector('input')!),
      groupeChamp: region(barre.querySelector('.ui-field-group')!)
    }
  })
  const mesure = await mesurer()
  expect(mesure.visible).toBe(true)
  expect(mesure.hauteur).toBe(48)
  expect(mesure.droiteLibre).toBeGreaterThan(0)
  expect(Math.abs(mesure.remplissageDroit - mesure.droiteLibre)).toBeLessThan(1)
  expect(mesure.barre).toBe('drag')
  expect(mesure.boutons.every((r) => r === 'no-drag')).toBe(true)
  expect(mesure.champ).toBe('no-drag')
  expect(mesure.groupeChamp).toBe('no-drag')

  // Le remplissage suit la zone des boutons après un redimensionnement (calculé en direct, pas une fois).
  const taille = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getSize())
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 760))
    await expect.poll(async () => {
      const apres = await mesurer()
      return Math.abs(apres.remplissageDroit - apres.droiteLibre) < 1 && apres.droiteLibre > 0
    }).toBe(true)
  } finally {
    await app.evaluate(({ BrowserWindow }, [largeur, hauteur]) => BrowserWindow.getAllWindows()[0].setSize(largeur, hauteur), taille)
  }
})

// Value: protects=vérification de l'émetteur IPC (ARB-14) : une page qui obtient le preload hors de l'interface ne pilote rien;
//   fails_when=un canal n'appelle plus emetteurAutorise, ou le contrôle accepte une autre fenêtre ou une autre URL;
//   why_new=C1-C12 n'appellent l'IPC que depuis l'interface légitime; seam=none (fenêtre intruse créée par le test);
//   no_claim=ne couvre pas un iframe dans l'interface (bloqué en amont par la CSP et ARB-12).
test('C14 : un appel IPC venant d’une autre page que l’interface est refusé', async () => {
  // Le premier onglet charge google.com : tant qu'il charge, son URL passe de « …com » à « …com/ » et fausse la comparaison.
  await expect.poll(async () => ongletActif(await etat())?.isLoading).toBe(false)
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

// Lance l'app une seconde fois, comme depuis l'Explorateur, et rend son code de sortie. Les adresses suivent « -- » :
// sous Windows, Electron refuse de démarrer si un argument suit une adresse (protection contre l'injection d'options
// par un lien, CVE-2018-1000006).
function lancerSecondeInstance(args: string[]): Promise<number | null> {
  const cheminElectron = require('electron') as string
  return new Promise((termine, echoue) => {
    const seconde = spawn(cheminElectron, ['.', '--', ...args], { cwd: resolve(__dirname, '..'), env: envTest(), stdio: 'ignore' })
    const delai = setTimeout(() => { seconde.kill(); echoue(new Error('La seconde instance ne s’est pas fermée')) }, 20_000)
    seconde.on('error', echoue)
    seconde.on('exit', (code) => { clearTimeout(delai); termine(code) })
  })
}

// Value: protects=instance unique (ARB-117) : un second lancement se ferme, transmet ses adresses web à la première
//   instance, qui les ouvre en onglet et revient au premier plan;
//   fails_when=requestSingleInstanceLock disparaît (seconde fenêtre, seconde connexion à arbalete.db), second-instance
//   n'ouvre plus l'adresse ou ne restaure plus la fenêtre réduite, ou une adresse non web (file://) est ouverte;
//   why_new=aucun test ne lançait deux instances; seam=seconde instance lancée par child_process, la première pilotée
//   par Playwright; no_claim=ne vérifie pas que Windows passe la fenêtre au premier plan (focus du système).
test('C37 : un second lancement se ferme et ouvre ses adresses dans la première instance, restaurée', async () => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize())
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized())).toBe(true)
  const avant = await etat()

  const code = await lancerSecondeInstance([`${origine}/page-b.html?seconde-instance`, 'file:///C:/Windows/win.ini'])
  expect(code).toBe(0)

  await expect.poll(async () => (await etat()).tabs.length).toBe(avant.tabs.length + 1)
  const apres = await etat()
  expect(ongletActif(apres)?.url).toBe(`${origine}/page-b.html?seconde-instance`)
  expect(apres.tabs.some((onglet) => onglet.url.startsWith('file:'))).toBe(false)
  const fenetres = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((fenetre) => ({ reduite: fenetre.isMinimized(), visible: fenetre.isVisible() })))
  expect(fenetres).toEqual([{ reduite: false, visible: true }])
})

// Value: protects=profil de données séparé des tests (ARB-118) : l'app lancée par Playwright écrit sa base dans un
//   dossier temporaire, jamais dans le profil de l'utilisateur, et son verrou d'instance unique ne bute pas sur un
//   Arbalète déjà ouvert;
//   fails_when=ARBALETE_PROFIL_TEST n'est plus lu, ou l'est après requestSingleInstanceLock ou l'ouverture de la base;
//   why_new=les tests ouvraient la vraie arbalete.db, qu'ARB-44/45 vont lire et écrire; seam=chemin userData lu dans
//   le processus principal et fichier de base sur disque; no_claim=ne vérifie pas que l'app empaquetée ignore la
//   variable (pas d'empaquetage avant EP-14).
test('C38 : l’app des tests utilise son propre profil de données', async () => {
  const userData = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'))
  expect(resolve(userData)).toBe(resolve(profil))
  expect(existsSync(join(profil, 'arbalete.db'))).toBe(true)
})

// Value: protects=verrou d'instance unique propre au profil (ARB-118) : test:smoke tourne même si Arbalète est déjà
//   ouvert sur le profil de l'utilisateur;
//   fails_when=app.setPath('userData') passe après requestSingleInstanceLock : le verrou reste celui du profil par
//   défaut, partagé par toutes les instances, et la seconde se ferme aussitôt;
//   why_new=C38 voit le bon dossier userData même quand le verrou est pris sur l'ancien; seam=seconde instance lancée
//   par child_process avec un autre profil temporaire; no_claim=ne lance pas l'Arbalète de l'utilisateur.
test('C39 : une instance lancée sur un autre profil démarre au lieu de se fermer', async () => {
  const autreProfil = mkdtempSync(join(tmpdir(), 'arbalete-test-'))
  const cheminElectron = require('electron') as string
  const autre = spawn(cheminElectron, ['.'], { cwd: resolve(__dirname, '..'), env: envTest(autreProfil), stdio: 'ignore' })
  try {
    // Une instance qui n'obtient pas le verrou se ferme en quelques centaines de millisecondes (C37).
    await expect.poll(() => existsSync(join(autreProfil, 'arbalete.db')), { timeout: 15_000 }).toBe(true)
    expect(autre.exitCode).toBeNull()
  } finally {
    if (autre.exitCode === null) {
      const fermee = new Promise((done) => autre.once('exit', done))
      autre.kill()
      await fermee
    }
    rmSync(autreProfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

// Session des onglets telle qu'écrite sur disque (ARB-44), lue hors de l'app : une base absente, vide ou pas encore
// migrée (l'app vient de créer le fichier) donne [], pour que expect.poll réessaie au lieu d'échouer.
function sessionSurDisque(dossier: string): Array<{ url: string, titre: string, actif: number }> {
  const chemin = join(dossier, 'arbalete.db')
  if (!existsSync(chemin)) return []
  // timeout : l'app écrit la session en parallèle ; sans délai d'attente, SQLite répond « database is locked » (ARB-129).
  const db = new DatabaseSync(chemin, { readOnly: true, timeout: 3_000 })
  try {
    return db.prepare('SELECT url, titre, actif FROM onglet ORDER BY position').all() as Array<{ url: string, titre: string, actif: number }>
  } catch (erreur) {
    if (/no such table/.test(String(erreur))) return []
    throw erreur
  } finally {
    db.close()
  }
}

// Value: protects=sauvegarde de la session d'ARB-44 : les onglets ouverts, leur ordre et l'onglet actif sont écrits sur
//   disque peu après chaque changement, l'app restant ouverte, et le dernier état l'est à la fermeture;
//   fails_when=broadcastState ne demande plus l'écriture, l'écriture n'est jamais déclenchée, ou la fermeture n'écrit
//   pas un changement fait moins d'une seconde avant;
//   why_new=ARB-45 restaurera ce que cette sauvegarde écrit; seam=fichier arbalete.db lu par node:sqlite hors de l'app,
//   app lancée sur son propre profil pour pouvoir la fermer; no_claim=ne vérifie pas la restauration (ARB-45) ni
//   l'écriture après un arrêt forcé (ARB-46).
test('C40 : la session des onglets est écrite après chaque changement et à la fermeture', async () => {
  const autreProfil = mkdtempSync(join(tmpdir(), 'arbalete-test-'))
  const autreApp = await electron.launch({ args: ['.'], cwd: resolve(__dirname, '..'), env: envTest(autreProfil) })
  try {
    const fenetre = await fenetreInterface(autreApp)
    const pageA = `${origine}/page-a.html`
    await fenetre.evaluate((url) => window.arbalete.createTab(url), pageA)
    // Écriture différée : la session arrive sur disque, titre compris, sans fermer l'app.
    await expect.poll(() => sessionSurDisque(autreProfil).at(-1), { timeout: 10_000 })
      .toEqual({ url: pageA, titre: 'Page A', actif: 1 })
    expect(sessionSurDisque(autreProfil)).toHaveLength(2)

    // Changement juste avant la fermeture, bien avant la fin du délai d'une seconde : seule la fermeture l'écrit.
    const { tabs } = await fenetre.evaluate(() => window.arbalete.getState())
    await fenetre.evaluate((id) => window.arbalete.activateTab(id), tabs[0].id)
    await autreApp.close()
    expect(sessionSurDisque(autreProfil).map((onglet) => onglet.actif)).toEqual([1, 0])
  } finally {
    await autreApp.close()
    rmSync(autreProfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

// État des onglets d'une fenêtre d'interface, réduit à ce que la session conserve.
async function ongletsDe(fenetre: Page) {
  const etatFenetre = await fenetre.evaluate(() => window.arbalete.getState())
  return etatFenetre.tabs.map((tab) => ({ url: tab.url, title: tab.title, actif: tab.id === etatFenetre.activeTabId }))
}

// Value: protects=restauration de la session d'ARB-45 : au redémarrage, les mêmes onglets reviennent dans le même
//   ordre, avec le même onglet actif et le titre enregistré, et un onglet inactif ne charge sa page qu'une fois affiché;
//   fails_when=la session n'est plus relue au démarrage, l'onglet actif n'est pas rétabli, ou tous les onglets
//   chargent leur page au démarrage;
//   why_new=C40 prouve l'écriture, pas la relecture; seam=deux lancements successifs sur un même profil temporaire,
//   requêtes comptées par le serveur de test; no_claim=ne couvre pas la proposition de restaurer après un plantage
//   (ARB-46).
// Rouvrir les onglets restaurés n'ajoute pas de visite à l'historique (ARB-51).
test('C41 : au redémarrage, les onglets reviennent et un onglet inactif ne charge qu’une fois affiché', async () => {
  const autreProfil = mkdtempSync(join(tmpdir(), 'arbalete-test-'))
  const pageA = `${origine}/page-a.html`
  const pageB = `${origine}/page-b.html`
  const lancer = (args: string[] = []) =>
    electron.launch({ args: ['.', ...args], cwd: resolve(__dirname, '..'), env: envTest(autreProfil) })
  let autreApp = await lancer(['--', pageA, pageB])
  try {
    let fenetre = await fenetreInterface(autreApp)
    await expect.poll(async () => (await ongletsDe(fenetre)).map((onglet) => onglet.title), { timeout: 10_000 })
      .toEqual(['Page A', 'Page B'])
    const premier = await fenetre.evaluate(() => window.arbalete.getState())
    await fenetre.evaluate((id) => window.arbalete.activateTab(id), premier.tabs[0].id)
    await autreApp.close()
    expect(pageDeLHistorique(autreProfil, pageA)?.visites).toBe(1)
    expect(pageDeLHistorique(autreProfil, pageB)?.visites).toBe(1)

    const requetesA = requetes['/page-a.html'] ?? 0
    const requetesB = requetes['/page-b.html'] ?? 0
    autreApp = await lancer()
    fenetre = await fenetreInterface(autreApp)
    await expect.poll(() => ongletsDe(fenetre), { timeout: 10_000 }).toEqual([
      { url: pageA, title: 'Page A', actif: true },
      { url: pageB, title: 'Page B', actif: false }
    ])
    // L'onglet actif a rechargé sa page ; l'onglet inactif, jamais affiché, pas encore.
    await expect.poll(() => requetes['/page-a.html'] ?? 0).toBe(requetesA + 1)
    expect(requetes['/page-b.html'] ?? 0).toBe(requetesB)

    const restaure = await fenetre.evaluate(() => window.arbalete.getState())
    await fenetre.evaluate((id) => window.arbalete.activateTab(id), restaure.tabs[1].id)
    await expect.poll(() => requetes['/page-b.html'] ?? 0).toBe(requetesB + 1)
    await expect.poll(async () => (await fenetre.evaluate(() => window.arbalete.getState())).tabs[1].isLoading).toBe(false)
    expect(pageDeLHistorique(autreProfil, pageA)?.visites).toBe(1)
    expect(pageDeLHistorique(autreProfil, pageB)?.visites).toBe(1)
  } finally {
    await autreApp.close()
    rmSync(autreProfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

// Value: protects=invite d'ARB-46 : après un arrêt forcé, la session interrompue n'est pas rouverte d'office ni
//   écrasée, une invite propose de la restaurer ; Restaurer rouvre ses onglets à la place de l'onglet de démarrage,
//   Ignorer la remplace par la session ouverte, et une fermeture normale n'appelle plus d'invite;
//   fails_when=l'arrêt forcé n'est pas détecté, la session interrompue est écrasée avant la réponse, une réponse
//   ne rouvre ou n'écarte rien, ou la note d'ouverture survit à la fermeture normale;
//   why_new=C41 ne couvre que la fermeture normale; seam=processus principal tué entre deux lancements sur un même
//   profil temporaire, bandeau cliqué dans la fenêtre; no_claim=ne simule pas une coupure de courant pendant
//   l'écriture (SQLite en garantit l'atomicité).
test('C42 : après un arrêt forcé, une invite propose de restaurer la session interrompue', async () => {
  const autreProfil = mkdtempSync(join(tmpdir(), 'arbalete-test-'))
  const pageA = `${origine}/page-a.html`
  const pageB = `${origine}/page-b.html`
  // Windows libère le verrou du profil un instant après la fin des processus : un lancement trop rapide se ferme
  // comme une seconde instance (ECONNRESET). On réessaie, le profil restant celui du test (ARB-129).
  const lancer = async (args: string[] = []) => {
    for (let essai = 1; ; essai++) {
      try {
        return await electron.launch({ args: ['.', ...args], cwd: resolve(__dirname, '..'), env: envTest(autreProfil) })
      } catch (erreur) {
        if (essai === 5) throw erreur
        await new Promise((fini) => setTimeout(fini, 1_000))
      }
    }
  }
  // Fin de tâche de l'arborescence, comme le Gestionnaire des tâches : les processus enfants d'Electron tenus par un
  // processus principal tué garderaient sinon le verrou d'instance unique, et le lancement suivant se fermerait.
  const arreterDeForce = async (electronApp: ElectronApplication) => {
    const processus = electronApp.process()
    const fin = new Promise((done) => processus.once('exit', done))
    spawnSync('taskkill', ['/pid', String(processus.pid), '/t', '/f'], { stdio: 'ignore' })
    await fin
    // Sous charge, Windows garde des fichiers du profil ouverts quelques secondes après la fin des processus : la base
    // s'ouvrirait alors en « disk I/O error » et l'invite n'apparaîtrait pas (ARB-129). Un dossier ne se renomme que
    // lorsque plus aucun de ses fichiers n'est tenu.
    const provisoire = `${autreProfil}-libre`
    await expect.poll(() => {
      try {
        renameSync(autreProfil, provisoire)
        renameSync(provisoire, autreProfil)
        return true
      } catch {
        return false
      }
    }, { timeout: 20_000 }).toBe(true)
  }
  const offre = (fenetre: Page) => fenetre.evaluate(() => window.arbalete.getRestoreOffer())
  let autreApp = await lancer(['--', pageA, pageB])
  try {
    await expect.poll(() => sessionSurDisque(autreProfil), { timeout: 10_000 }).toEqual([
      { url: pageA, titre: 'Page A', actif: 0 },
      { url: pageB, titre: 'Page B', actif: 1 }
    ])
    await arreterDeForce(autreApp)

    // Après l'arrêt forcé : un onglet de démarrage, l'invite, et la session interrompue intacte sur disque.
    autreApp = await lancer()
    let fenetre = await fenetreInterface(autreApp)
    await expect.poll(() => offre(fenetre), { timeout: 10_000 }).toBe(true)
    await expect(fenetre.getByTestId('restore-banner')).toBeVisible()
    expect(await ongletsDe(fenetre)).toHaveLength(1)
    // Au-delà de l'écriture différée (1 s) : rien n'a remplacé la session interrompue.
    await fenetre.waitForTimeout(2_500)
    expect(sessionSurDisque(autreProfil).map((onglet) => onglet.url)).toEqual([pageA, pageB])

    await fenetre.getByRole('button', { name: 'Restaurer' }).click()
    await expect.poll(() => ongletsDe(fenetre), { timeout: 10_000 }).toEqual([
      { url: pageA, title: 'Page A', actif: false },
      { url: pageB, title: 'Page B', actif: true }
    ])
    await expect(fenetre.getByTestId('restore-banner')).toHaveCount(0)
    expect(await offre(fenetre)).toBe(false)
    await arreterDeForce(autreApp)

    // Nouvel arrêt forcé, invite ignorée : la session ouverte (l'onglet de démarrage) remplace l'interrompue.
    autreApp = await lancer()
    fenetre = await fenetreInterface(autreApp)
    await expect.poll(() => offre(fenetre), { timeout: 10_000 }).toBe(true)
    await fenetre.getByRole('button', { name: 'Ignorer' }).click()
    await expect(fenetre.getByTestId('restore-banner')).toHaveCount(0)
    expect(await ongletsDe(fenetre)).toHaveLength(1)
    await expect.poll(() => sessionSurDisque(autreProfil).filter((onglet) => onglet.url.startsWith(origine)), { timeout: 10_000 })
      .toEqual([])
    expect(sessionSurDisque(autreProfil)).toHaveLength(1)
    await autreApp.close()

    // Fermeture normale : pas d'invite au démarrage suivant.
    autreApp = await lancer()
    fenetre = await fenetreInterface(autreApp)
    await expect.poll(async () => (await ongletsDe(fenetre)).length, { timeout: 10_000 }).toBe(1)
    expect(await offre(fenetre)).toBe(false)
    await expect(fenetre.getByTestId('restore-banner')).toHaveCount(0)
  } finally {
    await autreApp.close().catch(() => {})
    rmSync(autreProfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

// Value: protects=ARB-119 : une base illisible est mise de côté sous un nom daté, intacte, remplacée par une base neuve
//   où la session s'écrit, et l'utilisateur en est prévenu jusqu'à ce qu'il ferme l'avertissement;
//   fails_when=l'app démarre sans persistance ni avertissement, la base illisible est écrasée ou supprimée, ou la base
//   neuve n'est pas créée;
//   why_new=seule la console signalait une base illisible; seam=fichier arbalete.db non SQLite déposé dans un profil
//   temporaire avant le lancement; no_claim=les pages abîmées d'une base lisible sont couvertes par les tests unitaires.
test('C43 : une base illisible est mise de côté, remplacée, et l’utilisateur est prévenu', async () => {
  const autreProfil = mkdtempSync(join(tmpdir(), 'arbalete-test-'))
  const contenu = Buffer.from('pas une base SQLite '.repeat(10))
  writeFileSync(join(autreProfil, 'arbalete.db'), contenu)
  const autreApp = await electron.launch({ args: ['.'], cwd: resolve(__dirname, '..'), env: envTest(autreProfil) })
  try {
    const fenetre = await fenetreInterface(autreApp)
    const incident = await fenetre.evaluate(() => window.arbalete.getDataIncident())
    expect(incident).toMatchObject({ kind: 'corrupted', backup: expect.stringMatching(/^arbalete\.db\.corrompue-[\dT.Z-]+$/) })
    const copie = (incident as { backup: string }).backup
    expect(readFileSync(join(autreProfil, copie))).toEqual(contenu)
    await expect(fenetre.getByTestId('data-incident-banner')).toContainText(copie)
    // La base neuve reçoit la session.
    await expect.poll(() => sessionSurDisque(autreProfil).length, { timeout: 10_000 }).toBe(1)

    await fenetre.getByTestId('data-incident-banner').getByRole('button', { name: 'Fermer' }).click()
    await expect(fenetre.getByTestId('data-incident-banner')).toHaveCount(0)
    expect(await fenetre.evaluate(() => window.arbalete.getDataIncident())).toBeNull()
  } finally {
    await autreApp.close()
    rmSync(autreProfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

// Value: protects=ARB-131 : une base corrompue est remplacée par la dernière copie de secours, qui rend la session, et
//   l'utilisateur est prévenu que des changements récents ont pu être perdus; la base abîmée reste de côté;
//   fails_when=l'app repart d'une base vide malgré une copie saine, la copie n'est pas écrite à la fermeture normale, ou
//   l'avertissement annonce des données neuves;
//   why_new=C43 part d'un profil sans copie de secours; seam=fermeture normale d'une première instance, puis arbalete.db
//   remplacé par du texte avant le second lancement; no_claim=ne simule pas une corruption partielle de pages.
test('C52 : une base corrompue revient de la copie de secours, session comprise', async () => {
  const autreProfil = mkdtempSync(join(tmpdir(), 'arbalete-test-'))
  const pageA = `${origine}/page-a.html`
  const lancer = (args: string[] = []) =>
    electron.launch({ args: ['.', ...args], cwd: resolve(__dirname, '..'), env: envTest(autreProfil) })
  let autreApp = await lancer(['--', pageA])
  try {
    await expect.poll(() => sessionSurDisque(autreProfil).map((onglet) => onglet.url), { timeout: 10_000 }).toEqual([pageA])
    await autreApp.close()
    expect(existsSync(join(autreProfil, 'arbalete.db.sauvegarde'))).toBe(true)

    writeFileSync(join(autreProfil, 'arbalete.db'), Buffer.from('pas une base SQLite '.repeat(10)))
    rmSync(join(autreProfil, 'arbalete.db-wal'), { force: true })
    rmSync(join(autreProfil, 'arbalete.db-shm'), { force: true })
    autreApp = await lancer()
    const fenetre = await fenetreInterface(autreApp)
    const incident = await fenetre.evaluate(() => window.arbalete.getDataIncident())
    expect(incident).toMatchObject({ kind: 'corrupted', restored: true })
    await expect(fenetre.getByTestId('data-incident-banner')).toContainText('copie de secours')
    await expect.poll(async () => (await ongletsDe(fenetre)).map((onglet) => onglet.url), { timeout: 10_000 }).toEqual([pageA])
  } finally {
    await autreApp.close().catch(() => {})
    rmSync(autreProfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

// Value: protects=ARB-119 : une base d'une version plus récente n'est ni renommée ni modifiée, et l'utilisateur est
//   prévenu que rien ne sera conservé;
//   fails_when=une base plus récente est prise pour illisible et mise de côté, modifiée, ou ignorée sans avertissement;
//   why_new=C43 couvre la base illisible, pas la base plus récente qu'il ne faut pas toucher; seam=base au user_version
//   futur créée dans un profil temporaire avant le lancement; no_claim=ne couvre pas une base verrouillée.
test('C44 : une base plus récente reste intacte et l’utilisateur est prévenu', async () => {
  const autreProfil = mkdtempSync(join(tmpdir(), 'arbalete-test-'))
  const chemin = join(autreProfil, 'arbalete.db')
  const future = new DatabaseSync(chemin)
  future.exec('PRAGMA user_version = 999')
  future.close()
  const avant = readFileSync(chemin)
  const autreApp = await electron.launch({ args: ['.'], cwd: resolve(__dirname, '..'), env: envTest(autreProfil) })
  try {
    const fenetre = await fenetreInterface(autreApp)
    expect(await fenetre.evaluate(() => window.arbalete.getDataIncident())).toEqual({ kind: 'newer' })
    await expect(fenetre.getByTestId('data-incident-banner')).toContainText('plus récente')
    await autreApp.close()
    expect(readFileSync(chemin)).toEqual(avant)
    expect(readdirSync(autreProfil).filter((nom) => nom.startsWith('arbalete.db'))).toEqual(['arbalete.db'])
  } finally {
    await autreApp.close()
    rmSync(autreProfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

// Page de l'historique (ARB-51) telle qu'écrite sur disque, lue hors de l'app ; undefined si elle n'y est pas encore.
function pageDeLHistorique(dossier: string, url: string): { titre: string, visites: number, dates: number } | undefined {
  const db = new DatabaseSync(join(dossier, 'arbalete.db'), { readOnly: true })
  try {
    return db.prepare(`SELECT titre, visites, (SELECT count(*) FROM visite WHERE visite.page = page.id) AS dates
      FROM page WHERE url = ?`).get(url) as { titre: string, visites: number, dates: number } | undefined
  } finally {
    db.close()
  }
}

// Value: protects=ARB-51 : chaque navigation de l'onglet vers une autre page est enregistrée dans l'historique, avec son
//   titre et une visite datée, que la page la quitte par un lien, par history.pushState ou l'utilisateur par la barre
//   d'adresse;
//   fails_when=did-navigate n'enregistre plus de visite, le titre reste vide, ou un rechargement, un changement de
//   fragment, une adresse injoignable compte comme une visite;
//   why_new=aucun test ne lisait l'historique; seam=fichier arbalete.db du profil de test lu par node:sqlite hors de
//   l'app, en lecture seule pendant qu'elle tourne; no_claim=ne vérifie pas la restauration d'un onglet (tests
//   unitaires et revue), ni les redirections.
test('C46 : chaque navigation est enregistrée dans l’historique, un rechargement ou une ancre non', async () => {
  const pageA = `${origine}/page-a.html`
  const pageB = `${origine}/page-b.html`
  const visitesAvant = (url: string) => pageDeLHistorique(profil, url)?.visites ?? 0
  const avantA = visitesAvant(pageA)
  const avantB = visitesAvant(pageB)

  await ui.evaluate((url) => window.arbalete.createTab(url), pageA)
  await expect.poll(() => pageDeLHistorique(profil, pageA)).toEqual({ titre: 'Page A', visites: avantA + 1, dates: avantA + 1 })

  // Lien suivi par la page, puis rechargement et ancre dans la même page : une seule visite de page-b.
  await dansOngletActif("document.getElementById('suivante').click()")
  await attendreUrlActive(pageB)
  await expect.poll(() => pageDeLHistorique(profil, pageB)).toEqual({ titre: 'Page B', visites: avantB + 1, dates: avantB + 1 })
  const requetesB = requetes['/page-b.html'] ?? 0
  await ui.evaluate(() => window.arbalete.reload())
  await expect.poll(() => requetes['/page-b.html'] ?? 0).toBeGreaterThan(requetesB)
  await dansOngletActif("location.hash = 'ancre'")
  await attendreUrlActive(`${pageB}#ancre`)
  // Une autre adresse dans le même document (application d'une seule page) est une visite.
  const pageC = `${origine}/page-c.html`
  const avantC = visitesAvant(pageC)
  await dansOngletActif("history.pushState(null, '', '/page-c.html')")
  await attendreUrlActive(pageC)
  await expect.poll(() => visitesAvant(pageC)).toBe(avantC + 1)

  // Retour sur page-a par la barre d'adresse : deuxième visite de page-a.
  await saisirAdresse(pageA)
  await expect.poll(() => visitesAvant(pageA)).toBe(avantA + 2)
  expect(pageDeLHistorique(profil, pageB)?.visites).toBe(avantB + 1)
  expect(pageDeLHistorique(profil, `${pageB}#ancre`)).toBeUndefined()

  // Une adresse injoignable n'est pas une visite : le chargement échoue sans navigation, et le titre de la page
  // précédente reste le sien.
  const titreA = pageDeLHistorique(profil, pageA)?.titre
  expect(titreA).toBeTruthy()
  await saisirAdresse('http://127.0.0.1:1/')
  await attendreUrlActive('http://127.0.0.1:1/')
  await expect.poll(async () => ongletActif(await etat())?.isLoading).toBe(false)
  expect(pageDeLHistorique(profil, 'http://127.0.0.1:1/')).toBeUndefined()
  expect(pageDeLHistorique(profil, pageA)?.titre).toBe(titreA)
})

// Value: protects=l'état Error de l'onglet après un échec de chargement, effacé par la navigation suivante (ARB-124);
// fails_when=error n'est pas posé sur une adresse injoignable, ou survit à une page qui charge; why_new=C46 ne regarde
// que l'historique; seam=none; no_claim=ni le rendu de l'icône ni la couleur.
test('C49 : un échec de chargement met l’onglet en erreur, la navigation suivante l’efface', async () => {
  await epinglerBarre(true)
  await saisirAdresse('http://127.0.0.1:1/')
  await expect.poll(async () => ongletActif(await etat())?.error).toBe(true)
  await expect(barreUi.locator('.tab-item--error')).toHaveCount(1)

  await saisirAdresse(`${origine}/page-a.html`)
  await attendreUrlActive(`${origine}/page-a.html`)
  await expect.poll(async () => ongletActif(await etat())?.error).toBeFalsy()
  await expect(barreUi.locator('.tab-item--error')).toHaveCount(0)
  await epinglerBarre(false)
})

// Value: protects=favicon des onglets (ARB-35) et CSP de l'interface (ARB-106) : l'icône du site s'affiche sous img-src sans
//   violation, une page sans icône garde l'icône générique, la CSP n'élargit ni script-src ni style-src;
//   fails_when=page-favicon-updated n'est plus écouté, le favicon d'une page survit à la navigation, ou img-src bloque l'image;
//   why_new=C13 et C48 ne regardent ni les images ni les favicons; seam=none (favicon data: servi par le test);
//   no_claim=ne charge aucun favicon https réel (réseau), ne couvre pas les balises <style> injectées par une bibliothèque;
//   la directive img-src est épinglée dans le <meta> CSP (https: n'est exercé que par ce contrôle, pas par un chargement).
test('C50 : l’onglet affiche le favicon du site sans violation de la CSP, et le perd à la navigation', async () => {
  await epinglerBarre(true)
  await barreUi.evaluate(() => {
    const w = window as unknown as { __violationsCsp: string[] }
    w.__violationsCsp = []
    document.addEventListener('securitypolicyviolation', (e) => w.__violationsCsp.push(e.violatedDirective))
  })
  await saisirAdresse(`${origine}/page-icone.html`)
  await attendreUrlActive(`${origine}/page-icone.html`)
  await expect.poll(async () => ongletActif(await etat())?.favicon).toMatch(/^data:image\/png/)
  const image = barreUi.locator('.tab-item--active .tab-favicon-img')
  await expect(image).toHaveCount(1)
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1)

  // Un changement de fragment ne change pas de document : le favicon reste.
  await saisirAdresse(`${origine}/page-icone.html#ancre`)
  await attendreUrlActive(`${origine}/page-icone.html#ancre`)
  expect(ongletActif(await etat())?.favicon).toMatch(/^data:image\/png/)

  await saisirAdresse(`${origine}/page-b.html`)
  await attendreUrlActive(`${origine}/page-b.html`)
  await expect.poll(async () => ongletActif(await etat())?.favicon).toBeUndefined()
  await expect(barreUi.locator('.tab-item--active .tab-favicon-img')).toHaveCount(0)

  const csp = await barreUi.evaluate(() => document.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]')?.content ?? '')
  expect(csp).toMatch(/img-src 'self' data: https:(;|$)/)
  expect(csp).toMatch(/script-src 'self'(;|$)/)
  expect(csp).toMatch(/style-src 'self'(;|$)/)

  expect(await barreUi.evaluate(() => (window as unknown as { __violationsCsp: string[] }).__violationsCsp)).toEqual([])
  await epinglerBarre(false)
})

// Value: protects=bornage de browser:set-content-bounds (ARB-104) : un rectangle aberrant venu de l'interface ne fait ni
//   lever le processus principal ni sortir la vue de la fenêtre; fails_when=1e300 ou une valeur négative atteint setBounds
//   (vue hors fenêtre) ou fait lever le listener, et la vue ne revient plus à la zone de contenu après un rectangle valide;
//   why_new=C12 et C14 n'envoient que des rectangles valides ou refusés en amont; seam=none;
//   no_claim=ne couvre pas le texte du message d'erreur ni un rectangle NaN (borné par les tests unitaires).
test('C54 : un rectangle aberrant reçu par set-content-bounds est borné à la fenêtre', async () => {
  const zone = await rectangleZoneContenu()
  const fenetre = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentBounds())
  try {
    await ui.evaluate(() => window.arbalete.setContentBounds({ x: -50, y: 48, width: 1e300, height: 1e300 }))
    await expect.poll(boundsVueActive).toEqual({ x: 0, y: 48, width: fenetre.width, height: fenetre.height - 48 })
    expect(await ui.evaluate(() => window.arbalete.getState().then((etat) => etat.tabs.length))).toBeGreaterThan(0)
  } finally {
    await ui.evaluate((rectangle) => window.arbalete.setContentBounds(rectangle), zone)
  }
  await attendreVueAlignee()
})

// Value: protects=persistance du thème d'ARB-59 : le thème choisi est écrit en base dès le choix et revient au
//   redémarrage, dans la fenêtre, dans la barre et sur le fond natif posé avant le rendu;
//   fails_when=set-theme n'écrit plus en base, le thème n'est pas relu avant createWindow, ou la valeur relue ne
//   passe plus par themeEffectif();
//   why_new=C35 prouve le choix dans une session, pas son maintien; seam=deux lancements successifs sur un même profil
//   temporaire; no_claim=ne couvre pas une valeur illisible en base (tests unitaires de preferences.test.ts) ni le
//   thème système de Windows.
test('C56 : le thème choisi revient au redémarrage', async () => {
  const autreProfil = mkdtempSync(join(tmpdir(), 'arbalete-test-'))
  const lancer = () => electron.launch({ args: ['.'], cwd: resolve(__dirname, '..'), env: envTest(autreProfil) })
  let autreApp = await lancer()
  try {
    let fenetre = await fenetreInterface(autreApp)
    expect(await fenetre.evaluate(() => window.arbalete.getTheme())).toBe('system')
    await fenetre.evaluate(() => window.arbalete.setTheme('dark'))
    await autreApp.close()

    autreApp = await lancer()
    fenetre = await fenetreInterface(autreApp)
    expect(await fenetre.evaluate(() => window.arbalete.getTheme())).toBe('dark')
    await expect(fenetre.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await autreApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBackgroundColor().toLowerCase()))
      .toBe('#111820')
    expect(await (await vueBarre(autreApp)).evaluate(() => window.arbalete.getTheme())).toBe('dark')
  } finally {
    await autreApp.close()
    rmSync(autreProfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

// Value: protects=ARB-123 : la barre épinglée passe de étendue (largeur bornée à 200-400 px) à compacte (68 px), la
//   page suit chaque mode, et mode et largeur reviennent au redémarrage, la barre rouverte à sa taille;
//   fails_when=toggle-compact ne change plus la largeur de la vue ou de la réserve, la largeur n'est plus bornée côté
//   processus principal, ou le mode n'est pas écrit en base ni relu avant createWindow;
//   why_new=C9 ne couvre que étendue/masquée; seam=deux lancements successifs sur un même profil temporaire;
//   no_claim=ne couvre pas le glissement de la poignée (pointeur), les infobulles ni le rendu des icônes; la vue web
//   est mesurée à 252, 68 et 300 px (x = 8 + largeur de la barre).
test('C59 : barre latérale étendue, compacte, largeur réglable et conservée au redémarrage', async () => {
  const autreProfil = mkdtempSync(join(tmpdir(), 'arbalete-test-'))
  const lancer = () => electron.launch({ args: ['.'], cwd: resolve(__dirname, '..'), env: envTest(autreProfil) })
  const largeurVue = (a: ElectronApplication) => a.evaluate(({ BrowserWindow, WebContentsView }) => BrowserWindow.getAllWindows()[0].contentView.children
    .find((enfant) => enfant instanceof WebContentsView && enfant.webContents.getURL().includes('vue=barre'))?.getBounds().width)
  // Bord gauche de la vue web de l'onglet actif : marge de 8 px (ARB-32) après la barre épinglée.
  const xPage = (a: ElectronApplication) => a.evaluate(({ BrowserWindow, WebContentsView }) => BrowserWindow.getAllWindows()[0].contentView.children
    .find((enfant) => enfant instanceof WebContentsView && !enfant.webContents.getURL().includes('vue=barre'))?.getBounds().x)
  let autreApp = await lancer()
  try {
    let fenetre = await fenetreInterface(autreApp)
    const barre = () => fenetre.evaluate(() => window.arbalete.getSidebar())
    expect(await barre()).toEqual({ open: false, pinned: false, compact: false, width: 252 })

    await fenetre.evaluate(() => window.arbalete.setSidebar('toggle-compact'))
    expect((await barre()).compact).toBe(false) // masquée : sans effet
    await fenetre.evaluate(() => window.arbalete.setSidebar('toggle-pin'))
    await expect.poll(() => largeurVue(autreApp)).toBe(252)
    await expect.poll(() => xPage(autreApp)).toBe(260)

    await fenetre.evaluate(() => window.arbalete.setSidebar('toggle-compact'))
    await expect.poll(() => largeurVue(autreApp)).toBe(68)
    await expect.poll(() => xPage(autreApp)).toBe(76)
    await expect.poll(() => fenetre.locator('.sidebar-reserve').evaluate((el) => el.getBoundingClientRect().width)).toBe(68)

    for (const [demande, obtenu] of [[300, 300], [10, 200], [1e9, 400], [250.6, 251]]) {
      await fenetre.evaluate((largeur) => window.arbalete.setSidebarWidth(largeur), demande)
      expect((await barre()).width).toBe(obtenu)
    }
    await expect(fenetre.evaluate(() => window.arbalete.setSidebarWidth('large' as never))).rejects.toThrow()
    await fenetre.evaluate(() => window.arbalete.setSidebarWidth(300))
    await autreApp.close()

    autreApp = await lancer()
    fenetre = await fenetreInterface(autreApp)
    expect(await barre()).toEqual({ open: true, pinned: true, compact: true, width: 300 })
    await expect.poll(() => largeurVue(autreApp)).toBe(68)
    await expect.poll(() => xPage(autreApp)).toBe(76)
    await fenetre.evaluate(() => window.arbalete.setSidebar('toggle-compact'))
    await expect.poll(() => largeurVue(autreApp)).toBe(300)
    await expect.poll(() => xPage(autreApp)).toBe(308)
  } finally {
    await autreApp.close()
    rmSync(autreProfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

// Value: protects=ARB-37 : fermer l'onglet actif active son voisin de droite, et le précédent s'il était le dernier;
//   fails_when=closeTab rend l'onglet actif au dernier de la liste (ancien comportement), ou ne rend aucun onglet actif;
//   why_new=C36 ferme par Ctrl+W mais ne vérifie pas quel onglet devient actif; seam=none (getState, activateTab et
//   closeTab de l'IPC); no_claim=ne couvre pas l'ordre de la liste affichée, tenu par voisin.test.ts.
test('C57 : fermer l\'onglet actif active son voisin', async () => {
  const ids: string[] = []
  for (const page of ['page-a.html', 'page-b.html', 'page-a.html', 'page-b.html']) {
    ids.push(await ui.evaluate((url) => window.arbalete.createTab(url), `${origine}/${page}`))
  }
  const actif = () => ui.evaluate(() => window.arbalete.getState().then((etat) => etat.activeTabId))
  await ui.evaluate((id) => window.arbalete.activateTab(id), ids[1])
  await ui.evaluate((id) => window.arbalete.closeTab(id), ids[1])
  await expect.poll(actif).toBe(ids[2])
  await ui.evaluate((id) => window.arbalete.closeTab(id), ids[3])
  await ui.evaluate((id) => window.arbalete.activateTab(id), ids[2])
  await ui.evaluate((id) => window.arbalete.closeTab(id), ids[2])
  await expect.poll(actif).toBe(ids[0])
  await ui.evaluate((id) => window.arbalete.closeTab(id), ids[0])
})

// Value: protects=ARB-112 et ARB-113 : une barre rechargée en arrière-plan ne rend pas le focus à la page (qui
//   ramènerait la fenêtre au premier plan), le rend une fois la fenêtre revenue, et n'empile pas d'écouteurs;
//   fails_when=did-finish-load appelle focus() sans regarder isFocused, ne s'exécute plus qu'une fois (once), ou
//   ajoute un écouteur 'focus' par rechargement; why_new=C31 ne couvre que le premier chargement, fenêtre active;
//   seam=isFocused de la fenêtre remplacé par un faux, Windows ne laissant pas Playwright quitter le premier plan;
//   no_claim=ne prouve pas que Windows ramène la fenêtre au premier plan sans le correctif.
test('C58 : la barre rechargée en arrière-plan rend le focus à la page au retour de la fenêtre, sans empiler d\'écouteurs', async () => {
  const pageFocalisee = () => app.evaluate(({ BrowserWindow, WebContentsView }) => BrowserWindow.getAllWindows()[0].contentView.children
    .some((enfant) => enfant instanceof WebContentsView && /^https?:/.test(enfant.webContents.getURL())
      && enfant.webContents.isFocused()))
  const ecouteurs = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].listenerCount('focus'))
  const avant = await ecouteurs()
  await app.evaluate(({ BrowserWindow }) => {
    const fenetre = BrowserWindow.getAllWindows()[0]
    ;(fenetre as unknown as { isFocused: () => boolean }).isFocused = () => false
  })
  try {
    for (let i = 0; i < 3; i++) {
      await app.evaluate(({ BrowserWindow, WebContentsView }) => {
        const barre = BrowserWindow.getAllWindows()[0].contentView.children
          .find((enfant) => enfant instanceof WebContentsView && enfant.webContents.getURL().includes('vue=barre')) as InstanceType<typeof WebContentsView>
        barre.webContents.reload()
      })
      await expect.poll(() => app.evaluate(({ BrowserWindow, WebContentsView }) => BrowserWindow.getAllWindows()[0].contentView.children
        .some((enfant) => enfant instanceof WebContentsView && enfant.webContents.getURL().includes('vue=barre')
          && !enfant.webContents.isLoading()))).toBe(true)
    }
    expect(await pageFocalisee()).toBe(false)
    expect(await ecouteurs()).toBe(avant + 1)
  } finally {
    await app.evaluate(({ BrowserWindow }) => {
      const fenetre = BrowserWindow.getAllWindows()[0] as unknown as { isFocused?: () => boolean }
      delete fenetre.isFocused
    })
  }
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit('focus'))
  await expect.poll(pageFocalisee).toBe(true)
  expect(await ecouteurs()).toBe(avant)
})

// Aperçu de l'adresse d'un lien survolé (ARB-36, décision 0003) : une petite vue native au bas de la page, au-dessous
// de la barre, retirée quand le survol cesse. La barre d'état n'existe plus.
// Vue de la bulle : la seule vue enfant dont l'adresse est un document data: (la page, elle, est http).
function bulle() {
  return app.evaluate(({ BrowserWindow, WebContentsView }) => {
    const vues = BrowserWindow.getAllWindows()[0].contentView.children as InstanceType<typeof WebContentsView>[]
    const vue = vues.find((enfant) => enfant.webContents.getURL().startsWith('data:text/html'))
    if (!vue) return null
    const { x, y, width, height } = vue.getBounds()
    return { x, y, width, height, dernier: vues.at(-1)!.webContents.getURL().includes('vue=barre') }
  })
}
function texteBulle() {
  return app.evaluate(async ({ BrowserWindow, WebContentsView }) => {
    const vue = (BrowserWindow.getAllWindows()[0].contentView.children as InstanceType<typeof WebContentsView>[])
      .find((enfant) => enfant.webContents.getURL().startsWith('data:text/html'))
    return vue ? vue.webContents.executeJavaScript("document.getElementById('t').textContent") : null
  })
}
// Survol simulé dans la page de l'onglet actif (coordonnées de la page).
function survolerPage(x: number, y: number) {
  return app.evaluate(({ BrowserWindow, WebContentsView }, { x, y }) => {
    const vue = (BrowserWindow.getAllWindows()[0].contentView.children as InstanceType<typeof WebContentsView>[])
      .find((enfant) => enfant instanceof WebContentsView && !enfant.webContents.getURL().includes('vue=barre')
        && !enfant.webContents.getURL().startsWith('data:')) as InstanceType<typeof WebContentsView>
    vue.webContents.sendInputEvent({ type: 'mouseMove', x, y })
  }, { x, y })
}
async function bulleAffichee() {
  await survolerPage(200, 150)
  await expect.poll(texteBulle).toBe(`${origine}/page-b.html?q=survol`)
}

// Value: protects=survol d'un lien -> bulle avec son adresse en bas à gauche de la page, retirée à la sortie du lien;
//   fails_when=update-target-url n'est plus écouté, la bulle recouvre la barre ou reste affichée;
//   why_new=aucun test ne touchait à une vue native sans interface; seam=none; no_claim=ne couvre pas le rendu des pixels.
test('C60 : survoler un lien affiche son adresse dans une bulle au bas de la page, retirée à la sortie', async () => {
  await saisirAdresse(`${origine}/page-survol.html`)
  await attendreUrlActive(`${origine}/page-survol.html`)
  await expect(ui.locator('.statusbar')).toHaveCount(0)

  expect(await bulle()).toBeNull()
  await bulleAffichee()
  const posee = (await bulle())!
  const zone = (await boundsVueActive())!
  expect(posee.dernier).toBe(true)
  expect(posee.x).toBeGreaterThanOrEqual(zone.x)
  expect(posee.x + posee.width).toBeLessThanOrEqual(zone.x + zone.width)
  expect(posee.y + posee.height).toBeLessThanOrEqual(zone.y + zone.height)
  expect(posee.y).toBeGreaterThan(zone.y + zone.height / 2)

  await survolerPage(600, 400)
  await expect.poll(bulle).toBeNull()
})

// Value: protects=la bulle disparaît avec la page qui portait le lien, qu'elle navigue ou que l'onglet change;
//   fails_when=did-start-navigation ou retirerApercu dans setActiveView est retiré (bulle collée sur une autre page);
//   why_new=C60 ne couvre que la sortie du lien; seam=none; no_claim=ne couvre ni un onglet inactif ni le rendu.
test('C61 : la bulle est retirée à la navigation de la page et au changement d’onglet', async () => {
  await saisirAdresse(`${origine}/page-survol.html`)
  await attendreUrlActive(`${origine}/page-survol.html`)
  await bulleAffichee()
  await dansOngletActif("location.href = '/page-b.html'")
  await expect.poll(bulle).toBeNull()

  await saisirAdresse(`${origine}/page-survol.html`)
  await attendreUrlActive(`${origine}/page-survol.html`)
  await bulleAffichee()
  const avant = (await etat()).tabs.length
  const idNouveau = await ui.evaluate((url) => window.arbalete.createTab(url), `${origine}/page-b.html`)
  await expect.poll(bulle).toBeNull()
  await ui.evaluate((id) => window.arbalete.closeTab(id), idNouveau)
  await expect.poll(async () => (await etat()).tabs.length).toBe(avant)
})

// Value: protects=la bulle suit le thème de la fenêtre et le rectangle de la page quand la barre est épinglée;
//   fails_when=dessinerApercu n'est plus appelée au changement de thème ou placerApercuVue à set-content-bounds;
//   why_new=aucun test ne regardait la bulle après un changement d'interface; seam=none; no_claim=pixels exacts.
test('C62 : la bulle suit le thème et la place de la page quand la barre est épinglée', async () => {
  await saisirAdresse(`${origine}/page-survol.html`)
  await attendreUrlActive(`${origine}/page-survol.html`)
  await bulleAffichee()
  const classe = () => app.evaluate(async ({ BrowserWindow, WebContentsView }) => {
    const vue = (BrowserWindow.getAllWindows()[0].contentView.children as InstanceType<typeof WebContentsView>[])
      .find((enfant) => enfant.webContents.getURL().startsWith('data:text/html'))
    return vue ? vue.webContents.executeJavaScript('document.body.className') : null
  })
  const themeInitial = await ui.evaluate(() => window.arbalete.getTheme())
  try {
    await ui.evaluate(() => window.arbalete.setTheme('light'))
    await expect.poll(classe).toBe('light')
    await ui.evaluate(() => window.arbalete.setTheme('dark'))
    await expect.poll(classe).toBe('dark')
  } finally {
    await ui.evaluate((choix) => window.arbalete.setTheme(choix), themeInitial)
  }

  const avantX = (await bulle())!.x
  await epinglerBarre(true)
  try {
    await attendreVueAlignee()
    const zone = (await boundsVueActive())!
    await expect.poll(async () => (await bulle())?.x).toBe(zone.x + 8)
    expect(zone.x + 8).toBeGreaterThan(avantX)
  } finally {
    await epinglerBarre(false)
  }
})

// Value: protects=la vue de la bulle est sandboxée, ne navigue pas, n'ouvre pas de fenêtre, et passe de l'autre côté
//   sous la souris; fails_when=un des gardes de creerApercu est retiré ou before-mouse-event ne bascule plus;
//   why_new=aucun test ne touchait à cette vue native (règle 1 : sandbox sur toutes les vues); seam=none;
//   no_claim=mouvement simulé par sendInputEvent, pas par la vraie souris.
test('C63 : la vue de la bulle est verrouillée et passe de côté sous la souris', async () => {
  await saisirAdresse(`${origine}/page-survol.html`)
  await attendreUrlActive(`${origine}/page-survol.html`)
  await bulleAffichee()
  const sonde = await app.evaluate(async ({ BrowserWindow, WebContentsView }) => {
    const vue = (BrowserWindow.getAllWindows()[0].contentView.children as InstanceType<typeof WebContentsView>[])
      .find((enfant) => enfant.webContents.getURL().startsWith('data:text/html'))!
    const prefs = (vue.webContents as unknown as { getLastWebPreferences: () => { sandbox: boolean, contextIsolation: boolean, nodeIntegration: boolean } }).getLastWebPreferences()
    const ouverte = await vue.webContents.executeJavaScript("window.open('https://example.com') === null")
    vue.webContents.executeJavaScript("location.href = 'https://example.com/'").catch(() => {})
    await new Promise((resolution) => setTimeout(resolution, 300))
    return { sandbox: prefs.sandbox, isolation: prefs.contextIsolation, node: prefs.nodeIntegration, ouverte,
      adresse: vue.webContents.getURL().slice(0, 15), fenetres: BrowserWindow.getAllWindows().length }
  })
  expect(sonde).toEqual({ sandbox: true, isolation: true, node: false, ouverte: true, adresse: 'data:text/html;', fenetres: 1 })

  const zone = (await boundsVueActive())!
  const gauche = (await bulle())!
  expect(gauche.x).toBe(zone.x + 8)
  const bouger = () => app.evaluate(({ BrowserWindow, WebContentsView }) => {
    const vue = (BrowserWindow.getAllWindows()[0].contentView.children as InstanceType<typeof WebContentsView>[])
      .find((enfant) => enfant.webContents.getURL().startsWith('data:text/html'))!
    vue.webContents.sendInputEvent({ type: 'mouseMove', x: 10, y: 10 })
  })
  await bouger()
  await expect.poll(async () => { const b = await bulle(); return b ? b.x + b.width : 0 }).toBe(zone.x + zone.width - 8)
  await bouger()
  await expect.poll(async () => (await bulle())?.x).toBe(zone.x + 8)
})

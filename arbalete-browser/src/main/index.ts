import { app, BrowserWindow, Menu, clipboard, dialog, WebContentsView, ipcMain, screen, session, shell, nativeTheme, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { mkdirSync, statSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import type { BrowserState, BrowserTab, DataIncident, RestoreAnswer, SidebarAction, SidebarState, SuggestionsState, ThemeChoice } from '../shared/types'
import { importerFavoris, lireFavorisHtml, TAILLE_MAX_IMPORT } from './donnees/importFavoris.ts'
import { ouvrirBaseOuRecuperer, type IncidentBase } from './donnees/base.ts'
import { estAboutBlank, retourPermis } from './aboutBlank.ts'
import { numeroDOnglet, ongletNumero, ongletRelatif, pasDOnglet, rechargement } from './navigationClavier.ts'
import { ongletVoisin } from './voisin.ts'
import { depiler, empiler } from './ongletsFermes.ts'
import { borner } from './bornes.ts'
import { palierZoom, sensDuZoom, type SensZoom } from './zoom.ts'
import { ecrireZoomSite, hoteZoom, lireZoomSite } from './donnees/zoomSites.ts'
import { ecrirePermissionSite, lirePermissionSite } from './donnees/permissionsSites.ts'
import { REPONSES_PERMISSION, decisionPermissions, permissionsDemandees, type DemandePermission, type PermissionSite, type ReponsePermission } from '../shared/permissions.ts'
import { RAYON_APERCU, pageApercu, placerApercu, scriptApercu, texteApercu, type CoteApercu } from './apercuUrl.ts'
import { placerRecherche, texteRecherche } from './recherche.ts'
import { entreeMenuPageValide, type EntreeMenuPage, type MenuPage } from '../shared/menuPage.ts'
import { adresseWeb, entreesMenuPage } from './menuPage.ts'
import { reordonnerOnglets } from '../shared/ordreOnglets.ts'
import { construirePalette, type ActionPalette, type EntreePalette } from '../shared/palette.ts'
import { estActionOnglet, ongletsAFermer, type ActionOnglet } from '../shared/menuOnglet.ts'
import { MOTEUR_DEFAUT, choixMoteurValide, modeleDe, urlRecherche, type ChoixMoteur } from '../shared/moteurs.ts'
import { SUGGESTIONS_MAX, construireSuggestions, deplacerSelection, indexValide, texteSuggestion } from './suggestions.ts'
import { faviconAcceptable } from './favicon.ts'
import { lireUrlDev } from './urlDev.ts'
import { creerEcritureDifferee } from './donnees/ecritureDifferee.ts'
import { noterFermetureNormale, noterOuverture } from './donnees/fermeture.ts'
import { sauvegarderBase } from './donnees/sauvegarde.ts'
import { basculerFavori, creerDossier, deplacerFavori, estFavori, favorisGrille, listerFavoris, renommerDossier, retirerFavori, supprimerDossier } from './donnees/favoris.ts'
import { adresseHistorique, ajouterVisite, effacerHistorique, lirePage, listerHistorique, nommerPage, rechercherPages } from './donnees/historique.ts'
import { PERIODES_EFFACEMENT, TYPES_EFFACEMENT, debutEffacement, type PeriodeEffacement, type TypeEffacement } from '../shared/historique.ts'
import { ETAT_BARRE_INITIAL, borneLargeurBarre, largeurBarre, transitionBarre } from '../shared/barre.ts'
import { THEMES, ecrireBarre, ecrireMoteur, ecrireTheme, lireBarre, lireMoteur, lireTheme } from './donnees/preferences.ts'
import { actifsParEspace, lireSession, ongletsARestaurer, rattacherAuxEspaces, sauverSession, type OngletSauve } from './donnees/session.ts'
import { creerEspace, ecrireEspaceActif, lireEspaceActif, lireEspaces, modifierEspace, ordonnerEspaces, semerEspaces, supprimerEspace } from './donnees/espaces.ts'
import { champsNouvelEspace, ordreApresDeplacement, type CouleurEspace, type Espace } from '../shared/espaces.ts'
import { creerGestionnaire } from './gestionnaireTelechargements.ts'

const CHEMIN_INTERFACE = join(__dirname, '../renderer/index.html')
// shortcut: icône lue sur disque (dev et build), l'empaquetage devra la fournir à l'installeur (EP-14).
const CHEMIN_ICONE = join(__dirname, '../../resources/icone.ico')

type TabRecord = {
  data: BrowserTab
  view: WebContentsView
  // Page demandée à la vue. Un onglet restauré en arrière-plan (ARB-45) attend d'être affiché pour charger.
  chargee: boolean
  // Adresse de la dernière visite enregistrée dans l'historique (ARB-51), null sur une page qui n'y entre pas.
  adresseVisitee: string | null
  // Espace de l'onglet (ARB-61) ; null si la base est indisponible, donc sans espaces.
  espace: number | null
}

let mainWindow: BrowserWindow | null = null
// Base de données (ARB-43, décision 0001). null si elle n'a pas pu s'ouvrir : le navigateur marche sans persistance.
let base: DatabaseSync | null = null
// Ce que l'ouverture de la base a dû faire (ARB-119), affiché dans la fenêtre jusqu'à ce que l'utilisateur le ferme.
let incidentBase: DataIncident | null = null
let cheminBase: string | null = null
let copiesSuspendues = false
// Barre latérale (ARB-33) : vue native au-dessus de l'onglet, car une WebContentsView masque tout HTML de la fenêtre
// (règle 4). Masquée, elle n'est qu'une bande transparente au bord gauche qui détecte le survol.
let barreView: WebContentsView | null = null
let barre: SidebarState = { ...ETAT_BARRE_INITIAL }
// Couche d'overlays (ARB-39, décision 0002) : menus et palettes s'affichent dans la vue de la barre, agrandie à toute
// la fenêtre tant qu'un overlay est ouvert. Le contenu de l'overlay ne regarde que cette vue.
let overlayOuvert = false
let boiteFichierOuverte = false // boîte « Ouvrir » de l'import des favoris (ARB-50) : le blur qu'elle cause ne ferme pas l'overlay
let echapAvale = false
// Suggestions de la barre d'adresse (ARB-53) : liste affichée dans l'overlay tant qu'elle existe, fermée avec lui. Le
// champ qui les a demandées garde le clavier, donc sa fermeture ne rend pas le focus à la page (sauf choix d'une ligne).
let suggestions: SuggestionsState | null = null
// Menu contextuel d'une page (ARB-40) : tenu ici avec l'adresse du lien et de l'image du clic, que l'interface ne voit
// pas ; elle n'envoie que l'entrée choisie. Fermé avec l'overlay.
let menuPage: (MenuPage & { tabId: string, lien: string, image: string, pageX: number, pageY: number }) | null = null
// Palette de commandes (ARB-67) : les lignes proposées, avec la clé (onglet, adresse, action) que l'interface ne choisit
// que par index. null tant qu'elle est fermée ; fermée avec l'overlay.
let palette: EntreePalette[] | null = null
// Permissions de site (ARB-15) : l'invite affichée dans l'overlay (modale) et celles qui attendent leur tour, une à la fois.
// La page est tenue en attente par `reponse` (le callback d'Electron) ; fermer l'overlay sans répondre refuse sans mémoriser.
type InvitePermission = DemandePermission & { reponse: (accordee: boolean) => void }
let invitePermission: InvitePermission | null = null
const invitesEnAttente: InvitePermission[] = []
// Plein écran demandé par la page (ARB-15, requestFullscreen) : sa vue couvre alors toute la fenêtre, passée en plein écran.
let pleinEcranPage: WebContentsView | null = null
let fenetreDejaPleinEcran = false
let choixTheme: ThemeChoice = 'system'
// Moteur de la barre d'adresse (ARB-58) : relu de la base au démarrage, changé par set-search-engine.
let moteur: ChoixMoteur = MOTEUR_DEFAUT
// Fond natif de la fenêtre, visible avant le rendu de l'interface et au redimensionnement : jumeau de
// --color-background dans src/renderer/src/design-system/tokens.css (ARB-34), à changer ensemble.
const FOND_FENETRE = { dark: '#111820', light: '#F3F5F7' } as const
// Symboles des boutons Windows (titleBarOverlay, ARB-30) : jumeaux de --color-text-primary, sur le fond de la barre de
// contrôle. Hauteur : jumelle de --size-control-bar (48 px).
const SYMBOLES_FENETRE = { dark: '#E8EDF2', light: '#202B36' } as const
const HAUTEUR_BARRE_CONTROLE = 48
// Coins du cadre de page (ARB-32) : jumeau de --radius-md (10 px) dans tokens.css, appliqué à chaque vue web.
const RAYON_PAGE = 10
function themeEffectif(): 'dark' | 'light' {
  if (choixTheme !== 'system') return choixTheme
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}
function overlayBoutons() {
  const theme = themeEffectif()
  return { color: FOND_FENETRE[theme], symbolColor: SYMBOLES_FENETRE[theme], height: HAUTEUR_BARRE_CONTROLE }
}
// Thème choisi (set-theme, palette) : tenu ici, écrit en base, diffusé aux interfaces (ARB-59).
function appliquerTheme(choix: ThemeChoice) {
  choixTheme = choix
  if (base) {
    try {
      ecrireTheme(base, choixTheme)
    } catch (erreur) {
      console.error('Thème non enregistré :', erreur)
    }
  }
  envoyerAuxInterfaces('browser:theme', choixTheme)
  appliquerThemeFenetre()
}
// Fond natif et boutons Windows suivent le thème effectif.
function appliquerThemeFenetre() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setBackgroundColor(FOND_FENETRE[themeEffectif()])
  mainWindow.setTitleBarOverlay(overlayBoutons())
  dessinerApercu()
}
const tabs = new Map<string, TabRecord>()
// Onglet actif de l'espace affiché (ARB-61) ; celui des autres espaces est gardé dans dernierActif, jusqu'au retour.
let activeTabId: string | null = null
let espaces: Espace[] = []
let espaceActif: number | null = null
const dernierActif = new Map<number | null, string>()
let nextTabNumber = 1

// Ids des onglets de l'espace affiché, dans leur ordre : ceux que la barre, Ctrl+Tab, Ctrl+1…9 et la fermeture parcourent.
function ongletsVisibles(): string[] {
  return [...tabs.values()].filter((tab) => tab.espace === espaceActif).map((tab) => tab.data.id)
}
// Bornes de la vue web avant que l'interface envoie les siennes : pleine largeur sous la barre de contrôle (48 px, --size-control-bar),
// la barre latérale étant masquée à l'ouverture (ARB-33).
let contentBounds = { x: 8, y: 48, width: 884, height: 544 }

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
if (profilTest && isAbsolute(profilTest)) {
  app.setPath('userData', profilTest)
  // Les téléchargements des tests (ARB-55) ne vont jamais dans le dossier Téléchargements de l'utilisateur.
  app.setPath('downloads', join(profilTest, 'telechargements'))
}

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
  return urlRecherche(modeleDe(moteur), value)
}

function appliquerMoteur(choix: ChoixMoteur) {
  // Écrit d'abord : un échec remonte à la modale, qui reste ouverte, au lieu d'un choix perdu au redémarrage.
  if (base) ecrireMoteur(base, choix)
  moteur = choix
}

function stateSnapshot(): BrowserState {
  return {
    tabs: [...tabs.values()].filter((tab) => tab.espace === espaceActif).map((tab) => ({ ...tab.data })),
    activeTabId,
    workspaces: espaces,
    activeWorkspaceId: espaceActif,
    favorite: pageActiveEstFavorite(),
    favorites: grilleFavoris()
  }
}

function grilleFavoris(): BrowserState['favorites'] {
  if (!base) return []
  try {
    return favorisGrille(base).map(({ url, titre }) => ({ url, title: titre }))
  } catch (erreur) {
    console.error('Favoris non lus :', erreur)
    return []
  }
}

// Clic sur un favori de la grille (ARB-49) : l'onglet déjà ouvert sur cette page est activé, sinon un onglet l'ouvre.
// L'adresse reçue doit être un favori enregistré, jamais une adresse libre.
function ouvrirFavori(url: string) {
  if (!base) return
  try {
    if (!estFavori(base, url)) return
  } catch (erreur) {
    console.error('Favori non lu :', erreur)
    return
  }
  const ouvert = [...tabs.values()].find((tab) => tab.espace === espaceActif && adresseHistorique(tab.data.url) === url)
  if (ouvert) activerOnglet(ouvert.data.id)
  else createTab(url)
}

// Favoris (ARB-47) : la page de l'onglet actif, sous son adresse d'historique (web seulement, sans identifiants ni fragment).
function adresseFavorite(): string | null {
  const actif = activeRecord()
  return actif ? adresseHistorique(actif.data.url) : null
}

function pageActiveEstFavorite(): boolean {
  const adresse = adresseFavorite()
  if (!base || !adresse) return false
  try {
    return estFavori(base, adresse)
  } catch (erreur) {
    console.error('Favori non lu :', erreur)
    return false
  }
}

function basculerFavoriActif() {
  const adresse = adresseFavorite()
  if (!base || !adresse) return
  try {
    basculerFavori(base, adresse, activeRecord()!.data.title)
  } catch (erreur) {
    console.error('Favori non enregistré :', erreur)
  }
  broadcastState()
}

// Les vues de l'interface : la fenêtre (barre d'outils, zone de page), la barre latérale et la recherche dans la page.
function contenusInterface(): WebContents[] {
  const fenetre = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : undefined
  return [fenetre, barreView?.webContents, rechercheView?.webContents]
    .filter((contenu): contenu is WebContents => !!contenu && !contenu.isDestroyed())
}

function envoyerAuxInterfaces(canal: string, valeur: unknown) {
  for (const contenu of contenusInterface()) contenu.send(canal, valeur)
}

// Téléchargements (ARB-55) : enregistrés sans invite dans le dossier Téléchargements de l'utilisateur (créé au besoin).
const telechargements = creerGestionnaire({
  dossier: () => {
    const dossier = app.getPath('downloads')
    mkdirSync(dossier, { recursive: true })
    return dossier
  },
  base: () => base,
  diffuser: (liste) => envoyerAuxInterfaces('browser:downloads', liste),
  ouvrir: (chemin) => { void shell.openPath(chemin).then((erreur) => { if (erreur) console.error('Ouverture du téléchargement impossible :', erreur) }) },
  reveler: (chemin) => shell.showItemInFolder(chemin)
})

// Session des onglets (ARB-44) : écrite une seconde après le dernier changement, au plus tard 5 secondes après le
// premier, et à la fermeture. Les chargements changent l'état sans changer la session : une session identique à la
// dernière écrite n'est pas réécrite.
let derniereSessionEcrite = ''
// Arrêt forcé (ARB-46) : la session interrompue n'est pas rouverte d'office, une invite propose de la restaurer. Tant
// qu'elle attend sa réponse, la session n'est pas réécrite : la base garde celle qui a été interrompue. Fermer
// Arbalète sans répondre la laisse donc à la restauration du démarrage suivant.
let precedenteInterrompue = false
let sessionProposee: OngletSauve[] | null = null
// Onglet ouvert d'office au démarrage, faute de session : la restauration le remplace s'il n'a pas servi.
let ongletDeDemarrage: string | null = null

function ecrireSession() {
  if (!base || sessionProposee) return
  const onglets: OngletSauve[] = [...tabs.values()].map(({ data, espace }) => ({
    url: data.url,
    titre: data.title,
    actif: data.id === (espace === espaceActif ? activeTabId : dernierActif.get(espace)),
    ...(espace === null ? {} : { espace })
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

// Rectangle de la page de l'onglet actif : le cadre de l'interface, ou toute la fenêtre pendant un plein écran de la page.
function placerPage() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (pleinEcranPage) {
    const { width, height } = mainWindow.getContentBounds()
    pleinEcranPage.setBounds({ x: 0, y: 0, width, height })
  } else activeRecord()?.view.setBounds(contentBounds)
}

// Electron n'a pas d'API pour sortir du plein écran HTML d'une page : le document le fait lui-même (script constant, sans donnée).
function finirPleinEcranHtml(contenu: WebContents) {
  contenu.executeJavaScript('document.fullscreenElement && document.exitFullscreen()').catch(() => {})
}

function entrerPleinEcranPage(view: WebContentsView) {
  if (!mainWindow || mainWindow.isDestroyed() || view !== activeRecord()?.view) { finirPleinEcranHtml(view.webContents); return }
  pleinEcranPage = view
  fenetreDejaPleinEcran = mainWindow.isFullScreen()
  if (!fenetreDejaPleinEcran) mainWindow.setFullScreen(true)
  view.setBorderRadius(0)
  placerPage()
}

// Sortie demandée par la page (Échap, fin de la vidéo), par la fenêtre (F11) ou par un changement d'onglet.
function sortirPleinEcranPage(view: WebContentsView) {
  if (pleinEcranPage !== view) return
  pleinEcranPage = null
  if (!view.webContents.isDestroyed()) {
    view.setBorderRadius(RAYON_PAGE)
    finirPleinEcranHtml(view.webContents)
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!fenetreDejaPleinEcran && mainWindow.isFullScreen()) mainWindow.setFullScreen(false)
    placerPage()
  }
}

function setActiveView() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (pleinEcranPage && pleinEcranPage !== activeRecord()?.view) sortirPleinEcranPage(pleinEcranPage)
  retirerApercu()
  // La recherche suit l'onglet qu'elle cherche : un autre onglet affiché la ferme (réactiver l'actif ne la touche pas).
  if (rechercheContenu !== activeRecord()?.view.webContents) fermerRecherche()
  for (const [id, record] of tabs) {
    try {
      mainWindow.contentView.removeChildView(record.view)
    } catch {
      // La vue peut déjà être détachée.
    }
    if (id === activeTabId) {
      mainWindow.contentView.addChildView(record.view)
      placerPage()
      chargerOnglet(record)
    }
  }
  // Réajouter une vue déjà présente la remet au premier plan : la recherche ouverte, puis la barre, restent au-dessus de
  // l'onglet affiché (réactiver l'onglet actif le remet lui aussi au premier plan).
  if (rechercheView && rechercheVisible) mainWindow.contentView.addChildView(rechercheView)
  if (barreView) mainWindow.contentView.addChildView(barreView)
}

// Ouverte ou épinglée : pleine largeur de barre sur toute la hauteur ; masquée : la bande de survol. Pendant un
// overlay : toute la fenêtre.
function placerBarre() {
  if (!mainWindow || mainWindow.isDestroyed() || !barreView) return
  const { width, height } = mainWindow.getContentBounds()
  barreView.setBounds({ x: 0, y: 0, width: overlayOuvert ? width : largeurBarre(barre), height })
}

// Mode et largeur de la barre conservés au redémarrage (ARB-123).
function enregistrerBarre() {
  if (!base) return
  try {
    ecrireBarre(base, barre)
  } catch (erreur) {
    console.error('Barre latérale non enregistrée :', erreur)
  }
}

// Différée : le glissement de la poignée envoie une largeur par mouvement du pointeur, une seule écriture suit.
const sauvegardeBarre = creerEcritureDifferee(enregistrerBarre, 300, 2000)

function appliquerBarre(suivant: SidebarState) {
  if (suivant.open === barre.open && suivant.pinned === barre.pinned && suivant.compact === barre.compact && suivant.width === barre.width) return
  const persistant = suivant.pinned !== barre.pinned || suivant.compact !== barre.compact || suivant.width !== barre.width
  barre = suivant
  if (persistant) sauvegardeBarre.demander()
  placerBarre()
  envoyerAuxInterfaces('browser:sidebar', barre)
}

// Masquer n'agit pas sur une barre épinglée ni pendant un overlay (la souris peut alors quitter la zone de la barre
// sans la quitter) ; désépingler la referme.
function agirSurBarre(action: SidebarAction) {
  if (action === 'hide' && overlayOuvert) return
  appliquerBarre(transitionBarre(barre, action))
}

function ouvrirOverlay() {
  if (overlayOuvert || !mainWindow || mainWindow.isDestroyed() || !barreView) return
  overlayOuvert = true
  // Réajoutée, la vue repasse au-dessus de tout, page comprise.
  mainWindow.contentView.addChildView(barreView)
  placerBarre()
  envoyerAuxInterfaces('browser:overlay', true)
}

// À la fermeture, la vue reprend sa taille de barre. Une barre non épinglée se retire si la souris n'est plus sur elle :
// la vue rétrécie sous le pointeur ne reçoit pas toujours de sortie de souris.
function fermerOverlay() {
  if (!overlayOuvert) return
  overlayOuvert = false
  const duChamp = suggestions !== null
  const duMenu = menuPage !== null
  const dePalette = palette !== null
  suggestions = null
  menuPage = null
  palette = null
  // Une invite de permission fermée sans réponse (Échap, clic à côté, focus perdu) refuse cette fois, sans mémoriser.
  const invite = invitePermission
  invitePermission = null
  placerBarre()
  envoyerAuxInterfaces('browser:overlay', false)
  if (invite) {
    envoyerAuxInterfaces('browser:permission', null)
    invite.reponse(false)
  }
  queueMicrotask(afficherInvitePermission)
  envoyerAuxInterfaces('browser:suggestions', null)
  if (duMenu) envoyerAuxInterfaces('browser:page-menu', null)
  if (dePalette) {
    envoyerAuxInterfaces('browser:palette', null)
    // Le champ de la palette avait le clavier : il revient à la page, barre épinglée comprise.
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) activeRecord()?.view.webContents.focus()
  }
  if (!mainWindow || mainWindow.isDestroyed() || barre.pinned) return
  const pointeur = screen.getCursorScreenPoint()
  const zone = mainWindow.getContentBounds()
  const surLaBarre = pointeur.x >= zone.x && pointeur.x < zone.x + largeurBarre({ ...barre, open: true }) &&pointeur.y >= zone.y && pointeur.y < zone.y + zone.height
  if (surLaBarre) return
  agirSurBarre('hide')
  // La barre retirée gardait le clavier (clic droit, menu) : il revient à la page, sauf s'il est dans le champ d'adresse.
  if (!duChamp) activeRecord()?.view.webContents.focus()
}

// Une invite à la fois, quand l'overlay est libre (un menu ouvert la fait attendre).
function afficherInvitePermission() {
  if (invitePermission || overlayOuvert || !barreView || !mainWindow || mainWindow.isDestroyed()) return
  // Un choix mémorisé entre-temps (Refuser, Autoriser) répond aux invites restées en file sans les montrer.
  // shortcut: une invite dont l'onglet a été fermé ou a navigué reste affichée ; la réponse vaut pour l'hôte indiqué.
  let invite = invitesEnAttente.shift()
  while (invite) {
    const decision = decisionSite(invite.hote, invite.permissions)
    if (decision === 'demander') break
    invite.reponse(decision === 'autoriser')
    invite = invitesEnAttente.shift()
  }
  if (!invite) return
  invitePermission = invite
  ouvrirOverlay()
  envoyerAuxInterfaces('browser:permission', { hote: invite.hote, permissions: invite.permissions })
}

function repondreInvitePermission(reponse: ReponsePermission) {
  const invite = invitePermission
  if (!invite) return
  invitePermission = null
  if (base) {
    try {
      for (const permission of invite.permissions) ecrirePermissionSite(base, invite.hote, permission, reponse)
    } catch (erreur) {
      console.error('Permission de site non enregistrée :', erreur)
    }
  }
  envoyerAuxInterfaces('browser:permission', null)
  invite.reponse(reponse === 'autoriser')
  fermerOverlay()
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) activeRecord()?.view.webContents.focus()
}

// Choix mémorisé du site pour ces permissions : accordé, refusé ou à demander. Une base indisponible refuse.
function decisionSite(hote: string, permissions: PermissionSite[]): ReponsePermission | 'demander' {
  if (!base) return 'refuser'
  try {
    return decisionPermissions(permissions, (permission) => lirePermissionSite(base!, hote, permission))
  } catch (erreur) {
    console.error('Permission de site non relue :', erreur)
    return 'refuser'
  }
}

// Clic droit dans la page de l'onglet actif (ARB-40) : le menu s'ouvre dans la couche d'overlays, au point du clic.
// Un overlay déjà ouvert n'est pas remplacé.
function ouvrirMenuPage(tabId: string, params: Electron.ContextMenuParams) {
  const record = tabs.get(tabId)
  if (!record || tabId !== activeTabId || overlayOuvert || !barreView) return
  const wc = record.view.webContents
  const entrees = entreesMenuPage({
    lien: params.linkURL,
    image: params.mediaType === 'image' ? params.srcURL : '',
    texteSelectionne: params.selectionText.trim() !== '' && params.editFlags.canCopy,
    peutReculer: wc.navigationHistory.canGoBack(),
    peutAvancer: wc.navigationHistory.canGoForward(),
    inspecter: !app.isPackaged
  })
  if (!entrees.length) return
  const { x, y, width, height } = record.view.getBounds()
  // Le point vient du rendu de la page : borné à la page, un nombre aberrant (négatif, NaN) ne sort pas le menu de la fenêtre.
  const pageX = Number.isFinite(params.x) ? Math.max(0, Math.min(params.x, width)) : 0
  const pageY = Number.isFinite(params.y) ? Math.max(0, Math.min(params.y, height)) : 0
  menuPage = { tabId, x: x + pageX, y: y + pageY, entrees, lien: params.linkURL, image: params.srcURL, pageX, pageY }
  ouvrirOverlay()
  if (!overlayOuvert) { menuPage = null; return }
  envoyerAuxInterfaces('browser:page-menu', menuPage && { x: menuPage.x, y: menuPage.y, entrees: menuPage.entrees })
}

function agirSurMenuPage(entree: EntreeMenuPage) {
  const menu = menuPage
  if (!menu || !menu.entrees.includes(entree)) return
  const wc = tabs.get(menu.tabId)?.view.webContents
  fermerOverlay()
  if (!wc || wc.isDestroyed()) return
  // Les actions de navigation visent l'onglet du clic, même si un autre est devenu actif pendant que le menu était ouvert.
  if (entree === 'retour') { if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack() }
  else if (entree === 'avancer') { if (wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward() }
  else if (entree === 'recharger') wc.reload()
  else if (entree === 'copier') wc.copy()
  else if (entree === 'ouvrir-lien') { createTab(menu.lien); activeRecord()?.view.webContents.focus() }
  else if (entree === 'copier-lien') clipboard.writeText(menu.lien)
  else if (entree === 'enregistrer-image') wc.downloadURL(menu.image)
  else wc.inspectElement(menu.pageX, menu.pageY)
}

// Palette de commandes (ARB-67) : onglets de l'espace affiché, favoris, pages de l'historique et actions qui correspondent
// au texte. Sans texte, l'historique n'est pas lu.
function entreesPalette(texte: string) {
  let favoris: { url: string, titre: string }[] = []
  let pages: { url: string, titre: string }[] = []
  if (base) {
    try {
      favoris = texte ? favorisGrille(base, 500) : []
      pages = texte ? rechercherPages(base, texte, 20) : []
    } catch (erreur) {
      console.error('Favoris ou historique non lus pour la palette :', erreur)
    }
  }
  const ouverts = [...tabs.values()].filter((tab) => tab.espace === espaceActif)
    .map(({ data }) => ({ id: data.id, titre: data.title, url: data.url, adresse: adresseHistorique(data.url) ?? data.url }))
  return construirePalette(texte, ouverts, favoris, pages)
}

// Ctrl+K ou le bouton « Rechercher » : la vue de la barre prend le clavier, son champ cherche. Un overlay déjà ouvert n'est
// pas remplacé.
function ouvrirPalette() {
  if (overlayOuvert || !barreView) return
  palette = entreesPalette('')
  ouvrirOverlay()
  if (!overlayOuvert) { palette = null; return }
  barreView.webContents.focus()
  envoyerAuxInterfaces('browser:palette', palette)
}

// `cle` est celle de la ligne affichée : si la liste a changé entre-temps (frappe puis Entrée), le choix est refusé.
function choisirPalette(index: number, cle: string) {
  const entree = palette?.[index]
  if (!entree || entree.cle !== cle) return
  fermerOverlay()
  if (entree.kind === 'onglet') activerAutreOnglet(entree.cle)
  else if (entree.kind === 'favori') { ouvrirFavori(entree.cle); activeRecord()?.view.webContents.focus() }
  else if (entree.kind === 'historique') { if (adresseWeb(entree.cle)) createTab(entree.cle); activeRecord()?.view.webContents.focus() }
  else actionPalette(entree.cle as ActionPalette)
}

function actionPalette(action: ActionPalette) {
  if (action === 'nouvel-onglet') { createTab(); focaliserAdresse() }
  else if (action === 'rouvrir-onglet') { rouvrirOnglet(); activeRecord()?.view.webContents.focus() }
  else if (action === 'theme') appliquerTheme(themeEffectif() === 'dark' ? 'light' : 'dark')
  else agirSurBarre('toggle-pin')
}

// Navigation de l'onglet actif vers un texte tapé ou une adresse (barre d'adresse, suggestions).
function naviguer(texte: string) {
  const record = activeRecord()
  if (!record) return
  const normalized = normalizeUrl(texte)
  record.data.url = normalized
  void record.view.webContents.loadURL(normalized).catch(console.error)
  broadcastState()
}

// Suggestions (ARB-53) : liste pour le texte tapé, affichée dans l'overlay sous le champ. Une liste vide, ou un overlay
// déjà pris par autre chose, ne laisse rien d'ouvert.
function proposerSuggestions(texte: string, ancre: SuggestionsState['anchor']) {
  if (!texte) return fermerSuggestions()
  if (overlayOuvert && !suggestions) return
  let pages: ReturnType<typeof rechercherPages> = []
  try {
    pages = base ? rechercherPages(base, texte, SUGGESTIONS_MAX) : []
  } catch (erreur) {
    console.error('Historique non lu pour les suggestions :', erreur)
  }
  const items = construireSuggestions(texte, normalizeUrl(texte), pages, modeleDe(moteur))
  if (!items.length) return fermerSuggestions()
  suggestions = { items, selection: -1, anchor: ancre }
  ouvrirOverlay()
  // Fenêtre ou vue de la barre absente (démarrage, fermeture) : l'overlay ne s'est pas ouvert, la liste ne doit pas rester.
  if (!overlayOuvert) {
    suggestions = null
    return
  }
  envoyerAuxInterfaces('browser:suggestions', suggestions)
}

function fermerSuggestions() {
  if (suggestions) fermerOverlay()
}

// Un clic dans la page ou dans la barre d'outils retire la barre non épinglée. Le clic, pas le focus : au démarrage le
// focus passe de lui-même d'une vue à l'autre, et une page le reprend à la fin de son chargement.
function masquerAuClic(contenu: WebContents) {
  contenu.on('before-mouse-event', (_event, souris) => {
    if (souris.type === 'mouseDown') agirSurBarre('hide')
  })
}

// Aperçu de l'adresse d'un lien survolé (ARB-36, décision 0003) : petite vue native, créée au premier survol, posée
// au bas de la page. Sans script ni IPC : le processus principal y écrit le texte (apercuUrl.ts).
let apercuView: WebContentsView | null = null
let apercuCharge = false
let apercuVisible = false
let apercuTexte = ''
let apercuCote: CoteApercu = 'gauche'

function creerApercu(): WebContentsView {
  const vue = new WebContentsView({
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  })
  vue.setBackgroundColor('#00000000')
  vue.setBorderRadius(RAYON_APERCU)
  const contenu = vue.webContents
  contenu.on('will-navigate', (event) => event.preventDefault())
  contenu.setWindowOpenHandler(() => ({ action: 'deny' }))
  contenu.on('did-finish-load', () => {
    apercuCharge = true
    dessinerApercu()
  })
  // La bulle gêne le lien qu'elle recouvre : sous la souris, elle passe de l'autre côté de la page (comme Chrome).
  contenu.on('before-mouse-event', (_event, souris) => {
    if (souris.type !== 'mouseMove' || !apercuVisible) return
    apercuCote = apercuCote === 'gauche' ? 'droite' : 'gauche'
    placerApercuVue()
  })
  void contenu.loadURL(pageApercu())
  return vue
}

function dessinerApercu() {
  if (!apercuView || !apercuCharge) return
  apercuView.webContents.executeJavaScript(scriptApercu(apercuTexte, themeEffectif())).catch(() => {})
}

function placerApercuVue() {
  if (apercuView && apercuVisible) apercuView.setBounds(placerApercu(contentBounds, apercuTexte, apercuCote))
}

function retirerApercu() {
  apercuTexte = ''
  apercuCote = 'gauche'
  if (!apercuVisible || !apercuView) return
  apercuVisible = false
  dessinerApercu()
  try {
    mainWindow?.contentView.removeChildView(apercuView)
  } catch {
    // La vue peut déjà être détachée.
  }
}

function afficherApercu(url: unknown) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  apercuTexte = texteApercu(url)
  if (!apercuTexte) return retirerApercu()
  apercuView ??= creerApercu()
  dessinerApercu()
  const etaitVisible = apercuVisible
  apercuVisible = true
  placerApercuVue()
  if (etaitVisible) return
  mainWindow.contentView.addChildView(apercuView)
  // La barre et ses overlays restent au-dessus de la bulle.
  if (barreView) mainWindow.contentView.addChildView(barreView)
}

// Recherche dans la page (ARB-70) : petite vue d'interface (?vue=recherche) posée au coin haut-droit de la page, créée au
// premier Ctrl+F. Contrairement à un overlay (décision 0002), elle ne couvre pas la page : défilement et clics restent
// à la page, et la recherche reste ouverte jusqu'à Échap ou la croix. shortcut: une navigation de la page n'est pas
// suivie (le compteur reste celui de la page quittée jusqu'à la frappe suivante).
let rechercheView: WebContentsView | null = null
let rechercheVisible = false
// Page cherchée : celle de l'onglet actif à l'ouverture.
let rechercheContenu: WebContents | null = null

function creerRecherche(): WebContentsView {
  const vue = new WebContentsView({ webPreferences: PREFERENCES_INTERFACE })
  vue.setBackgroundColor('#00000000')
  vue.setBorderRadius(RAYON_PAGE)
  verrouillerInterface(vue.webContents)
  // Le focus ne se prend que dans une fenêtre active : sinon Windows la ramènerait au premier plan (comme ARB-112).
  vue.webContents.on('did-finish-load', () => { if (rechercheVisible && mainWindow?.isFocused()) focaliserRecherche(true) })
  // Un rendu planté ne se recharge pas : la vue est jetée, la prochaine ouverture en recrée une.
  vue.webContents.on('render-process-gone', () => {
    fermerRecherche()
    rechercheView = null
    if (!vue.webContents.isDestroyed()) vue.webContents.close()
  })
  chargerInterface(vue.webContents, 'recherche')
  return vue
}

function placerRechercheVue() {
  if (rechercheView && rechercheVisible) rechercheView.setBounds(placerRecherche(contentBounds))
}

// Le clavier va au champ, dont le texte est sélectionné (Ctrl+F sur une recherche ouverte). `nouvelle` : la recherche vient
// de s'ouvrir, le champ repart vide (le texte et le compteur de la précédente ne valent plus rien pour cette page).
function focaliserRecherche(nouvelle = false) {
  if (!rechercheView || rechercheView.webContents.isDestroyed()) return
  rechercheView.webContents.focus()
  rechercheView.webContents.send('browser:find-focus', nouvelle)
}

function ouvrirRecherche() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (rechercheVisible) return focaliserRecherche()
  const contenu = activeRecord()?.view.webContents
  if (!contenu || contenu.isDestroyed()) return
  rechercheView ??= creerRecherche()
  rechercheContenu = contenu
  rechercheVisible = true
  placerRechercheVue()
  mainWindow.contentView.addChildView(rechercheView)
  // La barre et ses overlays restent au-dessus de la recherche.
  if (barreView) mainWindow.contentView.addChildView(barreView)
  if (!rechercheView.webContents.isLoading()) focaliserRecherche(true)
}

// La sélection du résultat actif reste dans la page, comme Chrome. `rendreLeFocus` : fermeture voulue par l'utilisateur.
function fermerRecherche(rendreLeFocus = false) {
  if (rechercheContenu && !rechercheContenu.isDestroyed()) rechercheContenu.stopFindInPage('keepSelection')
  rechercheContenu = null
  if (!rechercheVisible) return
  rechercheVisible = false
  try {
    if (rechercheView) mainWindow?.contentView.removeChildView(rechercheView)
  } catch {
    // La vue peut déjà être détachée.
  }
  if (rendreLeFocus) activeRecord()?.view.webContents.focus()
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
    audible: wc.isCurrentlyAudible(),
    muted: wc.audioMuted,
    canGoBack: wc.navigationHistory.canGoBack(),
    canGoForward: wc.navigationHistory.canGoForward()
  }
  broadcastState()
}

// Historique (ARB-51) : une navigation du cadre principal est une visite si elle mène à une autre adresse que la
// dernière visite de l'onglet. Un rechargement ou un changement de fragment n'en est pas une ; revenir en arrière vers
// une autre page, si.
function noterVisite(record: TabRecord, url: string) {
  const adresse = adresseHistorique(url)
  if (adresse === record.adresseVisitee) return
  record.adresseVisitee = adresse
  if (!base || !adresse) return
  try {
    ajouterVisite(base, adresse)
  } catch (erreur) {
    console.error('Visite non enregistrée :', erreur)
  }
}

function nommerVisite(record: TabRecord, titre: string) {
  if (!base || !record.adresseVisitee) return
  try {
    nommerPage(base, record.adresseVisitee, titre)
  } catch (erreur) {
    console.error('Titre de la visite non enregistré :', erreur)
  }
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

function activerOnglet(id: string) {
  // Seul un onglet de l'espace affiché s'active ; un autre espace s'atteint par changerEspace (ARB-61).
  if (tabs.get(id)?.espace !== espaceActif) return
  activeTabId = id
  setActiveView()
  updateTabFromView(id)
}

// Ctrl+Tab, Ctrl+1…9 : l'onglet visé devient actif et reprend le clavier, comme après Ctrl+W. Sans onglet visé, rien.
function activerAutreOnglet(id: string | null) {
  if (!id) return
  if (id !== activeTabId) activerOnglet(id)
  activeRecord()?.view.webContents.focus()
}

function recharger(sansCache: boolean) {
  const wc = activeRecord()?.view.webContents
  if (!wc || wc.isDestroyed()) return
  if (sansCache) wc.reloadIgnoringCache()
  else wc.reload()
}

// Ctrl+L depuis une page ou la barre latérale : le focus clavier passe à la fenêtre, puis l'interface sélectionne la
// barre d'adresse.
function focaliserAdresse() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.focus()
  mainWindow.webContents.send('browser:focus-address')
}

// Ctrl+=, Ctrl+- et Ctrl+0 zooment la page de l'onglet actif, jamais l'interface (le rôle zoom de l'ancien menu zoomait
// l'interface). Le facteur est mémorisé par site (ARB-71) et réappliqué à chaque navigation (`appliquerZoomSite`).
function zoomerPage(sens: SensZoom) {
  const contenu = activeRecord()?.view.webContents
  if (!contenu || contenu.isDestroyed()) return
  const facteur = palierZoom(contenu.getZoomFactor(), sens)
  contenu.setZoomFactor(facteur)
  const hote = hoteZoom(contenu.getURL())
  if (!base || !hote) return
  try {
    ecrireZoomSite(base, hote, facteur)
  } catch (erreur) {
    console.error('Zoom non enregistré :', erreur)
  }
}

// Zoom mémorisé du site que l'onglet vient d'atteindre, 100 % pour une page sans zoom ou hors web.
function appliquerZoomSite(contenu: Electron.WebContents, url: string) {
  if (contenu.isDestroyed()) return
  const hote = hoteZoom(url)
  let facteur = 1
  if (base && hote) {
    try {
      facteur = lireZoomSite(base, hote)
    } catch (erreur) {
      console.error('Zoom non relu :', erreur)
    }
  }
  contenu.setZoomFactor(facteur)
}

// F11 : plein écran de la fenêtre. La page et la barre suivent le redimensionnement qui en résulte.
function basculerPleinEcran() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setFullScreen(!mainWindow.isFullScreen())
}

// Action du raccourci d'Arbalète que forme la touche, ou undefined. AltGr arrive comme Ctrl+Alt : il est écarté.
function actionDuRaccourci(input: Electron.Input): (() => void) | undefined {
  // Disposition non latine (russe, grec…) : key est une lettre d'un autre alphabet, la touche physique (code) prend le
  // relais. Une lettre latine accentuée (é, è du BÉPO) garde son sens : Ctrl+é ne ferme pas l'onglet.
  const nonLatine = /^\p{L}$/u.test(input.key) && !/\p{Script=Latin}/u.test(input.key)
  const touche = nonLatine ? input.code.replace(/^Key/, '').toLowerCase() : input.key.toLowerCase()
  // Zoom de la page (ARB-107) : avant le test de Maj, qui permet Ctrl+Maj+= (le « + » du QWERTY) et Ctrl+Maj+0 (AZERTY).
  const zoom = sensDuZoom(input)
  if (zoom) return () => zoomerPage(zoom)
  if (input.key === 'F11' && !input.control && !input.alt && !input.shift && !input.meta) return basculerPleinEcran
  // Changement d'onglet et rechargement (ARB-19, ARB-21), avant le test de Maj : Ctrl+Maj+Tab et Ctrl+Maj+R en dépendent.
  const pas = pasDOnglet(input)
  if (pas) return () => activerAutreOnglet(ongletRelatif(ongletsVisibles(), activeTabId, pas))
  const numero = numeroDOnglet(input)
  if (numero) return () => activerAutreOnglet(ongletNumero(ongletsVisibles(), numero))
  const recharge = rechargement(input, touche)
  if (recharge) return () => recharger(recharge === 'sans-cache')
  if (input.control && !input.alt && !input.meta) {
    if (input.shift) {
      if (touche === 'b') return () => agirSurBarre('toggle-pin')
      if (touche === 't') return () => { rouvrirOnglet(); activeRecord()?.view.webContents.focus() }
      return undefined
    }
    // Comme Chrome : le nouvel onglet donne la main à la barre d'adresse, la fermeture à l'onglet qui devient actif.
    if (touche === 't') return () => { createTab(); focaliserAdresse() }
    if (touche === 'w') return () => {
      if (activeTabId) closeTab(activeTabId)
      activeRecord()?.view.webContents.focus()
    }
    if (touche === 'l') return focaliserAdresse
    if (touche === 'f') return ouvrirRecherche
    if (touche === 'k') return ouvrirPalette
  } else if (input.alt && !input.control && !input.shift && !input.meta) {
    if (input.key === 'ArrowLeft') return reculer
    if (input.key === 'ArrowRight') return avancer
  }
  return undefined
}

// Raccourcis d'Arbalète (ARB-18, ARB-107) : Ctrl+T, Ctrl+W, Ctrl+L, Alt+←/→, Ctrl+Maj+B, le zoom et F11 agissent quel que soit le
// webContents qui a le focus, la fenêtre, la barre latérale ou la page d'un onglet (règle 5). Le webContents ne reçoit
// pas la combinaison (relâchement et répétitions compris) ; seul le premier appui agit.
// Pendant un overlay, Échap le ferme où que soit le focus, et un raccourci le ferme avant d'agir (ARB-39).
function brancherRaccourcis(contenu: WebContents) {
  contenu.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && !input.control && !input.alt && !input.meta) {
      // Le relâchement de l'Échap qui a fermé l'overlay n'atteint pas non plus la page.
      if (input.type === 'keyUp' && echapAvale) {
        echapAvale = false
        event.preventDefault()
        return
      }
      if (overlayOuvert) {
        event.preventDefault()
        if (input.type === 'keyDown') {
          echapAvale = true
          fermerOverlay()
        }
        return
      }
    }
    const action = actionDuRaccourci(input)
    if (!action) return
    event.preventDefault()
    if (input.type === 'keyDown' && !input.isAutoRepeat) {
      fermerOverlay()
      action()
    }
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
// Un onglet s'ouvre dans l'espace affiché ; un onglet restauré garde le sien (ARB-61).
function createTab(initialUrl = 'https://www.google.com', restaure?: { titre: string, espace?: number }): string {
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
  view.setBorderRadius(RAYON_PAGE)

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
    chargee: false,
    // Rouvrir un onglet restauré n'est pas une visite.
    adresseVisitee: restaure ? adresseHistorique(normalizeUrl(initialUrl)) : null,
    espace: restaure ? restaure.espace ?? null : espaceActif
  }
  tabs.set(id, record)

  view.webContents.on('enter-html-full-screen', () => entrerPleinEcranPage(view))
  view.webContents.on('leave-html-full-screen', () => sortirPleinEcranPage(view))
  view.webContents.on('page-title-updated', (_event, titre, explicite) => {
    // Sans <title>, Chromium donne l'adresse comme titre : l'historique garde alors le titre déjà connu.
    if (explicite) nommerVisite(record, titre)
    updateTabFromView(id)
  })
  view.webContents.on('did-navigate', (_event, url) => {
    noterVisite(record, url)
    appliquerZoomSite(view.webContents, url)
    updateTabFromView(id)
  })
  view.webContents.on('did-navigate-in-page', (_event, url, cadrePrincipal) => {
    if (cadrePrincipal) noterVisite(record, url)
    updateTabFromView(id)
  })
  view.webContents.on('page-favicon-updated', (_event, favicons) => {
    record.data = { ...record.data, favicon: faviconAcceptable(favicons) }
    updateTabFromView(id)
  })
  view.webContents.on('audio-state-changed', () => updateTabFromView(id))
  // Résultat de la recherche (ARB-70) : seule la mise à jour finale compte, les autres arrivent avec un compte partiel.
  view.webContents.on('found-in-page', (_event, resultat) => {
    if (!resultat.finalUpdate || view.webContents !== rechercheContenu || !rechercheView) return
    rechercheView.webContents.send('browser:find-result', { active: resultat.activeMatchOrdinal, total: resultat.matches })
  })
  // État Error : le chargement de la page a échoué. -3 (ERR_ABORTED) est une navigation interrompue, pas une panne.
  view.webContents.on('did-fail-load', (_event, code, _desc, _url, cadrePrincipal) => {
    if (!cadrePrincipal || code === -3) return
    record.data = { ...record.data, error: true }
    updateTabFromView(id)
  })
  // ARB-97 : ni will-navigate ni will-frame-navigate ne sont émis pour about:blank, donc rien à annuler en amont.
  // Le chargement initial de l'onglet passe lui aussi par about:blank, mais sans cadre initiateur : seule une navigation
  // lancée par une page (initiator) est défaite, par un retour en arrière une fois validée (stop() ici plante Electron).
  // Chaque démarrage de navigation du cadre principal réécrit le drapeau : une navigation vers about:blank qui n'aboutit
  // pas ne laisse rien derrière elle.
  // shortcut: la page about:blank s'affiche un instant avant le retour ; une navigation de script vers about:blank remplace
  // la page dans l'historique, le retour va donc avant elle. Plafond des retours : aboutBlank.ts.
  let blancDePage = false
  let retoursBlanc: number[] = []
  view.webContents.on('did-start-navigation', (details) => {
    if (!details.isMainFrame || details.isSameDocument) return
    blancDePage = !!details.initiator && estAboutBlank(details.url)
  })
  view.webContents.on('did-navigate', (_event, url) => {
    const aDefaire = blancDePage && estAboutBlank(url)
    blancDePage = false
    if (!aDefaire || !view.webContents.navigationHistory.canGoBack()) return
    const suite = retourPermis(retoursBlanc, performance.now())
    if (!suite) return
    retoursBlanc = suite
    view.webContents.navigationHistory.goBack()
  })
  // Une navigation du cadre principal vers un autre document efface l'erreur ; un changement de fragment ne l'efface pas.
  view.webContents.on('did-start-navigation', (_event, _url, dansPage, cadrePrincipal) => {
    if (!cadrePrincipal || dansPage) return
    // Le favicon de l'ancien document ne suit pas : la nouvelle page en annonce un, ou l'icône générique revient.
    if (!record.data.error && !record.data.favicon) return
    record.data = { ...record.data, error: false, favicon: undefined }
    updateTabFromView(id)
  })
  view.webContents.on('update-target-url', (_event, url) => {
    if (id === activeTabId) afficherApercu(url)
  })
  // Le lien survolé disparaît avec la page qui le portait.
  view.webContents.on('did-start-navigation', (details) => {
    if (id === activeTabId && details.isMainFrame && !details.isSameDocument) retirerApercu()
  })
  view.webContents.on('did-start-loading', () => updateTabFromView(id))
  view.webContents.on('did-stop-loading', () => updateTabFromView(id))
  view.webContents.setWindowOpenHandler(({ url }) => {
    // Une page d'un espace masqué n'ouvre pas d'onglet : il surgirait dans l'espace affiché (ARB-61).
    if (record.espace === espaceActif && ouvertureAutorisee(id, url)) void createTab(url)
    return { action: 'deny' }
  })
  view.webContents.on('will-navigate', (event, url) => {
    if (!/^https?:\/\//i.test(url) && !/^file:\/\//i.test(url)) event.preventDefault()
  })
  view.webContents.on('context-menu', (_event, params) => ouvrirMenuPage(id, params))
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

function lireSessionSauvee(): OngletSauve[] {
  if (!base) return []
  try {
    return lireSession(base)
  } catch (erreur) {
    console.error('Session des onglets illisible, rien n’est restauré :', erreur)
    return []
  }
}

// Rouvre les onglets d'une session (ARB-45), dans leur ordre, après ceux déjà ouverts ; seul l'onglet actif de la
// session charge sa page. Renvoie false si rien n'a été rouvert.
function rouvrirSession(session: OngletSauve[]): boolean {
  const { onglets } = ongletsARestaurer(session)
  if (!onglets.length) return false
  // Chaque onglet retrouve son espace (ARB-61) ; l'onglet actif de chaque espace est celui que le changement d'espace
  // réactivera, celui de l'espace affiché l'est tout de suite.
  const rattaches = rattacherAuxEspaces(onglets, espaces.map((espace) => espace.id))
  const ids = rattaches.map((onglet) => createTab(onglet.url, { titre: onglet.titre, espace: onglet.espace }))
  for (const [espace, indice] of actifsParEspace(rattaches)) dernierActif.set(espace ?? null, ids[indice])
  const restaure = dernierActif.get(espaceActif)
  if (restaure && tabs.get(restaure)?.espace === espaceActif) activeTabId = restaure
  // Un espace affiché sans onglet restauré reçoit son onglet de l'appelant (démarrage), qui sait si une adresse de lancement
  // s'ouvre déjà dedans.
  if (ongletsVisibles().length) setActiveView()
  broadcastState()
  return true
}

// Au démarrage : rouvre la dernière session, ou la garde pour l'invite si Arbalète a été arrêté de force (ARB-46).
// Renvoie true si des onglets ont été rouverts.
function restaurerSession(): boolean {
  if (!base || tabs.size) return false
  const session = lireSessionSauvee()
  if (!precedenteInterrompue) return rouvrirSession(session)
  if (ongletsARestaurer(session).onglets.length) sessionProposee = session
  return false
}

function proposerRestauration() {
  envoyerAuxInterfaces('browser:restore-offer', sessionProposee !== null)
}

function repondreRestauration(reponse: RestoreAnswer) {
  const session = sessionProposee
  if (!session) return
  sessionProposee = null
  if (reponse === 'restore') {
    const demarrage = ongletDeDemarrage ? tabs.get(ongletDeDemarrage) : undefined
    const inutilise = demarrage && tabs.size === 1 && !demarrage.view.webContents.canGoBack()
    if (rouvrirSession(session) && inutilise) closeTab(demarrage.data.id, false)
  }
  proposerRestauration()
  // La session reprend son cours : celle qui est ouverte remplace l'interrompue, restaurée ou ignorée.
  sauvegardeSession.demander()
}

// Ctrl+Maj+T (ARB-20) : rouvre le dernier onglet fermé et l'active. Sans onglet fermé, ne fait rien.
let ongletsFermes: string[] = []
function rouvrirOnglet() {
  const dernier = depiler(ongletsFermes)
  if (!dernier) return
  ongletsFermes = dernier.reste
  createTab(dernier.url)
}

// `memoriser` : faux pour un onglet retiré par Arbalète (onglet de démarrage remplacé par la session), pas par l'utilisateur.
function closeTab(id: string, memoriser = true) {
  const record = tabs.get(id)
  if (!record) return
  if (memoriser) ongletsFermes = empiler(ongletsFermes, record.data.url)
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.contentView.removeChildView(record.view) } catch {}
  }
  record.view.webContents.close()
  const ordre = ongletsVisibles()
  tabs.delete(id)
  ouvertures.delete(id)

  if (activeTabId === id) activeTabId = ongletVoisin(ordre, id)
  // Le dernier onglet de l'espace affiché ferme : un nouvel onglet l'y remplace (les autres espaces gardent les leurs).
  if (!ongletsVisibles().length) createTab()
  else {
    setActiveView()
    broadcastState()
  }
}

// Menu d'un onglet (ARB-41). shortcut: l'épinglage vit en mémoire, il n'est pas écrit dans la session ; à persister avec
// une colonne de la table onglet quand l'épinglage sera un vrai rangement (EP-12).
function actionOnglet(id: string, action: ActionOnglet) {
  const record = tabs.get(id)
  if (!record) return
  if (action === 'dupliquer') {
    // Un onglet en erreur ou sur about:blank n'a pas d'adresse web : createTab en ferait une recherche.
    if (adresseWeb(record.data.url)) createTab(record.data.url)
  } else if (action === 'copier-adresse') {
    if (adresseWeb(record.data.url)) clipboard.writeText(record.data.url)
  } else if (action === 'epingler') {
    record.data.pinned = !record.data.pinned
    broadcastState()
  } else {
    for (const autre of ongletsAFermer([...tabs.values()].filter((t) => t.espace === record.espace).map((t) => t.data), id)) closeTab(autre)
    activerOnglet(id)
  }
}

// Passe à un autre espace (ARB-61) : les onglets de l'espace choisi remplacent ceux affichés et son dernier onglet actif
// reprend la page ; faute d'onglet, un nouvel onglet s'y ouvre. Le choix est conservé au redémarrage.
function changerEspace(id: number) {
  if (id === espaceActif || !espaces.some((espace) => espace.id === id)) return
  if (activeTabId) dernierActif.set(espaceActif, activeTabId)
  espaceActif = id
  fermerSuggestions()
  if (base) {
    try {
      ecrireEspaceActif(base, id)
    } catch (erreur) {
      console.error('Espace actif non enregistré :', erreur)
    }
  }
  const memorise = dernierActif.get(id)
  const visibles = ongletsVisibles()
  const cible = memorise && tabs.get(memorise)?.espace === id ? memorise : visibles[visibles.length - 1]
  if (cible) {
    activerOnglet(cible)
    activeRecord()?.view.webContents.focus()
    broadcastState()
  } else {
    activeTabId = null
    createTab()
  }
}

// Gestion des espaces par l'utilisateur (ARB-62). Sans base (indisponible), il n'y a pas d'espaces à gérer : sans effet.
// Les erreurs de validation (nom vide ou trop long) remontent au renderer par le rejet de l'appel IPC.
function creerEspaceUtilisateur(nom: string) {
  if (!base) return
  const id = creerEspace(base, champsNouvelEspace(espaces, nom))
  espaces = lireEspaces(base)
  changerEspace(id)
}

function renommerEspace(id: number, nom: string) {
  const espace = espaces.find((item) => item.id === id)
  if (!base || !espace) return
  modifierEspace(base, id, { nom, couleur: espace.couleur, icone: espace.icone })
  espaces = lireEspaces(base)
  broadcastState()
}

// Couleur choisie par l'utilisateur (ARB-134) : le texte reçu n'est pas encore une couleur, `modifierEspace` refuse un nom hors de `COULEURS_ESPACE`.
function colorerEspace(id: number, couleur: string) {
  const espace = espaces.find((item) => item.id === id)
  if (!base || !espace) return
  modifierEspace(base, id, { nom: espace.nom, couleur: couleur as CouleurEspace, icone: espace.icone })
  espaces = lireEspaces(base)
  broadcastState()
}

function deplacerEspace(id: number, sens: -1 | 1) {
  if (!base || !espaces.some((item) => item.id === id)) return
  ordonnerEspaces(base, ordreApresDeplacement(espaces.map((item) => item.id), id, sens))
  espaces = lireEspaces(base)
  broadcastState()
}

// Les onglets de l'espace supprimé sont fermés (sans être mémorisés pour Ctrl+Maj+T : ils rouvriraient dans un autre espace).
// Le dernier espace ne se supprime pas : l'interface en a toujours un à afficher. Si l'espace supprimé est affiché, on passe
// d'abord à son voisin (celui de dessous, sinon celui de dessus).
function supprimerEspaceUtilisateur(id: number) {
  const index = espaces.findIndex((item) => item.id === id)
  if (!base || index < 0 || espaces.length < 2) return
  if (id === espaceActif) changerEspace((espaces[index + 1] ?? espaces[index - 1]).id)
  supprimerEspace(base, id)
  espaces = lireEspaces(base)
  dernierActif.delete(id)
  for (const [ongletId, onglet] of [...tabs]) if (onglet.espace === id) closeTab(ongletId, false)
  broadcastState()
}

function activeRecord(): TabRecord | undefined {
  return activeTabId ? tabs.get(activeTabId) : undefined
}

// L'interface est servie par Vite en développement (ELECTRON_RENDERER_URL) et depuis out/renderer en build.
// Lue une seule fois (ARB-105) ; une app empaquetée ignore la variable.
const URL_DEV = lireUrlDev(process.env.ELECTRON_RENDERER_URL, app.isPackaged)
const CHEMIN_URL_INTERFACE = pathToFileURL(CHEMIN_INTERFACE).pathname

function estUrlInterface(url: string): boolean {
  let adresse: URL
  try { adresse = new URL(url) } catch { return false }
  if (URL_DEV) return adresse.origin === URL_DEV.origin
  // L'hôte vide écarte un chemin UNC (file://serveur/...) de même chemin que l'interface.
  return adresse.protocol === 'file:' && adresse.host === '' && adresse.pathname === CHEMIN_URL_INTERFACE
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

function exigerEntier(valeur: unknown): number {
  if (typeof valeur !== 'number' || !Number.isSafeInteger(valeur)) throw new Error('Argument IPC invalide : entier attendu')
  return valeur
}

function exigerSens(valeur: unknown): -1 | 1 {
  if (valeur !== -1 && valeur !== 1) throw new Error('Argument IPC invalide : -1 ou 1 attendu')
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
    backgroundColor: FOND_FENETRE[themeEffectif()],
    title: 'Arbalète',
    // Fenêtre sans cadre (ARB-30) : 'hidden' garde le bord redimensionnable et les dispositions d'accrochage de Windows,
    // que frame: false perdrait ; les boutons natifs sont ceux de titleBarOverlay. La barre de contrôle sert de zone de
    // déplacement (styles.css).
    titleBarStyle: 'hidden',
    titleBarOverlay: overlayBoutons(),
    icon: CHEMIN_ICONE,
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
  // le rend à la page de l'onglet actif. À chaque chargement, pas seulement le premier : une vue rechargée (plantage,
  // HMR) reprend sinon le clavier masquée (ARB-113). Si la fenêtre n'a pas le focus (l'utilisateur est passé à une
  // autre application), focus() la ramènerait au premier plan sous Windows : on attend qu'elle le reprenne d'elle-même
  // (ARB-112).
  const rendreLeFocusALaPage = () => {
    if (!barre.open) activeRecord()?.view.webContents.focus()
  }
  barreView.webContents.on('did-finish-load', () => {
    if (!mainWindow) return
    if (mainWindow.isFocused()) rendreLeFocusALaPage()
    else {
      // Un seul écouteur en attente, même si la barre se recharge plusieurs fois en arrière-plan.
      mainWindow.off('focus', rendreLeFocusALaPage)
      mainWindow.once('focus', rendreLeFocusALaPage)
    }
  })
  // Une vue de la barre rechargée ou plantée n'affiche plus l'overlay : il se ferme, sinon une vue transparente couvrirait
  // la fenêtre et prendrait tous les clics.
  barreView.webContents.on('did-start-loading', fermerOverlay)
  barreView.webContents.on('render-process-gone', fermerOverlay)
  mainWindow.contentView.addChildView(barreView)
  placerBarre()

  mainWindow.on('resize', () => {
    placerPage()
    placerBarre()
    placerRechercheVue()
  })
  // Comme un menu, un overlay se ferme quand la fenêtre perd le focus (Alt+Tab, clic dans une autre application).
  // F11 (ou tout autre retour de la fenêtre à la normale) pendant un plein écran de la page : la page en sort aussi.
  mainWindow.on('leave-full-screen', () => { if (pleinEcranPage) sortirPleinEcranPage(pleinEcranPage) })
  mainWindow.on('blur', () => { if (!boiteFichierOuverte) fermerOverlay() })
  // Avant que les vues des onglets disparaissent : la session écrite est celle que l'utilisateur ferme.
  mainWindow.on('close', () => sauvegardeSession.vider())
  mainWindow.on('closed', () => {
    mainWindow = null
    barreView = null
    apercuView = null
    apercuCharge = false
    apercuVisible = false
    rechercheView = null
    rechercheVisible = false
    rechercheContenu = null
    overlayOuvert = false
    // Les pages en attente d'une réponse sont refusées, sans quoi leur callback reste ouvert et la file bloquée.
    const attente = [invitePermission, ...invitesEnAttente.splice(0)]
    invitePermission = null
    for (const invite of attente) invite?.reponse(false)
  })
  // Les adresses du lancement s'ouvrent après la session restaurée, la dernière au premier plan (ARB-117, ARB-45).
  const restauree = restaurerSession()
  if (adresses.length) adresses.forEach((adresse) => createTab(adresse))
  else if (!restauree || !ongletsVisibles().length) ongletDeDemarrage = createTab()
}

function versIncident(incident: IncidentBase): DataIncident {
  switch (incident.type) {
    case 'corrompue': return { kind: 'corrupted', backup: incident.copie, restored: incident.restauree }
    case 'plus-recente': return { kind: 'newer' }
    case 'indisponible': return { kind: 'unavailable' }
  }
}

function copieDeSecours(options: { seulementSiAncienne?: boolean } = {}) {
  if (!base || !cheminBase || copiesSuspendues) return
  try {
    sauvegarderBase(base, cheminBase, options)
  } catch (erreur) {
    console.error('Copie de secours de la base non écrite :', erreur)
  }
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

  cheminBase = join(app.getPath('userData'), 'arbalete.db')
  const ouverture = ouvrirBaseOuRecuperer(cheminBase)
  base = ouverture.db
  incidentBase = ouverture.incident && versIncident(ouverture.incident)
  if (base) {
    try {
      precedenteInterrompue = noterOuverture(base)
    } catch (erreur) {
      console.error('Ouverture de la session non notée :', erreur)
    }
    // Thème choisi (ARB-59), lu avant la création de la fenêtre pour que son fond natif soit le bon dès le départ.
    try {
      choixTheme = lireTheme(base)
    } catch (erreur) {
      console.error('Thème non relu :', erreur)
    }
    try {
      moteur = lireMoteur(base)
    } catch (erreur) {
      console.error('Moteur de recherche non relu :', erreur)
    }
    // Espaces (ARB-61) : créés au premier lancement, espace affiché relu avant la restauration de la session.
    try {
      semerEspaces(base)
      espaces = lireEspaces(base)
      espaceActif = lireEspaceActif(base, espaces)
    } catch (erreur) {
      console.error('Espaces non relus :', erreur)
    }
    // Mode et largeur de la barre latérale (ARB-123), lus avant la création de la fenêtre.
    try {
      barre = lireBarre(base)
    } catch (erreur) {
      console.error('Barre latérale non relue :', erreur)
    }
    // Historique des téléchargements (ARB-55) : ceux restés actifs à l'arrêt précédent deviennent interrompus.
    telechargements.charger()
    // Une base neuve mise à la place d'une base corrompue sans copie utilisable ne doit pas écraser les copies qui
    // existent encore : aucune copie pendant cette session.
    copiesSuspendues = ouverture.incident?.type === 'corrompue' && !ouverture.incident.restauree
    // Copie de secours peu après le démarrage, si la dernière a plus de 24 h : une session qui ne se ferme jamais
    // normalement en a une, et la première fenêtre n'attend pas la copie.
    setTimeout(() => copieDeSecours({ seulementSiAncienne: true }), 30_000)
  }

  // ARB-15 : plein écran, caméra, micro, notifications et position se décident par site (hôte de la page de l'onglet, pas
  // celui d'un sous-cadre) ; tout le reste, et toute vue qui n'est pas la page de l'onglet actif, reste refusé.
  session.defaultSession.setPermissionRequestHandler((contenu, permission, callback, details) => {
    const permissions = permissionsDemandees(permission, details as { mediaTypes?: string[] })
    const hote = hoteZoom(contenu.getURL())
    if (!permissions || !hote) return callback(false)
    // Seule la page de l'onglet actif décide (ni vue d'interface, ni onglet masqué) ; un sous-cadre d'un autre site
    // n'hérite jamais du choix de la page, sauf le plein écran (vidéo intégrée), accordé d'office.
    if (contenu !== activeRecord()?.view.webContents) return callback(false)
    if (hoteZoom(details.requestingUrl ?? '') !== hote && permissions.some((p) => p !== 'plein-ecran')) return callback(false)
    const decision = decisionSite(hote, permissions)
    if (decision !== 'demander') return callback(decision === 'autoriser')
    // Mêmes hôte et permissions déjà en attente : une seule invite, qui répond aux deux demandes. File plafonnée.
    const cle = permissions.join()
    const existante = [invitePermission, ...invitesEnAttente].find((i) => i && i.hote === hote && i.permissions.join() === cle)
    if (existante) {
      const premiere = existante.reponse
      existante.reponse = (accordee) => { premiere(accordee); callback(accordee) }
      return
    }
    if (invitesEnAttente.length >= 5) return callback(false)
    invitesEnAttente.push({ hote, permissions, reponse: callback })
    afficherInvitePermission()
  })
  // Le refus vaut aussi pour les vérifications (navigator.permissions, accès sans demande) et les périphériques
  // (ARB-120) : sans ces gestionnaires, Electron les accorde et les pages se voient tout permis.
  // Téléchargements (ARB-55) : un échec (dossier illisible…) annule le téléchargement sans faire tomber le processus.
  session.defaultSession.on('will-download', (_event, item) => {
    try {
      telechargements.nouveau(item)
    } catch (erreur) {
      console.error('Téléchargement refusé :', erreur)
      item.cancel()
    }
  })
  // Une vérification (navigator.permissions, Notification.permission) n'invite jamais : elle ne voit que le choix mémorisé.
  session.defaultSession.setPermissionCheckHandler((contenu, permission, origine, details) => {
    const permissions = permissionsDemandees(permission, details as { mediaType?: string })
    const hote = hoteZoom(contenu?.getURL() || origine)
    // Un sous-cadre d'un autre site ne lit pas le choix de la page.
    const demandeur = hoteZoom((details as { requestingUrl?: string }).requestingUrl || origine)
    if (permissions?.some((p) => p !== 'plein-ecran') && demandeur !== hote) return false
    return !!permissions && !!hote && decisionSite(hote, permissions) === 'autoriser'
  })
  session.defaultSession.setDevicePermissionHandler(() => false)
  session.defaultSession.on('select-hid-device', (event, _details, callback) => {
    event.preventDefault()
    callback()
  })
  session.defaultSession.on('select-serial-port', (event, _portList, _webContents, callback) => {
    event.preventDefault()
    callback('')
  })
  session.defaultSession.on('select-usb-device', (event, _details, callback) => {
    event.preventDefault()
    callback()
  })

  traiter('browser:get-state', () => stateSnapshot())
  traiter('browser:get-system-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  nativeTheme.on('updated', () => {
    envoyerAuxInterfaces('browser:system-theme', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
    appliquerThemeFenetre()
  })
  // Le thème choisi est tenu ici pour que la fenêtre et la barre latérale l'affichent ensemble.
  traiter('browser:get-theme', () => choixTheme)
  traiter('browser:set-theme', (valeur) => appliquerTheme(exigerChoix(valeur, THEMES)))
  traiter('browser:get-search-engine', () => ({ ...moteur }))
  traiter('browser:set-search-engine', (valeur) => appliquerMoteur(choixMoteurValide(valeur)))
  traiter('browser:get-sidebar', () => ({ ...barre }))
  traiter('browser:set-sidebar', (valeur) => agirSurBarre(exigerChoix(valeur, ['open', 'hide', 'toggle-pin', 'toggle-compact'] as const)))
  traiter('browser:set-sidebar-width', (valeur) => {
    if (typeof valeur !== 'number' || !Number.isFinite(valeur)) throw new Error('Argument IPC invalide : nombre attendu')
    appliquerBarre({ ...barre, width: borneLargeurBarre(valeur) })
  })
  traiter('browser:get-overlay', () => overlayOuvert)
  traiter('browser:get-permission-request', () => invitePermission && { hote: invitePermission.hote, permissions: invitePermission.permissions })
  // Seule la vue de la barre, qui affiche l'invite, y répond.
  ipcMain.handle('browser:answer-permission', (event, valeur) => {
    if (!emetteurAutorise(event) || event.sender !== barreView?.webContents) throw new Error('Émetteur IPC non autorisé')
    repondreInvitePermission(exigerChoix(valeur, REPONSES_PERMISSION))
  })
  // Seule la vue de la barre rend les overlays : elle seule peut en ouvrir ou en fermer un (décision 0002).
  ipcMain.handle('browser:set-overlay', (event, valeur) => {
    if (!emetteurAutorise(event) || event.sender !== barreView?.webContents) throw new Error('Émetteur IPC non autorisé')
    if (typeof valeur !== 'boolean') throw new Error('Argument IPC invalide : booléen attendu')
    if (valeur) ouvrirOverlay()
    else {
      const liste = suggestions !== null
      fermerOverlay()
      // Un clic hors de la liste a donné le focus à la vue de la barre : le clavier revient à la fenêtre et à son champ.
      if (liste && mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) mainWindow.webContents.focus()
    }
  })
  traiter('browser:create-tab', (url) => createTab(url === undefined ? undefined : exigerTexte(url)))
  traiter('browser:close-tab', (id) => closeTab(exigerTexte(id)))
  traiter('browser:tab-action', (id, action) => {
    if (!estActionOnglet(action)) throw new Error('Argument IPC invalide : action inconnue')
    actionOnglet(exigerTexte(id), action)
  })
  // Réordonner (ARB-68) : l'index vise la liste de l'espace affiché ; la Map, et donc la session écrite, suit l'ordre.
  traiter('browser:move-tab', (id, index) => {
    const nouveau = reordonnerOnglets(tabs, ongletsVisibles(), exigerTexte(id), exigerEntier(index))
    tabs.clear()
    for (const [cle, record] of nouveau) tabs.set(cle, record)
    broadcastState()
  })
  traiter('browser:activate-tab', (valeur) => {
    const id = exigerTexte(valeur)
    activerOnglet(id)
  })
  traiter('browser:navigate', (valeur) => {
    naviguer(exigerTexte(valeur))
    fermerSuggestions()
  })
  // Suggestions de la barre d'adresse (ARB-53). Le texte et les flèches viennent du champ, donc de la fenêtre seule ; la
  // vue de la barre n'affiche et ne fait que choisir une ligne (clic).
  const exigerFenetre = (event: IpcMainInvokeEvent) => {
    if (!emetteurAutorise(event) || event.sender !== mainWindow?.webContents) throw new Error('Émetteur IPC non autorisé')
  }
  ipcMain.handle('browser:suggest', (event, texte, ancre) => {
    exigerFenetre(event)
    const recherche = texteSuggestion(texte)
    const { width, height } = mainWindow!.getContentBounds()
    const zone = borner(ancre, width, height)
    if (!zone) throw new Error('Argument IPC invalide : rectangle attendu')
    proposerSuggestions(recherche, zone)
  })
  ipcMain.handle('browser:suggest-move', (event, pas) => {
    exigerFenetre(event)
    if (pas !== 1 && pas !== -1) throw new Error('Argument IPC invalide : 1 ou -1 attendu')
    if (!suggestions) return
    suggestions = { ...suggestions, selection: deplacerSelection(suggestions.selection, suggestions.items.length, pas) }
    envoyerAuxInterfaces('browser:suggestions', suggestions)
  })
  ipcMain.handle('browser:suggest-close', (event) => {
    exigerFenetre(event)
    fermerSuggestions()
  })
  // Un clic dans la vue de la barre (ligne donnée) ou Entrée dans le champ (ligne choisie aux flèches, sinon rien à faire).
  // Rend vrai si une ligne a été ouverte : sinon (liste déjà remplacée, aucune ligne choisie), le champ navigue lui-même.
  traiter('browser:suggest-choose', (valeur) => {
    if (!suggestions) return false
    const index = valeur === undefined ? indexValide(suggestions.selection, suggestions.items.length) : indexValide(valeur, suggestions.items.length)
    if (index === undefined) return false
    const url = suggestions.items[index].url
    fermerSuggestions()
    naviguer(url)
    activeRecord()?.view.webContents.focus()
    return true
  })
  traiter('browser:get-suggestions', () => suggestions)
  // Palette de commandes (ARB-67) : seule la vue de la barre, qui l'affiche et porte son champ, l'ouvre, cherche et choisit.
  const exigerBarre = (event: IpcMainInvokeEvent) => {
    if (!emetteurAutorise(event) || event.sender !== barreView?.webContents) throw new Error('Émetteur IPC non autorisé')
  }
  traiter('browser:get-palette', () => palette)
  ipcMain.handle('browser:open-palette', (event) => { exigerBarre(event); ouvrirPalette() })
  ipcMain.handle('browser:palette-search', (event, texte) => {
    exigerBarre(event)
    const recherche = texteSuggestion(texte)
    if (!palette) return
    palette = entreesPalette(recherche)
    envoyerAuxInterfaces('browser:palette', palette)
  })
  ipcMain.handle('browser:palette-choose', (event, index, cle) => {
    exigerBarre(event)
    const rang = indexValide(index, palette?.length ?? 0)
    if (rang !== undefined && typeof cle === 'string') choisirPalette(rang, cle)
  })
  // Panneau Historique (ARB-52) : lu à la demande de la vue de la barre, qui l'affiche ; ouvrir une page ne vaut que pour une
  // page déjà visitée (son adresse web d'historique), jamais pour une adresse que l'interface inventerait.
  ipcMain.handle('browser:search-history', (event, texte) => {
    exigerBarre(event)
    const recherche = texteSuggestion(texte)
    if (!recherche && texte.trim()) return [] // texte trop long : rien, pas tout l'historique
    try { return base ? listerHistorique(base, recherche) : [] } catch (erreur) { console.error('Historique non lu :', erreur); return [] }
  })
  ipcMain.handle('browser:open-history-page', (event, url) => {
    exigerBarre(event)
    if (typeof url !== 'string' || !adresseWeb(url) || !base || !lirePage(base, url)) return
    fermerOverlay()
    createTab(url)
    activeRecord()?.view.webContents.focus()
  })
  // Panneau des favoris (ARB-48) : lu et modifié par la vue de la barre seule ; les arguments sont validés ici, une
  // écriture qui échoue remonte à la modale, et la grille de la barre latérale suit (broadcastState).
  const favorisBase = <T>(travail: (db: NonNullable<typeof base>) => T): T => {
    if (!base) throw new Error('Base indisponible')
    return travail(base)
  }
  ipcMain.handle('browser:list-favorites', (event) => {
    exigerBarre(event)
    try { return base ? listerFavoris(base) : { dossiers: [], favoris: [] } } catch (erreur) { console.error('Favoris non lus :', erreur); return { dossiers: [], favoris: [] } }
  })
  const ecritureFavoris = (canal: string, ecrire: (db: NonNullable<typeof base>, ...args: unknown[]) => unknown) =>
    ipcMain.handle(canal, (event, ...args) => {
      exigerBarre(event)
      favorisBase((db) => ecrire(db, ...args))
      broadcastState()
    })
  ecritureFavoris('browser:create-favorite-folder', (db, nom) => creerDossier(db, nom))
  ecritureFavoris('browser:rename-favorite-folder', (db, id, nom) => renommerDossier(db, exigerEntier(id), nom))
  ecritureFavoris('browser:delete-favorite-folder', (db, id) => supprimerDossier(db, exigerEntier(id)))
  ecritureFavoris('browser:move-favorite', (db, id, dossier) => deplacerFavori(db, exigerEntier(id), dossier === null ? null : exigerEntier(dossier)))
  ecritureFavoris('browser:remove-favorite', (db, id) => retirerFavori(db, exigerEntier(id)))
  // Import des favoris (ARB-50) : le fichier HTML exporté par Chrome ou Edge, choisi dans une boîte système ; renvoie le
  // nombre de favoris ajoutés, null si l'utilisateur annule. Le chemin vient de la boîte, jamais de l'interface.
  ipcMain.handle('browser:import-favorites', async (event) => {
    exigerBarre(event)
    if (boiteFichierOuverte) return null
    // La boîte prend le focus : sans ce drapeau, le blur de la fenêtre fermerait le panneau sous elle.
    boiteFichierOuverte = true
    let choix
    try {
      choix = await (mainWindow ? dialog.showOpenDialog(mainWindow, { title: 'Importer des favoris', properties: ['openFile'], filters: [{ name: 'Favoris HTML', extensions: ['html', 'htm'] }] })
        : dialog.showOpenDialog({ properties: ['openFile'] }))
    } finally { boiteFichierOuverte = false }
    if (choix.canceled || choix.filePaths.length === 0) return null
    const chemin = choix.filePaths[0]
    if (statSync(chemin).size > TAILLE_MAX_IMPORT) throw new Error('Fichier trop volumineux')
    const ajoutes = favorisBase((db) => importerFavoris(db, lireFavorisHtml(readFileSync(chemin, 'utf8'))))
    broadcastState()
    return ajoutes
  })
  // Effacer les données de navigation (ARB-54) : période et types viennent de listes fermées, validés ici.
  // shortcut: Electron ne date pas les cookies ni le cache, ils sont effacés en entier quelle que soit la période ; à revoir
  // avec un filtre par date si l'API le permet.
  // shortcut: l'historique effacé reste lisible dans les copies de secours de la base (jusqu'à leur réécriture, 24 h) et le
  // WAL ; les onglets fermés, la session, les téléchargements et le stockage des sites (localStorage, IndexedDB) ne sont pas
  // touchés ; à traiter dans un ticket de suivi avant toute promesse de confidentialité.
  ipcMain.handle('browser:clear-browsing-data', async (event, periode, types) => {
    exigerBarre(event)
    if (!PERIODES_EFFACEMENT.includes(periode) || !Array.isArray(types) || types.length > TYPES_EFFACEMENT.length
      || !types.every((type) => TYPES_EFFACEMENT.includes(type))) throw new Error('Argument IPC invalide : période et types attendus')
    const choisis = new Set<TypeEffacement>(types)
    if (choisis.has('historique') && base) effacerHistorique(base, debutEffacement(periode as PeriodeEffacement))
    // Chaque type est tenté même si un autre échoue ; l'échec est rendu à l'interface, qui relit la liste.
    const echecs = (await Promise.allSettled([
      choisis.has('cookies') ? session.defaultSession.clearStorageData({ storages: ['cookies'] }) : undefined,
      choisis.has('cache') ? session.defaultSession.clearCache() : undefined
    ])).filter((r) => r.status === 'rejected')
    if (echecs.length) throw new Error('Effacement incomplet : cookies ou cache')
  })
  // Menu contextuel d'une page (ARB-40) : seule la vue de la barre, qui l'affiche, choisit une entrée.
  traiter('browser:get-page-menu', () => menuPage && { x: menuPage.x, y: menuPage.y, entrees: menuPage.entrees })
  ipcMain.handle('browser:page-menu-action', (event, valeur) => {
    if (!emetteurAutorise(event) || event.sender !== barreView?.webContents) throw new Error('Émetteur IPC non autorisé')
    if (!entreeMenuPageValide(valeur)) throw new Error('Argument IPC invalide : entrée de menu attendue')
    agirSurMenuPage(valeur)
  })
  traiter('browser:back', reculer)
  traiter('browser:forward', avancer)
  traiter('browser:reload', () => recharger(false))
  traiter('browser:toggle-favorite', basculerFavoriActif)
  traiter('browser:open-favorite', (url) => ouvrirFavori(exigerTexte(url)))
  traiter('browser:set-workspace', (id) => changerEspace(exigerEntier(id)))
  traiter('browser:create-workspace', (nom) => creerEspaceUtilisateur(exigerTexte(nom)))
  traiter('browser:rename-workspace', (id, nom) => renommerEspace(exigerEntier(id), exigerTexte(nom)))
  traiter('browser:set-workspace-color', (id, couleur) => colorerEspace(exigerEntier(id), exigerTexte(couleur)))
  traiter('browser:move-workspace', (id, sens) => deplacerEspace(exigerEntier(id), exigerSens(sens)))
  traiter('browser:delete-workspace', (id) => supprimerEspaceUtilisateur(exigerEntier(id)))
  traiter('browser:get-downloads', () => telechargements.liste())
  traiter('browser:pause-download', (id) => telechargements.pause(exigerEntier(id)))
  traiter('browser:resume-download', (id) => telechargements.reprendre(exigerEntier(id)))
  traiter('browser:cancel-download', (id) => telechargements.annuler(exigerEntier(id)))
  traiter('browser:open-download', (id) => telechargements.ouvrir(exigerEntier(id)))
  traiter('browser:reveal-download', (id) => telechargements.reveler(exigerEntier(id)))
  traiter('browser:remove-download', (id) => telechargements.retirer(exigerEntier(id)))
  traiter('browser:get-restore-offer', () => sessionProposee !== null)
  traiter('browser:get-data-incident', () => incidentBase)
  traiter('browser:dismiss-data-incident', () => {
    incidentBase = null
    envoyerAuxInterfaces('browser:data-incident', null)
  })
  traiter('browser:answer-restore-offer', (valeur) => repondreRestauration(exigerChoix(valeur, ['restore', 'dismiss'] as const)))
  ipcMain.on('browser:set-content-bounds', (event, bounds) => {
    if (!emetteurAutorise(event)) return
    if (!mainWindow || mainWindow.isDestroyed()) return
    const { width, height } = mainWindow.getContentBounds()
    const borne = borner(bounds, width, height)
    if (!borne) return
    contentBounds = borne
    placerPage()
    placerApercuVue()
    placerRechercheVue()
  })
  // Recherche dans la page (ARB-70) : seule sa vue la pilote, comme seule la vue de la barre pilote les overlays.
  const exigerRecherche = (event: IpcMainInvokeEvent) => {
    if (!emetteurAutorise(event) || event.sender !== rechercheView?.webContents) throw new Error('Émetteur IPC non autorisé')
  }
  ipcMain.handle('browser:find', (event, texte, avant, suivant) => {
    exigerRecherche(event)
    const recherche = texteRecherche(texte)
    if (typeof avant !== 'boolean' || typeof suivant !== 'boolean') throw new Error('Argument IPC invalide : booléen attendu')
    if (!rechercheContenu || rechercheContenu.isDestroyed()) return
    if (recherche) rechercheContenu.findInPage(recherche, { forward: avant, findNext: suivant })
    else rechercheContenu.stopFindInPage('clearSelection')
  })
  ipcMain.handle('browser:find-close', (event) => {
    exigerRecherche(event)
    fermerRecherche(true)
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
  sauvegardeBarre.vider()
  // Après la dernière écriture : la note d'ouverture effacée, le prochain démarrage sait la fermeture normale (ARB-46).
  try {
    if (base) noterFermetureNormale(base)
  } catch (erreur) {
    console.error('Fermeture de la session non notée :', erreur)
  }
  telechargements.apresFermeture()
  copieDeSecours()
  base?.close()
  base = null
})

import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import type { Telechargement } from '../shared/telechargements.ts'
import { ouvrirBase } from './donnees/base.ts'
import { lireTelechargements } from './donnees/telechargements.ts'
import { ACTIFS_MAX, INTERVALLE_PROGRESSION_MS, creerGestionnaire, type Article } from './gestionnaireTelechargements.ts'

// Tests unitaires du gestionnaire des téléchargements (ARB-55), avec un faux DownloadItem.

class FauxArticle extends EventEmitter {
  recu = 0
  total = 1000
  pause_ = false
  reprenable = true
  chemin = ''
  annule = false
  url: string
  nom: string
  constructor(url = 'https://example.com/f.zip', nom = 'f.zip') {
    super()
    this.url = url
    this.nom = nom
  }
  getURL() { return this.url }
  getFilename() { return this.nom }
  getTotalBytes() { return this.total }
  getReceivedBytes() { return this.recu }
  setSavePath(chemin: string) { this.chemin = chemin }
  isPaused() { return this.pause_ }
  canResume() { return this.reprenable }
  pause() { this.pause_ = true }
  resume() { this.pause_ = false }
  cancel() { this.annule = true; this.emit('done', {}, 'cancelled') }
}

function monter(options: { existe?: (chemin: string) => boolean } = {}) {
  const db = ouvrirBase(':memory:')
  let horloge = 1_000_000
  const diffusions: Telechargement[][] = []
  const ouverts: string[] = []
  const reveles: string[] = []
  const gestionnaire = creerGestionnaire({
    dossier: () => 'D', base: () => db, diffuser: (liste) => diffusions.push(liste), maintenant: () => horloge,
    existe: options.existe ?? (() => false), ouvrir: (chemin) => ouverts.push(chemin), reveler: (chemin) => reveles.push(chemin)
  })
  return { db, gestionnaire, diffusions, ouverts, reveles, avancer: (ms: number) => { horloge += ms } }
}

const demarrer = (g: ReturnType<typeof monter>['gestionnaire'], article: FauxArticle) => g.nouveau(article as unknown as Article)

test('un téléchargement va au dossier, sous un nom sûr et libre, sans invite', () => {
  const { gestionnaire, db } = monter({ existe: (chemin) => chemin === 'D\\f.zip' })
  // Identifiants factices, assemblés pour ne pas ressembler à un secret dans le dépôt.
  const article = new FauxArticle(`https://${'u'}:${'p'}@example.com/f.zip#x`, '..\\f.zip')
  demarrer(gestionnaire, article)
  strictEqual(article.chemin, 'D\\.._f.zip')
  const [ligne] = gestionnaire.liste()
  deepStrictEqual([ligne.nom, ligne.url, ligne.etat, ligne.total], ['.._f.zip', 'https://example.com/f.zip', 'en-cours', 1000])
  strictEqual(lireTelechargements(db).length, 1)
})

test('la progression est limitée à une diffusion par intervalle, sauf changement d’état', () => {
  const { gestionnaire, diffusions, avancer } = monter()
  const article = new FauxArticle()
  demarrer(gestionnaire, article)
  strictEqual(diffusions.length, 1)
  article.recu = 100
  article.emit('updated', {}, 'progressing')
  strictEqual(diffusions.length, 1)
  strictEqual(gestionnaire.liste()[0].recu, 100)
  avancer(INTERVALLE_PROGRESSION_MS)
  article.recu = 200
  article.emit('updated', {}, 'progressing')
  strictEqual(diffusions.length, 2)
  article.pause_ = true
  article.emit('updated', {}, 'progressing')
  strictEqual(diffusions.length, 3)
  strictEqual(gestionnaire.liste()[0].etat, 'en-pause')
})

test('pause puis reprise changent l’état ; une reprise impossible ne fait rien', () => {
  const { gestionnaire } = monter()
  const article = new FauxArticle()
  demarrer(gestionnaire, article)
  const { id } = gestionnaire.liste()[0]
  gestionnaire.pause(id)
  strictEqual(article.pause_, true)
  strictEqual(gestionnaire.liste()[0].etat, 'en-pause')
  article.reprenable = false
  gestionnaire.reprendre(id)
  strictEqual(gestionnaire.liste()[0].etat, 'en-pause')
  article.reprenable = true
  gestionnaire.reprendre(id)
  strictEqual(article.pause_, false)
  strictEqual(gestionnaire.liste()[0].etat, 'en-cours')
})

test('annuler, terminer ou perdre la connexion donnent leur état final, écrit en base', () => {
  const { gestionnaire, db } = monter()
  const [a, b, c] = [new FauxArticle(), new FauxArticle(), new FauxArticle()]
  for (const article of [a, b, c]) demarrer(gestionnaire, article)
  const [idC, idB, idA] = gestionnaire.liste().map((t) => t.id)
  gestionnaire.annuler(idA)
  b.recu = 1000
  b.emit('done', {}, 'completed')
  c.emit('done', {}, 'interrupted')
  const etats = new Map(lireTelechargements(db).map((t) => [t.id, t.etat]))
  deepStrictEqual([etats.get(idA), etats.get(idB), etats.get(idC)], ['annule', 'termine', 'interrompu'])
  strictEqual(gestionnaire.liste().find((t) => t.id === idB)?.recu, 1000)
  // Terminés : plus rien à mettre en pause ni à annuler.
  gestionnaire.pause(idB)
  strictEqual(b.pause_, false)
})

test('une coupure du réseau met en pause, reprenable', () => {
  const { gestionnaire } = monter()
  const article = new FauxArticle()
  demarrer(gestionnaire, article)
  article.emit('updated', {}, 'interrupted')
  strictEqual(gestionnaire.liste()[0].etat, 'en-pause')
})

test('retirer ne touche qu’un téléchargement terminé', () => {
  const { gestionnaire, db } = monter()
  const actif = new FauxArticle()
  const fini = new FauxArticle()
  demarrer(gestionnaire, actif)
  demarrer(gestionnaire, fini)
  fini.emit('done', {}, 'completed')
  const [idFini, idActif] = gestionnaire.liste().map((t) => t.id)
  gestionnaire.retirer(idActif)
  strictEqual(gestionnaire.liste().length, 2)
  gestionnaire.retirer(idFini)
  deepStrictEqual(gestionnaire.liste().map((t) => t.id), [idActif])
  deepStrictEqual(lireTelechargements(db).map((t) => t.id), [idActif])
})

test('un schéma refusé ou trop de téléchargements actifs sont annulés sans entrer dans la liste', () => {
  const { gestionnaire } = monter()
  const fichier = new FauxArticle('file:///C:/secret.txt')
  demarrer(gestionnaire, fichier)
  strictEqual(fichier.annule, true)
  for (let i = 0; i < ACTIFS_MAX; i++) demarrer(gestionnaire, new FauxArticle())
  const trop = new FauxArticle()
  demarrer(gestionnaire, trop)
  strictEqual(trop.annule, true)
  strictEqual(gestionnaire.liste().length, ACTIFS_MAX)
})

test('au chargement, l’historique revient, les téléchargements actifs interrompus, et les ids continuent', () => {
  const premiere = monter()
  const article = new FauxArticle()
  demarrer(premiere.gestionnaire, article)
  const second = creerGestionnaire({ dossier: () => 'D', base: () => premiere.db, diffuser: () => undefined, existe: () => false, ouvrir: () => undefined, reveler: () => undefined })
  second.charger()
  deepStrictEqual(second.liste().map((t) => [t.id, t.etat]), [[1, 'interrompu']])
  demarrer(second, new FauxArticle())
  strictEqual(second.liste()[0].id, 2)
})

test('sans base, les téléchargements marchent en mémoire', () => {
  const gestionnaire = creerGestionnaire({ dossier: () => 'D', base: () => null, diffuser: () => undefined, existe: () => false, ouvrir: () => undefined, reveler: () => undefined })
  gestionnaire.charger()
  const article = new FauxArticle()
  demarrer(gestionnaire, article)
  article.emit('done', {}, 'completed')
  strictEqual(gestionnaire.liste()[0].etat, 'termine')
})

// Value: protects=deux téléchargements simultanés du même nom ne visent pas le même fichier; fails_when=cheminLibre ne regarde plus les téléchargements actifs (le fichier n'existe pas encore sur le disque); why_new=le test du nom pris simule le disque, pas un second téléchargement avant le premier octet; seam=none; no_claim=le comportement réel d'Electron sur setSavePath (C78 couvre un second téléchargement après le premier).
test('deux téléchargements simultanés du même nom reçoivent des chemins distincts', () => {
  const { gestionnaire } = monter()
  const [a, b, c] = [new FauxArticle(), new FauxArticle(), new FauxArticle()]
  for (const article of [a, b, c]) demarrer(gestionnaire, article)
  deepStrictEqual([a.chemin, b.chemin, c.chemin], ['D\\f.zip', 'D\\f (1).zip', 'D\\f (2).zip'])
  // Annulé, un nom se libère pour le suivant.
  b.emit('done', {}, 'cancelled')
  const d = new FauxArticle()
  demarrer(gestionnaire, d)
  strictEqual(d.chemin, 'D\\f (1).zip')
})

// Value: protects=une interruption sans reprise possible rend l'emplacement et passe à interrompu; fails_when=la ligne reste en pause (reprise sans effet) ou garde son emplacement actif; why_new=le test de coupure réseau ne couvre que le cas reprenable; seam=none; no_claim=le comportement réel de DownloadItem.canResume.
test('une interruption qui ne se reprend pas est définitive et libère son emplacement', () => {
  const { gestionnaire } = monter()
  const article = new FauxArticle()
  demarrer(gestionnaire, article)
  article.reprenable = false
  article.emit('updated', {}, 'interrupted')
  strictEqual(gestionnaire.liste()[0].etat, 'interrompu')
  gestionnaire.pause(gestionnaire.liste()[0].id)
  strictEqual(article.pause_, false)
  for (let i = 0; i < ACTIFS_MAX; i++) demarrer(gestionnaire, new FauxArticle())
  strictEqual(gestionnaire.liste().length, ACTIFS_MAX + 1)
})

// Value: protects=la liste ne grossit pas sans fin et oublie les plus anciens terminés, jamais un actif; fails_when=l'élagage est retiré ou retire un téléchargement actif; why_new=l'élagage au démarrage ne couvre pas une session longue; seam=none; no_claim=aucune pression mémoire réelle.
test('la liste est limitée à 200 lignes : les plus anciens terminés sont oubliés', () => {
  const { gestionnaire, db } = monter()
  const premier = new FauxArticle()
  demarrer(gestionnaire, premier)
  const idPremier = gestionnaire.liste()[0].id
  premier.emit('done', {}, 'completed')
  const actif = new FauxArticle()
  demarrer(gestionnaire, actif)
  const idActif = gestionnaire.liste()[0].id
  for (let i = 0; i < 205; i++) {
    const article = new FauxArticle()
    demarrer(gestionnaire, article)
    article.emit('done', {}, 'completed')
  }
  strictEqual(gestionnaire.liste().length, 200)
  strictEqual(gestionnaire.liste().some((t) => t.id === idPremier), false)
  strictEqual(gestionnaire.liste().some((t) => t.id === idActif), true)
  strictEqual(lireTelechargements(db).length, 200)
})

// Value: protects=une base qui lève à l'écriture ne casse ni le téléchargement ni la liste en mémoire; fails_when=le try/catch d'ecrire est retiré ou la liste dépend de l'écriture; why_new=le seul cas sans base testé est base()=>null, pas une base qui lève; seam=none; no_claim=une vraie erreur SQLite (table supprimée simulée).
test('une base qui échoue n’empêche pas le téléchargement', () => {
  const { gestionnaire, db } = monter()
  db.exec('DROP TABLE telechargement')
  let erreurs = 0
  const consoleErreur = console.error
  console.error = () => { erreurs++ }
  try {
    const article = new FauxArticle()
    demarrer(gestionnaire, article)
    article.emit('done', {}, 'completed')
    strictEqual(gestionnaire.liste()[0].etat, 'termine')
  } finally {
    console.error = consoleErreur
  }
  strictEqual(erreurs > 0, true)
})

// Value: protects=un téléchargement actif à la fermeture d'Arbalète est relu interrompu au lancement suivant; fails_when=apresFermeture est vidée ou n'écrit pas l'état; why_new=charger() ne teste que le démarrage; seam=none; no_claim=l'appel réel dans will-quit (index.ts, sans test de redémarrage).
test('apresFermeture marque les téléchargements actifs interrompus en base', () => {
  const { gestionnaire, db } = monter()
  demarrer(gestionnaire, new FauxArticle())
  gestionnaire.apresFermeture()
  strictEqual(lireTelechargements(db)[0].etat, 'interrompu')
})

// Value: protects=les ids continuent après l'historique même si sa lecture échoue; fails_when=charger repart de 1 quand lireTelechargements lève; why_new=le test de reprise ne simule pas l'échec de lecture; seam=none; no_claim=une vraie corruption de la table.
test('après un échec de lecture de l’historique, les ids continuent après le dernier', () => {
  const premiere = monter()
  demarrer(premiere.gestionnaire, new FauxArticle())
  demarrer(premiere.gestionnaire, new FauxArticle())
  const lectureCassee = {
    prepare: (sql: string) => {
      if (sql.startsWith('SELECT *')) throw new Error('lecture impossible')
      return premiere.db.prepare(sql)
    },
    exec: (sql: string) => premiere.db.exec(sql)
  } as unknown as typeof premiere.db
  const consoleErreur = console.error
  console.error = () => undefined
  try {
    const second = creerGestionnaire({ dossier: () => 'D', base: () => lectureCassee, diffuser: () => undefined, existe: () => false, ouvrir: () => undefined, reveler: () => undefined })
    second.charger()
    strictEqual(second.liste().length, 0)
    demarrer(second, new FauxArticle())
    strictEqual(second.liste()[0].id, 3)
  } finally {
    console.error = consoleErreur
  }
})

// Value: protects=la progression d'un téléchargement ne retarde pas celle d'un autre; fails_when=le chrono de diffusion redevient commun à tous les téléchargements; why_new=le test du débit n'en lance qu'un; seam=none; no_claim=le rythme réel des événements d'Electron.
test('la limite de diffusion est propre à chaque téléchargement', () => {
  const { gestionnaire, diffusions, avancer } = monter()
  const [a, b] = [new FauxArticle(), new FauxArticle()]
  demarrer(gestionnaire, a)
  avancer(INTERVALLE_PROGRESSION_MS)
  demarrer(gestionnaire, b)
  const avant = diffusions.length
  avancer(INTERVALLE_PROGRESSION_MS)
  a.recu = 10
  a.emit('updated', {}, 'progressing')
  b.recu = 20
  b.emit('updated', {}, 'progressing')
  strictEqual(diffusions.length, avant + 2)
})

test('ouvrir et afficher dans le dossier : terminé et présent seulement, jamais un exécutable à l’ouverture (ARB-56)', () => {
  let present = true
  // Un fichier n'existe qu'une fois son téléchargement terminé (sinon `cheminLibre` renommerait les suivants).
  const fichiers = new Set<string>()
  const { gestionnaire, ouverts, reveles } = monter({ existe: (chemin) => present && fichiers.has(chemin) })
  const lancer = (nom: string) => {
    const article = new FauxArticle(`https://example.com/${nom}`, nom)
    demarrer(gestionnaire, article)
    return { article, id: gestionnaire.liste()[0].id }
  }
  const pdf = lancer('a.pdf')
  gestionnaire.ouvrir(pdf.id)
  gestionnaire.reveler(pdf.id)
  deepStrictEqual([ouverts, reveles], [[], []])

  fichiers.add('D\\a.pdf')
  pdf.article.emit('done', {}, 'completed')
  gestionnaire.ouvrir(pdf.id)
  gestionnaire.reveler(pdf.id)
  deepStrictEqual([ouverts, reveles], [['D\\a.pdf'], ['D\\a.pdf']])

  const exe = lancer('setup.EXE')
  fichiers.add('D\\setup.EXE')
  exe.article.emit('done', {}, 'completed')
  gestionnaire.ouvrir(exe.id)
  gestionnaire.reveler(exe.id)
  deepStrictEqual([ouverts.length, reveles], [1, ['D\\a.pdf', 'D\\setup.EXE']])

  // Annulé ou interrompu avec un fichier partiel présent : ni ouvert ni montré.
  const annule = lancer('b.pdf')
  fichiers.add('D\\b.pdf')
  annule.article.emit('done', {}, 'cancelled')
  const interrompu = lancer('c.pdf')
  fichiers.add('D\\c.pdf')
  interrompu.article.emit('done', {}, 'interrupted')
  for (const { id } of [annule, interrompu]) { gestionnaire.ouvrir(id); gestionnaire.reveler(id) }
  deepStrictEqual([ouverts.length, reveles.length], [1, 2])

  present = false
  gestionnaire.ouvrir(pdf.id)
  gestionnaire.reveler(pdf.id)
  gestionnaire.ouvrir(9999)
  strictEqual(ouverts.length + reveles.length, 3)
})

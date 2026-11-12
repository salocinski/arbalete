import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { estActif, type EtatTelechargement, type Telechargement } from '../shared/telechargements.ts'
import { TELECHARGEMENTS_GARDES, apresArret, creerTelechargement, dernierId, lireTelechargements, majTelechargement, retirerTelechargement } from './donnees/telechargements.ts'
import { adresseTelechargement, cheminLibre, extensionExecutable, nomFichierSur, schemaAutorise } from './telechargements.ts'

// Gestionnaire des téléchargements (ARB-55, EP-10) : tient la liste en mémoire, la reflète dans la base (au mieux) et la
// diffuse à l'interface. La partie d'Electron qu'il utilise est réduite à `Article`, un DownloadItem pour le gestionnaire,
// un faux dans les tests.

export interface Article {
  getURL(): string
  getFilename(): string
  getTotalBytes(): number
  getReceivedBytes(): number
  setSavePath(chemin: string): void
  isPaused(): boolean
  canResume(): boolean
  pause(): void
  resume(): void
  cancel(): void
  on(evenement: 'updated', ecouteur: (event: unknown, etat: string) => void): unknown
  on(evenement: 'done', ecouteur: (event: unknown, etat: string) => void): unknown
}

// Au plus la moitié du temps d'une image : la progression ne réécrit pas la base ni ne rediffuse à chaque paquet reçu.
export const INTERVALLE_PROGRESSION_MS = 400
// shortcut: plafond fixe de 20 téléchargements actifs, sans invite, sans filtre de type de fichier (un .exe s'enregistre
// comme le reste), sans plafond par site ni de taille totale, et un refus silencieux ; les invites et les permissions par
// site (EP-10) en tiendront lieu, à faire avant l'ouverture du dépôt (ARB-91).
export const ACTIFS_MAX = 20
// shortcut: le chemin complet (dossier + nom) n'est pas borné à 260 caractères : un téléchargement trop long finit
// `interrompu`, sans explication ; à borner avec l'invite « Enregistrer sous » (EP-10).

type Options = {
  // Dossier d'enregistrement, relu à chaque téléchargement (il doit exister).
  dossier: () => string
  base: () => DatabaseSync | null
  diffuser: (liste: Telechargement[]) => void
  maintenant?: () => number
  existe?: (chemin: string) => boolean
  // ARB-56 : `shell.openPath` et `shell.showItemInFolder` d'Electron, injectés pour les tests.
  ouvrir: (chemin: string) => void
  reveler: (chemin: string) => void
}

export function creerGestionnaire({ dossier, base, diffuser, maintenant = Date.now, existe = existsSync, ouvrir, reveler }: Options) {
  let liste: Telechargement[] = []
  const articles = new Map<number, Article>()
  let prochainId = 1
  // Dernière diffusion de chaque téléchargement : la progression de l'un ne retarde pas celle des autres.
  const dernieresDiffusions = new Map<number, number>()

  const ecrire = (action: (db: DatabaseSync) => void) => {
    const db = base()
    if (!db) return
    try {
      action(db)
    } catch (erreur) {
      console.error('Téléchargements non enregistrés :', erreur)
    }
  }

  // `forcer` : changement d'état, toujours écrit et diffusé ; la progression seule l'est au plus toutes les 400 ms.
  const mettreAJour = (id: number, champs: { recu: number; total: number; etat: EtatTelechargement }, forcer = false) => {
    const rang = liste.findIndex((t) => t.id === id)
    if (rang < 0) return
    const changeEtat = liste[rang].etat !== champs.etat
    liste[rang] = { ...liste[rang], ...champs }
    const date = maintenant()
    if (!forcer && !changeEtat && date - (dernieresDiffusions.get(id) ?? 0) < INTERVALLE_PROGRESSION_MS) return
    dernieresDiffusions.set(id, date)
    ecrire((db) => majTelechargement(db, id, champs))
    diffuser([...liste])
  }

  const octets = (article: Article) => ({ recu: article.getReceivedBytes(), total: Math.max(0, article.getTotalBytes()) })

  return {
    // Une fois la base ouverte : l'historique des sessions précédentes, ses téléchargements actifs devenus interrompus.
    charger() {
      // Les ids reprennent après l'historique même si sa lecture échoue : sinon un nouvel id heurterait une ligne existante.
      ecrire((db) => { prochainId = dernierId(db) + 1 })
      ecrire((db) => {
        apresArret(db)
        liste = lireTelechargements(db)
      })
    },

    liste: () => [...liste],

    // Événement `will-download` : enregistre le fichier dans le dossier, sous un nom sûr et libre, sans invite.
    nouveau(article: Article) {
      if (!schemaAutorise(article.getURL()) || articles.size >= ACTIFS_MAX) {
        article.cancel()
        return
      }
      // Le fichier n'existe pas encore sur le disque quand un second téléchargement du même nom arrive : les chemins des
      // téléchargements actifs comptent comme pris, sinon les deux écriraient dans le même fichier.
      const pris = (candidat: string) => existe(candidat) || liste.some((t) => t.chemin === candidat && estActif(t.etat))
      const chemin = cheminLibre(dossier(), nomFichierSur(article.getFilename()), pris)
      article.setSavePath(chemin)
      const telechargement: Telechargement = {
        id: prochainId++, url: adresseTelechargement(article.getURL()), nom: basename(chemin), chemin,
        ...octets(article), etat: 'en-cours', date: maintenant()
      }
      liste = [telechargement, ...liste]
      // La liste ne grossit pas sans fin : au-delà de la limite, les plus anciens téléchargements terminés sont oubliés.
      const surplus = liste.length - TELECHARGEMENTS_GARDES
      if (surplus > 0) {
        const oublies = liste.filter((t) => !estActif(t.etat)).slice(-surplus)
        liste = liste.filter((t) => !oublies.includes(t))
        ecrire((db) => oublies.forEach((t) => retirerTelechargement(db, t.id)))
      }
      articles.set(telechargement.id, article)
      ecrire((db) => creerTelechargement(db, telechargement))
      dernieresDiffusions.set(telechargement.id, telechargement.date)
      diffuser([...liste])

      // Une coupure réseau laisse le téléchargement reprenable : il passe en pause, l'utilisateur le reprend.
      // Une interruption qui ne se reprend pas est définitive : sans quoi la ligne offrirait une reprise sans effet et garderait son emplacement actif.
      article.on('updated', (_event, etat) => {
        if (etat === 'interrupted' && !article.canResume()) {
          articles.delete(telechargement.id)
          mettreAJour(telechargement.id, { ...octets(article), etat: 'interrompu' }, true)
          dernieresDiffusions.delete(telechargement.id)
          return
        }
        mettreAJour(telechargement.id, { ...octets(article), etat: etat === 'interrupted' || article.isPaused() ? 'en-pause' : 'en-cours' })
      })
      article.on('done', (_event, etat) => {
        articles.delete(telechargement.id)
        const termine = etat === 'completed'
        mettreAJour(telechargement.id, { ...octets(article), etat: termine ? 'termine' : etat === 'cancelled' ? 'annule' : 'interrompu' }, true)
        dernieresDiffusions.delete(telechargement.id)
      })
    },

    pause(id: number) {
      const article = articles.get(id)
      if (!article) return
      article.pause()
      mettreAJour(id, { ...octets(article), etat: 'en-pause' }, true)
    },

    reprendre(id: number) {
      const article = articles.get(id)
      if (!article?.canResume()) return
      article.resume()
      mettreAJour(id, { ...octets(article), etat: 'en-cours' }, true)
    },

    // L'état `annule` vient de l'événement `done` que l'annulation déclenche.
    annuler(id: number) {
      articles.get(id)?.cancel()
    },

    // ARB-56 : seul un téléchargement terminé dont le fichier existe encore s'ouvre ou se montre ; le chemin vient de la
    // liste, jamais de l'interface. « Ouvrir » refuse les fichiers exécutables (voir `extensionExecutable`).
    ouvrir(id: number) {
      const ligne = liste.find((t) => t.id === id)
      if (ligne?.etat === 'termine' && existe(ligne.chemin) && !extensionExecutable(ligne.nom)) ouvrir(ligne.chemin)
    },

    reveler(id: number) {
      const ligne = liste.find((t) => t.id === id)
      if (ligne?.etat === 'termine' && existe(ligne.chemin)) reveler(ligne.chemin)
    },

    // Retire une ligne terminée de la liste ; un téléchargement actif reste. Le fichier téléchargé n'est pas touché.
    retirer(id: number) {
      const ligne = liste.find((t) => t.id === id)
      if (!ligne || estActif(ligne.etat)) return
      liste = liste.filter((t) => t.id !== id)
      ecrire((db) => retirerTelechargement(db, id))
      diffuser([...liste])
    },

    // À la fermeture d'Arbalète : Electron annule les téléchargements actifs, la base les garde comme interrompus.
    apresFermeture() {
      ecrire((db) => apresArret(db))
    }
  }
}

import type { DatabaseSync } from 'node:sqlite'
import { enTransaction } from './transaction.ts'

// Historique des visites (ARB-51, EP-09).

// Au-delà, l'adresse n'est pas enregistrée et le titre est tronqué : une page ne doit pas remplir la base.
export const LONGUEUR_MAX_URL = 8192
export const LONGUEUR_MAX_TITRE = 1024

export type PageVisitee = {
  url: string
  titre: string
  visites: number
  derniereVisite: number
}

// Adresse sous laquelle une navigation entre dans l'historique, ou null si elle n'y entre pas. Seules les adresses web
// y vont, sans le nom ni le mot de passe qu'une adresse peut porter avant son hôte, qui resteraient en clair dans la base, ni fragment : une ancre ou
// un changement de #… dans la même page n'est pas une nouvelle visite.
export function adresseHistorique(url: string): string | null {
  if (!/^https?:\/\//i.test(url) || !URL.canParse(url)) return null
  const adresse = new URL(url)
  adresse.username = ''
  adresse.password = ''
  adresse.hash = ''
  return adresse.href.length <= LONGUEUR_MAX_URL ? adresse.href : null
}

// Enregistre une visite de url, déjà passée par adresseHistorique. Un titre vide garde celui déjà connu : il arrive
// d'ordinaire après la navigation, par nommerPage.
export function ajouterVisite(db: DatabaseSync, url: string, titre = '', date = Date.now()): void {
  enTransaction(db, () => {
    const page = db.prepare(`INSERT INTO page (url, titre, visites, derniere_visite) VALUES (?, ?, 1, ?)
      ON CONFLICT (url) DO UPDATE SET
        visites = visites + 1,
        derniere_visite = excluded.derniere_visite,
        titre = CASE WHEN excluded.titre <> '' THEN excluded.titre ELSE titre END
      RETURNING id`).get(url, titre.slice(0, LONGUEUR_MAX_TITRE), date) as { id: number }
    db.prepare('INSERT INTO visite (page, date) VALUES (?, ?)').run(page.id, date)
  })
}

// Donne son titre à une page déjà visitée. Une page inconnue est ignorée : seule une visite crée une page.
export function nommerPage(db: DatabaseSync, url: string, titre: string): void {
  db.prepare('UPDATE page SET titre = ? WHERE url = ?').run(titre.slice(0, LONGUEUR_MAX_TITRE), url)
}

export function lirePage(db: DatabaseSync, url: string): PageVisitee | undefined {
  const ligne = db.prepare('SELECT url, titre, visites, derniere_visite FROM page WHERE url = ?').get(url) as
    { url: string, titre: string, visites: number, derniere_visite: number } | undefined
  return ligne && { url: ligne.url, titre: ligne.titre, visites: ligne.visites, derniereVisite: ligne.derniere_visite }
}

// Recherche pour les suggestions de la barre d'adresse (ARB-53). Chaque mot du texte doit se trouver dans l'adresse ou le
// titre, sans tenir compte de la casse (LIKE, ASCII seulement). Les pages dont l'adresse commence par le premier mot
// (github pour github.com) passent devant, puis les plus visitées, puis les plus récentes.
// shortcut: les accents ne sont pas repliés (é et e diffèrent), et chaque frappe parcourt toute la table (aucune purge de
// l'historique, pas de délai de frappe) : à revoir avec une recherche plein texte ou un index si l'historique devient grand.
export const MOTS_MAX = 5
export const LONGUEUR_MOT_MAX = 64

// Le schéma tapé (https://) est retiré du mot : l'adresse est cherchée sans le sien, sinon « ht » ou « tps » ramèneraient toutes les pages.
function motsDeRecherche(texte: string): string[] {
  return texte.split(/\s+/).map((mot) => mot.replace(/^https?:\/\//i, '')).filter(Boolean)
    .slice(0, MOTS_MAX).map((mot) => mot.slice(0, LONGUEUR_MOT_MAX))
}

// ! protège %, _ et lui-même (ESCAPE '!') : sans lui, « 100% » ou « a_b » chercheraient autre chose que ce qui est tapé.
const echapperLike = (mot: string) => mot.replace(/[!%_]/g, '!$&')

// Une condition par mot : dans l'adresse (sans son schéma) ou le titre. Deux paramètres par mot, le même motif.
const filtreMots = (n: number) => Array(n).fill(`(substr(url, instr(url, '://') + 3) LIKE ? ESCAPE '!' OR titre LIKE ? ESCAPE '!')`).join(' AND ')

export function rechercherPages(db: DatabaseSync, texte: string, limite = 5): PageVisitee[] {
  const mots = motsDeRecherche(texte)
  if (!mots.length) return []
  const motifs = mots.map((mot) => `%${echapperLike(mot)}%`)
  const debut = echapperLike(mots[0])
  const filtre = filtreMots(motifs.length)
  const lignes = db.prepare(`SELECT url, titre, visites, derniere_visite FROM page WHERE ${filtre}
    ORDER BY (url LIKE ? ESCAPE '!' OR url LIKE ? ESCAPE '!' OR url LIKE ? ESCAPE '!') DESC, visites DESC, derniere_visite DESC
    LIMIT ?`).all(
    ...motifs.flatMap((motif) => [motif, motif]),
    `http://${debut}%`, `https://${debut}%`, `%://www.${debut}%`,
    Math.max(0, Math.min(limite, 20))
  ) as Array<{ url: string, titre: string, visites: number, derniere_visite: number }>
  return lignes.map((ligne) => ({ url: ligne.url, titre: ligne.titre, visites: ligne.visites, derniereVisite: ligne.derniere_visite }))
}

// Panneau Historique (ARB-52) : les visites les plus récentes d'abord, filtrées par les mêmes mots que les suggestions (sans
// texte, toutes). Une page visitée plusieurs fois le même jour (heure locale) n'y figure qu'une fois, à sa dernière visite
// de ce jour ; le regroupement par jour lui-même est dans src/shared/historique.ts.
// shortcut: 200 lignes au plus, sans pagination ni suppression d'entrées ; à revoir avec l'effacement par période (ARB-54).
export const HISTORIQUE_MAX = 200

export type VisiteJour = { url: string, titre: string, date: number }

export function listerHistorique(db: DatabaseSync, texte: string, limite = HISTORIQUE_MAX): VisiteJour[] {
  const motifs = motsDeRecherche(texte).map((mot) => `%${echapperLike(mot)}%`)
  return db.prepare(`SELECT url, titre, MAX(visite.date) AS date FROM visite JOIN page ON page.id = visite.page
    ${motifs.length ? `WHERE ${filtreMots(motifs.length)}` : ''}
    GROUP BY page.id, date(visite.date / 1000, 'unixepoch', 'localtime') ORDER BY date DESC LIMIT ?`).all(
    ...motifs.flatMap((motif) => [motif, motif]), Math.max(0, Math.min(limite, HISTORIQUE_MAX))
  ) as VisiteJour[]
}

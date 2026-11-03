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

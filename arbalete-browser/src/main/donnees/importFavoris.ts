import type { DatabaseSync } from 'node:sqlite'
import { LONGUEUR_MAX_NOM_DOSSIER } from '../../shared/favoris.ts'
import { adresseHistorique, LONGUEUR_MAX_TITRE } from './historique.ts'
import { enTransaction } from './transaction.ts'

// Import des favoris (ARB-50, EP-08) depuis le fichier HTML « Netscape » qu'exportent Chrome et Edge.
// shortcut: seul le fichier exporté est lu (pas le profil local) ; les sous-dossiers sont aplatis dans le dossier nommé le
// plus proche (un seul niveau, comme ARB-48) ; à revoir avec les dossiers imbriqués.
export type FavoriImporte = { url: string, titre: string, dossier: string | null }

export const TAILLE_MAX_IMPORT = 20 * 1024 * 1024
const FAVORIS_MAX_IMPORT = 20000

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decoder = (texte: string) => texte.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi, (brut, dec, hex, nom) => {
  if (nom) return ENTITES[nom.toLowerCase()] ?? brut
  const code = dec ? Number(dec) : parseInt(hex, 16)
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : brut
})

// Parcours linéaire des balises <H3> (nom de dossier), <DL> / </DL> (niveau) et <A HREF> (favori). Le HTML n'est jamais
// interprété : seules les adresses web passées par adresseHistorique sont gardées (javascript:, data:, file: écartés).
export function lireFavorisHtml(html: string): FavoriImporte[] {
  const resultat: FavoriImporte[] = []
  const pile: (string | null)[] = []
  let dossierEnAttente: string | null = null
  // Attributs et corps s'arrêtent au prochain « < » (les « < » d'un titre sont encodés &lt; par Chrome et Edge) et sont bornés
  // (ICON= data: jusqu'à 64 Ko, titre 1 100 caractères, déjà tronqué à 1 024) : une balise jamais fermée ne rescanne pas le fichier.
  const jetons = /<h3\b[^<>]{0,65536}>([^<]{0,1100})<\/h3>|<(\/?)dl\b[^<>]{0,65536}>|<a\b([^<>]{0,65536})>([^<]{0,1100})<\/a>/gi
  for (const [, nomDossier, fermeture, attributs, texte] of html.matchAll(jetons)) {
    if (resultat.length >= FAVORIS_MAX_IMPORT) break
    if (nomDossier !== undefined) {
      dossierEnAttente = decoder(nomDossier.replace(/<[^>]*>/g, '')).trim().slice(0, LONGUEUR_MAX_NOM_DOSSIER) || null
    } else if (attributs === undefined) {
      if (fermeture) pile.pop()
      else { pile.push(dossierEnAttente); dossierEnAttente = null }
    } else {
      const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attributs)
      const url = href ? adresseHistorique(decoder((href[1] ?? href[2]).trim())) : null
      if (!url) continue
      const dossier = pile.slice().reverse().find((nom) => nom !== null) ?? null
      resultat.push({ url, titre: decoder(texte.replace(/<[^>]*>/g, '')).trim().slice(0, LONGUEUR_MAX_TITRE), dossier })
    }
  }
  return resultat
}

// Ajoute les favoris absents (même adresse = ignoré) ; un dossier du même nom est réutilisé, sinon créé. Renvoie le nombre
// de favoris ajoutés. Le dossier d'un favori déjà présent n'est pas modifié.
export function importerFavoris(db: DatabaseSync, favoris: FavoriImporte[], date = Date.now()): number {
  return enTransaction(db, () => {
    const dossiers = new Map<string, number>(db.prepare('SELECT nom, id FROM dossier_favori ORDER BY id DESC').all()
      .map((l) => [String(l.nom), Number(l.id)] as [string, number]))
    const ajouter = db.prepare('INSERT OR IGNORE INTO favori (url, titre, date, dossier) VALUES (?, ?, ?, ?)')
    let ajoutes = 0
    for (const { url, titre, dossier } of favoris) {
      let id: number | null = null
      if (dossier !== null) {
        id = dossiers.get(dossier) ?? null
        if (id === null) {
          id = Number(db.prepare('INSERT INTO dossier_favori (nom) VALUES (?)').run(dossier).lastInsertRowid)
          dossiers.set(dossier, id)
        }
      }
      ajoutes += Number(ajouter.run(url, titre, date, id).changes)
    }
    return ajoutes
  })
}

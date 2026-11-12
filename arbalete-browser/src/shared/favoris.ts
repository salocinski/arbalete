// Panneau des favoris (ARB-48) : types partagés entre le processus principal et l'interface.
export const LONGUEUR_MAX_NOM_DOSSIER = 60

export type DossierFavori = { id: number, nom: string }
export type FavoriListe = { id: number, url: string, titre: string, dossier: number | null }
export type ListeFavoris = { dossiers: DossierFavori[], favoris: FavoriListe[] }

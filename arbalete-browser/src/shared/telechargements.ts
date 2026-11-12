// Téléchargements (ARB-55, EP-10) : types et fonctions pures partagés par le processus principal et l'interface.

export const ETATS_TELECHARGEMENT = ['en-cours', 'en-pause', 'termine', 'annule', 'interrompu'] as const
export type EtatTelechargement = (typeof ETATS_TELECHARGEMENT)[number]

// total vaut 0 tant que le serveur n'a pas annoncé la taille ; les dates sont en millisecondes depuis 1970.
export type Telechargement = {
  id: number
  url: string
  nom: string
  chemin: string
  total: number
  recu: number
  etat: EtatTelechargement
  date: number
}

// Un téléchargement actif peut être mis en pause, repris ou annulé ; un autre peut seulement être retiré de la liste.
export function estActif(etat: EtatTelechargement): boolean {
  return etat === 'en-cours' || etat === 'en-pause'
}

// Avancement de 0 à 100, ou null si la taille est inconnue.
export function pourcentage(recu: number, total: number): number | null {
  if (!(total > 0)) return null
  return Math.min(100, Math.max(0, Math.floor((recu / total) * 100)))
}

// « 12,3 Mo », « 850 Ko », « 100 o » : unités binaires affichées à la française.
export function formaterTaille(octets: number): string {
  const unites = ['o', 'Ko', 'Mo', 'Go', 'To']
  let valeur = Math.max(0, octets)
  let rang = 0
  while (valeur >= 1024 && rang < unites.length - 1) {
    valeur /= 1024
    rang++
  }
  const texte = rang === 0 || valeur >= 100 ? String(Math.round(valeur)) : String(Math.round(valeur * 10) / 10).replace('.', ',')
  return `${texte} ${unites[rang]}`
}

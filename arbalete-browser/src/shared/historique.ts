// Panneau Historique (ARB-52) : regroupement des visites par jour, sans accès à Electron ni à la base.
export type VisiteHistorique = { url: string, titre: string, date: number }
export type JourHistorique = { jour: string, visites: VisiteHistorique[] }

const MS_PAR_JOUR = 86_400_000
const debutDuJour = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

// « Aujourd'hui », « Hier », sinon la date en toutes lettres (« mardi 3 novembre », avec l'année hors de l'année en cours).
// Jours calendaires de l'heure locale. `maintenant` est injecté pour les tests.
export function libelleJour(date: number, maintenant = Date.now()): string {
  const jour = debutDuJour(new Date(date))
  const aujourdhui = debutDuJour(new Date(maintenant))
  // Arrondi : un jour de passage à l'heure d'été ou d'hiver fait 23 ou 25 h.
  const ecart = Math.round((aujourdhui.getTime() - jour.getTime()) / MS_PAR_JOUR)
  if (ecart === 0) return 'Aujourd’hui'
  if (ecart === 1) return 'Hier'
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
  if (jour.getFullYear() !== aujourdhui.getFullYear()) options.year = 'numeric'
  return jour.toLocaleDateString('fr-FR', options)
}

// Effacement des données de navigation (ARB-54) : période (liste fermée, validée par le processus principal) et types.
export const PERIODES_EFFACEMENT = ['heure', 'jour', 'semaine', 'tout'] as const
export type PeriodeEffacement = typeof PERIODES_EFFACEMENT[number]
export const TYPES_EFFACEMENT = ['historique', 'cookies', 'cache'] as const
export type TypeEffacement = typeof TYPES_EFFACEMENT[number]

const DUREES_MS: Record<Exclude<PeriodeEffacement, 'tout'>, number> = { heure: 3_600_000, jour: MS_PAR_JOUR, semaine: 7 * MS_PAR_JOUR }

// Date (ms) à partir de laquelle effacer : 0 pour « tout ». `maintenant` est injecté pour les tests.
export function debutEffacement(periode: PeriodeEffacement, maintenant = Date.now()): number {
  return periode === 'tout' ? 0 : maintenant - DUREES_MS[periode]
}

// Les visites arrivent de la plus récente à la plus ancienne : les jours se suivent dans le même ordre.
export function grouperParJour(visites: VisiteHistorique[], maintenant = Date.now()): JourHistorique[] {
  const jours: JourHistorique[] = []
  for (const visite of visites) {
    const jour = libelleJour(visite.date, maintenant)
    const dernier = jours.at(-1)
    if (dernier?.jour === jour) dernier.visites.push(visite)
    else jours.push({ jour, visites: [visite] })
  }
  return jours
}

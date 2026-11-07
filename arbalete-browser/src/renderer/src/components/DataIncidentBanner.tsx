import type { DataIncident } from '../../../shared/types'
import { Button } from './ui/Button'

// Avertissement d'un incident de la base à l'ouverture (ARB-119), au-dessus de la page comme l'invite d'ARB-46.
function message(incident: DataIncident): string {
  switch (incident.kind) {
    case 'corrupted':
      return `Les données d'Arbalète étaient illisibles : elles ont été mises de côté (${incident.backup}) et remplacées par des données neuves. La session précédente n'a pas pu être restaurée.`
    case 'newer':
      return "Les données d'Arbalète viennent d'une version plus récente : elles restent intactes, mais rien ne sera conservé pendant cette session."
    case 'unavailable':
      return "Les données d'Arbalète n'ont pas pu s'ouvrir : rien ne sera conservé pendant cette session."
  }
}

export function DataIncidentBanner({ incident }: { incident: DataIncident }) {
  return (
    <div className="app-banner" role="alert" data-testid="data-incident-banner">
      <span>{message(incident)}</span>
      <div className="app-banner-actions">
        <Button size="sm" onClick={() => void window.arbalete.dismissDataIncident()}>Fermer</Button>
      </div>
    </div>
  )
}

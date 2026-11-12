import { useEffect, useMemo, useState } from 'react'
import { Clock, Search } from 'lucide-react'
import { grouperParJour, type VisiteHistorique } from '../../../shared/historique'
import { Overlay } from './Overlay'
import { Input } from './ui/Input'

const heure = (date: number) => new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

// Panneau Historique (ARB-52) : modale de la couche d'overlays. Les visites viennent du processus principal à chaque
// frappe (mots dans l'adresse ou le titre), regroupées par jour ; un clic, ou Entrée, ouvre la page dans un nouvel onglet.
// Échap et le clic hors de la modale ferment l'overlay.
export function HistoryPanel({ onClose }: { onClose: () => void }) {
  const [texte, setTexte] = useState('')
  // La liste garde le texte qui l'a produite : Entrée n'ouvre pas la première ligne d'une frappe précédente.
  const [resultat, setResultat] = useState<{ pour: string, visites: VisiteHistorique[] } | null>(null)
  const visites = resultat && resultat.pour === texte ? resultat.visites : null

  useEffect(() => {
    let perime = false
    window.arbalete.searchHistory(texte).then((liste) => { if (!perime) setResultat({ pour: texte, visites: liste }) }, () => { if (!perime) setResultat({ pour: texte, visites: [] }) })
    return () => { perime = true }
  }, [texte])

  const jours = useMemo(() => grouperParJour(visites ?? []), [visites])
  const ouvrir = (url: string) => void window.arbalete.openHistoryPage(url)

  return (
    <Overlay centre onClose={onClose}>
      <div className="palette history" role="dialog" aria-label="Historique">
        <Input autoFocus value={texte} onChange={(event) => setTexte(event.target.value)} placeholder="Rechercher dans l’historique"
          aria-label="Rechercher dans l’historique" leading={<Search size={14} className="muted-icon" aria-hidden="true" />}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && visites?.[0]) { event.preventDefault(); ouvrir(visites[0].url) } }} />
        <div className="palette-liste">
          {visites?.length === 0 && <p className="palette-vide">{texte.trim() ? 'Aucun résultat' : 'Aucune page visitée'}</p>}
          {jours.map(({ jour, visites: duJour }) => (
            <section key={jour} aria-label={jour}>
              <h3 className="history-day">{jour}</h3>
              {duJour.map((visite) => (
                <button key={`${visite.url}:${visite.date}`} type="button" className="suggestion" data-testid="history-item" onClick={() => ouvrir(visite.url)}>
                  <Clock size={14} className="muted-icon" aria-hidden="true" />
                  <span className="suggestion-title">{visite.titre || visite.url}</span>
                  <span className="suggestion-url">{visite.titre ? visite.url : ''}</span>
                  <time className="history-time">{heure(visite.date)}</time>
                </button>
              ))}
            </section>
          ))}
        </div>
      </div>
    </Overlay>
  )
}

import { File, FolderOpen, Pause, Play, X } from 'lucide-react'
import { estActif, formaterTaille, pourcentage, type Telechargement } from '../../../shared/telechargements'
import { Overlay } from './Overlay'
import { IconButton } from './ui/IconButton'

// « 12,3 Mo sur 100 Mo · 12 % », « Terminé · 2 Mo »… : une ligne d'état par téléchargement.
function etatTexte(t: Telechargement): string {
  const avancement = t.total > 0 ? `${formaterTaille(t.recu)} sur ${formaterTaille(t.total)} · ${pourcentage(t.recu, t.total)} %` : formaterTaille(t.recu)
  switch (t.etat) {
    case 'en-cours': return avancement
    case 'en-pause': return `En pause · ${avancement}`
    case 'termine': return `Terminé · ${formaterTaille(t.total || t.recu)}`
    case 'annule': return 'Annulé'
    case 'interrompu': return `Interrompu · ${formaterTaille(t.recu)}`
  }
}

// Liste des téléchargements (ARB-55), dans la couche d'overlays : la barre latérale n'a pas la place de la montrer.
// Un téléchargement actif se met en pause, se reprend ou s'annule ; une ligne terminée se retire de la liste (le fichier
// reste sur le disque).
export function DownloadsOverlay({ x, y, downloads, onClose }: { x: number; y: number; downloads: Telechargement[]; onClose: () => void }) {
  return (
    <Overlay x={x} y={y} onClose={onClose}>
      <div className="downloads" role="dialog" aria-label="Téléchargements">
        <div className="downloads-title">Téléchargements</div>
        {downloads.length === 0 ? <p className="downloads-empty">Aucun téléchargement</p> : (
          <ul className="downloads-list">
            {downloads.map((t) => {
              const actif = estActif(t.etat)
              const avancement = pourcentage(t.recu, t.total)
              return (
                <li key={t.id} className="download-item" data-etat={t.etat} data-testid="download-item">
                  <div className="download-copy">
                    <span className="download-name" title={t.chemin}>{t.nom}</span>
                    <span className="download-state">{etatTexte(t)}</span>
                    {actif && avancement !== null && (
                      <div className="download-bar" role="progressbar" aria-label={`Avancement de ${t.nom}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={avancement}>
                        <span style={{ width: `${avancement}%` }} />
                      </div>
                    )}
                  </div>
                  {actif ? (
                    <>
                      {t.etat === 'en-cours'
                        ? <IconButton size="sm" title="Mettre en pause" onClick={() => void window.arbalete.pauseDownload(t.id)}><Pause size={14} /></IconButton>
                        : <IconButton size="sm" title="Reprendre" onClick={() => void window.arbalete.resumeDownload(t.id)}><Play size={14} /></IconButton>}
                      <IconButton size="sm" title="Annuler" onClick={() => void window.arbalete.cancelDownload(t.id)}><X size={14} /></IconButton>
                    </>
                  ) : (
                    <>
                      {t.etat === 'termine' && (
                        <>
                          <IconButton size="sm" title="Ouvrir le fichier" onClick={() => void window.arbalete.openDownload(t.id)}><File size={14} /></IconButton>
                          <IconButton size="sm" title="Afficher dans le dossier" onClick={() => void window.arbalete.revealDownload(t.id)}><FolderOpen size={14} /></IconButton>
                        </>
                      )}
                      <IconButton size="sm" title="Retirer de la liste" onClick={() => void window.arbalete.removeDownload(t.id)}><X size={14} /></IconButton>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Overlay>
  )
}

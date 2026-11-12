import { useCallback, useEffect, useState } from 'react'
import { Folder, FolderPlus, Import, Pencil, Star, Trash2, X } from 'lucide-react'
import { LONGUEUR_MAX_NOM_DOSSIER, type FavoriListe, type ListeFavoris } from '../../../shared/favoris'
import { Overlay } from './Overlay'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'
import { Input } from './ui/Input'

// Panneau des favoris (ARB-48) : modale de la couche d'overlays. Les dossiers (un niveau) et les favoris viennent du
// processus principal, relus après chaque action ; un favori se range par sa liste « Dossier », sans glisser-déposer.
// Un clic sur un favori l'ouvre (onglet existant ou nouveau) et ferme le panneau.
export function FavoritesPanel({ onClose }: { onClose: () => void }) {
  const [liste, setListe] = useState<ListeFavoris | null>(null)
  const [nouveau, setNouveau] = useState('')
  const [bilan, setBilan] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [renommage, setRenommage] = useState<{ id: number, nom: string } | null>(null)

  const relire = useCallback(() => window.arbalete.listFavorites().then(setListe, () => setListe({ dossiers: [], favoris: [] })), [])
  useEffect(() => { void relire() }, [relire])
  // Relu aussi en cas d'échec : l'état affiché ne doit pas rester différent de la base.
  const agir = (action: Promise<void>) => void action.then(relire, relire)

  const creer = () => {
    if (!nouveau.trim()) return
    agir(window.arbalete.createFavoriteFolder(nouveau))
    setNouveau('')
  }
  const renommer = () => {
    if (renommage) agir(window.arbalete.renameFavoriteFolder(renommage.id, renommage.nom))
    setRenommage(null)
  }
  const importer = () => {
    setBilan('')
    setEnCours(true)
    window.arbalete.importFavorites().then((n) => {
      if (n !== null) setBilan(n === 0 ? 'Aucun nouveau favori' : `${n} favori${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''}`)
      return relire()
    }, () => setBilan('Import impossible')).finally(() => setEnCours(false))
  }
  const ouvrir = (url: string) => { void window.arbalete.openFavorite(url); onClose() }

  const ligne = (favori: FavoriListe) => (
    <div key={favori.id} className="suggestion favorite-row" data-testid="favorite-item">
      <Star size={14} className="muted-icon" aria-hidden="true" />
      <button type="button" className="favorite-open" onClick={() => ouvrir(favori.url)}>
        <span className="suggestion-title">{favori.titre || favori.url}</span>
        <span className="suggestion-url">{favori.titre ? favori.url : ''}</span>
      </button>
      <select aria-label={`Dossier de ${favori.titre || favori.url}`} value={favori.dossier ?? ''}
        onChange={(event) => agir(window.arbalete.moveFavorite(favori.id, event.target.value === '' ? null : Number(event.target.value)))}>
        <option value="">Sans dossier</option>
        {liste?.dossiers.map((dossier) => <option key={dossier.id} value={dossier.id}>{dossier.nom}</option>)}
      </select>
      <IconButton size="sm" title="Retirer des favoris" onClick={() => agir(window.arbalete.removeFavorite(favori.id))}><X size={14} /></IconButton>
    </div>
  )

  const racine = liste?.favoris.filter((favori) => favori.dossier === null) ?? []
  return (
    <Overlay centre onClose={onClose}>
      <div className="palette favorites" role="dialog" aria-label="Favoris">
        <Input value={nouveau} maxLength={LONGUEUR_MAX_NOM_DOSSIER} onChange={(event) => setNouveau(event.target.value)} placeholder="Nouveau dossier"
          aria-label="Nom du nouveau dossier" leading={<FolderPlus size={14} className="muted-icon" aria-hidden="true" />}
          trailing={<IconButton size="sm" title="Créer le dossier" disabled={!nouveau.trim()} onClick={creer}><FolderPlus size={14} /></IconButton>}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); creer() } }} />
        <div className="favorite-import">
          <Button size="sm" icon={<Import size={14} aria-hidden="true" />} disabled={enCours} onClick={importer}>Importer depuis Chrome ou Edge (fichier HTML)</Button>
          <span role="status">{bilan}</span>
        </div>
        <div className="palette-liste">
          {liste && liste.favoris.length === 0 && liste.dossiers.length === 0 && <p className="palette-vide">Aucun favori : l’étoile de la barre d’adresse en ajoute</p>}
          {liste?.dossiers.map((dossier) => (
            <section key={dossier.id} aria-label={dossier.nom}>
              <div className="history-day favorite-folder">
                <Folder size={14} aria-hidden="true" />
                {renommage?.id === dossier.id ? (
                  <Input autoFocus value={renommage.nom} maxLength={LONGUEUR_MAX_NOM_DOSSIER} aria-label="Nouveau nom du dossier"
                    onChange={(event) => setRenommage({ id: dossier.id, nom: event.target.value })}
                    onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); renommer() } }} />
                ) : <h3>{dossier.nom}</h3>}
                <IconButton size="sm" title={`Renommer ${dossier.nom}`} onClick={() => renommage?.id === dossier.id ? renommer() : setRenommage({ id: dossier.id, nom: dossier.nom })}><Pencil size={14} /></IconButton>
                <IconButton size="sm" title={`Supprimer ${dossier.nom} (les favoris sont gardés)`} onClick={() => agir(window.arbalete.deleteFavoriteFolder(dossier.id))}><Trash2 size={14} /></IconButton>
              </div>
              {liste.favoris.filter((favori) => favori.dossier === dossier.id).map(ligne)}
            </section>
          ))}
          {racine.length > 0 && (
            <section aria-label="Sans dossier">
              {(liste?.dossiers.length ?? 0) > 0 && <h3 className="history-day">Sans dossier</h3>}
              {racine.map(ligne)}
            </section>
          )}
        </div>
      </div>
    </Overlay>
  )
}

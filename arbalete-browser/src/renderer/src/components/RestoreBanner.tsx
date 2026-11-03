// Invite qui suit un arrêt forcé (ARB-46). Elle prend place au-dessus de la page, pas par-dessus : la vue native de
// l'onglet masquerait tout HTML posé sur elle (règle 4).
export function RestoreBanner() {
  return (
    <div className="app-banner" role="alert" data-testid="restore-banner">
      <span>Arbalète ne s'est pas fermé correctement. Restaurer les onglets de la session précédente ?</span>
      <div className="app-banner-actions">
        <button type="button" className="app-banner-primary" onClick={() => void window.arbalete.answerRestoreOffer('restore')}>Restaurer</button>
        <button type="button" onClick={() => void window.arbalete.answerRestoreOffer('dismiss')}>Ignorer</button>
      </div>
    </div>
  )
}

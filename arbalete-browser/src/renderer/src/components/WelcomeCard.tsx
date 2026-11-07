import { ArrowRight, Command, GitBranch, Globe2, Layers3, Plus, Search, Sparkles } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

type WelcomeCardProps = {
  address: string
  onAddressChange: (value: string) => void
  onAddressFocus: () => void
  onNavigate: () => void
  onOpenUrl: (url: string) => void
}

// Page d'accueil affichée tant que l'onglet actif est un onglet de démonstration.
export function WelcomeCard({ address, onAddressChange, onAddressFocus, onNavigate, onOpenUrl }: WelcomeCardProps) {
  return (
    <div className="welcome-card">
      <div className="welcome-orb"><Sparkles size={26}/></div>
      <p className="eyebrow">VOTRE ESPACE WEB</p>
      <h1>Le web, <span>à votre façon.</span></h1>
      <p className="welcome-description">Arbalète rassemble vos onglets, vos projets et vos habitudes dans un espace de navigation calme et personnalisé.</p>
      <form className="welcome-search" onSubmit={(event) => { event.preventDefault(); onNavigate() }}>
        <Input
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
          onFocus={onAddressFocus}
          placeholder="Rechercher ou saisir une adresse"
          aria-label="Rechercher ou saisir une adresse"
          leading={<Search size={20}/>}
          trailing={<Button type="submit" variant="primary">Explorer<ArrowRight size={16}/></Button>}
        />
      </form>
      <div className="quick-links">
        <button onClick={() => onOpenUrl('https://github.com')}><span className="quick-icon github"><GitBranch size={18}/></span><span>GitHub</span></button>
        <button onClick={() => onOpenUrl('https://www.electronjs.org')}><span className="quick-icon electron"><Layers3 size={18}/></span><span>Electron</span></button>
        <button onClick={() => onOpenUrl('https://react.dev')}><span className="quick-icon react"><Globe2 size={18}/></span><span>React</span></button>
        <button onClick={() => void window.arbalete.createTab()}><span className="quick-icon add"><Plus size={18}/></span><span>Nouvel onglet</span></button>
      </div>
      <div className="prototype-note"><span className="pulse-dot"/> Maquette fonctionnelle <span>·</span> moteur Chromium intégré</div>
    </div>
  )
}

export function StageFooter() {
  return <div className="stage-footer"><span>arbalète <span className="footer-separator">/</span> votre navigateur, votre espace</span><span><Command size={12}/> K pour rechercher</span></div>
}

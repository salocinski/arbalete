import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installPreviewApi } from './previewApi'
import './styles.css'

// Hors d'Electron (npm run dev:web) : API simulée pour tester l'interface dans un navigateur.
installPreviewApi()
// Avant le premier rendu, le thème du système (le choix « system » de démarrage) : sans lui, la palette sombre par
// défaut s'afficherait un instant sur le fond natif clair de la fenêtre (ARB-34). useTheme prend ensuite le relais.
document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

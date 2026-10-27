import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installPreviewApi } from './previewApi'
import './styles.css'

// Hors d'Electron (npm run dev:web) : API simulée pour tester l'interface dans un navigateur.
installPreviewApi()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

import { defineConfig } from '@playwright/test'

// Tests de l'app Electron (npm run test:smoke) : smoke.spec.ts sur l'app construite, developpement.spec.ts en mode
// développement (serveur Vite). Une seule instance à la fois.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 1,
  reporter: 'list'
})

import { defineConfig } from '@playwright/test'

// Smoke test de l'app Electron construite (npm run test:smoke). Une seule instance à la fois.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 1,
  reporter: 'list'
})

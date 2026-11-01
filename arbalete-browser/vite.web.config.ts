import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cspInterface } from './vite-csp'

// Aperçu navigateur de l'interface (sans Electron), pour /qa, /design-review et /browse.
// L'API Electron est remplacée par une simulation (src/renderer/src/previewApi.ts).
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  plugins: [react(), cspInterface()],
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
  build: { outDir: resolve(__dirname, 'out/web'), emptyOutDir: true }
})

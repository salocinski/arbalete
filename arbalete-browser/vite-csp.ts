import type { Plugin } from 'vite'

// Content-Security-Policy de l'interface (ARB-13), injectée dans index.html.
// Le build reste strict. Le serveur de développement de Vite a besoin de scripts et de styles inline
// (préambule de React Refresh, CSS injecté) et d'un WebSocket pour le rechargement à chaud.
const STRICTE = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'"
]

const DEVELOPPEMENT = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' ws://localhost:* ws://127.0.0.1:*",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'"
]

export function cspInterface(): Plugin {
  let developpement = false
  return {
    name: 'arbalete-csp',
    configResolved(config) {
      developpement = config.command === 'serve'
    },
    transformIndexHtml() {
      const content = (developpement ? DEVELOPPEMENT : STRICTE).join('; ')
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content }, injectTo: 'head-prepend' }]
    }
  }
}

import type { Plugin } from 'vite'

// Content-Security-Policy de l'interface (ARB-13), injectée dans index.html.
// Le build reste strict. Le serveur de développement de Vite a besoin de scripts et de styles inline
// (préambule de React Refresh, CSS injecté) et d'un WebSocket pour le rechargement à chaud.
function csp(developpement: boolean): string {
  const inline = developpement ? " 'unsafe-inline'" : ''
  return [
    "default-src 'none'",
    `script-src 'self'${inline}`,
    `style-src 'self'${inline}`,
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${developpement ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'"
  ].join('; ')
}

export function cspInterface(): Plugin {
  return {
    name: 'arbalete-csp',
    transformIndexHtml(_html, ctx) {
      const content = csp(ctx.server !== undefined)
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content }, injectTo: 'head-prepend' }]
    }
  }
}

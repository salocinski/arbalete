// Favicon d'un onglet (ARB-35) : seules les adresses que la CSP de l'interface charge (img-src 'self' data: https:, ARB-106)
// sont transmises à l'interface ; sinon l'onglet garde l'icône générique.
// shortcut: un favicon http ou un data: trop gros est ignoré ; à revoir si des sites http courants y perdent leur icône.
const LONGUEUR_MAX_FAVICON = 32_768
const IMAGE_DATA = /^data:image\/(png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon)[;,]/i

export function faviconAcceptable(favicons: string[]): string | undefined {
  return favicons.find((url) => url.length <= LONGUEUR_MAX_FAVICON && (url.startsWith('https://') || IMAGE_DATA.test(url)))
}

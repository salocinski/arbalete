// ELECTRON_RENDERER_URL lue une seule fois au chargement du module (ARB-105) : une valeur malformée échoue au démarrage
// avec un message clair, au lieu de lever à chaque message IPC. Une app empaquetée ignore la variable : sinon elle
// chargerait, avec le preload, l'URL qu'on lui désigne.
export function lireUrlDev(valeur: string | undefined, empaquetee: boolean): URL | undefined {
  if (empaquetee || !valeur) return undefined
  const invalide = () => new Error(`ELECTRON_RENDERER_URL invalide : « ${valeur} » n'est pas une adresse web.`)
  let adresse: URL
  try {
    adresse = new URL(valeur)
  } catch {
    throw invalide()
  }
  // Une origine opaque (file:, data:) vaudrait « null » et ferait passer toute page du même genre pour l'interface.
  if (adresse.protocol !== 'http:' && adresse.protocol !== 'https:') throw invalide()
  return adresse
}

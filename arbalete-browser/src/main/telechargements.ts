import { basename, extname, join } from 'node:path'
import { adresseHistorique } from './donnees/historique.ts'

// Téléchargements (ARB-55) : calculs purs du nom de fichier et de l'adresse enregistrée ; le reste est dans index.ts.

const LONGUEUR_MAX_NOM = 150
// Noms que Windows réserve, avec ou sans extension (« CON .txt » compris).
const NOMS_RESERVES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])( *\..*)?$/i
// Au-delà, « nom (n) » n'est plus cherché : un suffixe daté évite des milliers de lectures du disque dans le processus principal.
const ESSAIS_SUFFIXE_MAX = 1000

// Nom de fichier sûr sous Windows : sans séparateur de chemin, caractère interdit ni caractère de contrôle, sans point ni
// espace final, ni nom réservé, d'au plus 150 caractères (extension conservée). Le nom vient du serveur, donc de la page.
export function nomFichierSur(nom: string): string {
  let propre = nom.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').replace(/[. ]+$/, '').replace(/^\s+/, '')
  if (propre.length > LONGUEUR_MAX_NOM) {
    const extension = extname(propre).slice(0, 20)
    // La coupe peut finir sur un point ou une espace, que Windows retirerait en silence : le nom enregistré ne serait plus celui affiché.
    propre = (propre.slice(0, LONGUEUR_MAX_NOM - extension.length) + extension).replace(/[. ]+$/, '')
  }
  if (propre === '' || /^\.+$/.test(propre)) return 'telechargement'
  return NOMS_RESERVES.test(propre) ? `_${propre}` : propre
}

// Chemin du fichier dans le dossier : le nom tel quel, sinon « nom (1).ext », « nom (2).ext »… sans écraser un fichier existant.
export function cheminLibre(dossier: string, nom: string, existe: (chemin: string) => boolean): string {
  const extension = extname(nom)
  const base = nom.slice(0, nom.length - extension.length)
  let chemin = join(dossier, nom)
  for (let n = 1; existe(chemin); n++) {
    if (n > ESSAIS_SUFFIXE_MAX) return join(dossier, `${base} (${Date.now()})${extension}`)
    chemin = join(dossier, `${base} (${n})${extension}`)
  }
  return chemin
}

// Adresse gardée dans l'historique : celle de l'historique des pages pour le web (sans identifiants ni fragment) ; un autre
// schéma qu'Arbalète accepte (blob:) est tronqué, jamais gardé en entier.
export function adresseTelechargement(url: string): string {
  return adresseHistorique(url) ?? url.slice(0, 200)
}

// Seuls le web et les blob: des pages sont téléchargés ; file:, data:, etc. sont refusés.
export function schemaAutorise(url: string): boolean {
  return /^(https?|blob):/i.test(url)
}

// Fichiers que Windows exécute ou interprète à l'ouverture : « Ouvrir » les refuse (« Afficher dans le dossier » reste permis).
// shortcut: liste fixe d'extensions courantes, sans analyse du contenu ni avertissement Windows (SmartScreen) ; l'analyse de
// sécurité des fichiers (EP-10) la remplacera.
const EXTENSIONS_EXECUTABLES = new Set(['.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.lnk', '.url', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.ps1', '.psm1', '.hta', '.jar', '.reg', '.cpl', '.msc', '.appx', '.msix', '.application', '.gadget', '.chm',
  '.jnlp', '.inf', '.scf', '.sct', '.ws', '.wsc', '.vb', '.msp', '.mst', '.dll', '.xll', '.diagcab', '.theme', '.settingcontent-ms', '.library-ms', '.appref-ms', '.xbap', '.ps1xml', '.psc1', '.docm', '.xlsm', '.pptm'])

export function extensionExecutable(nom: string): boolean {
  // Le préfixe « _ » : un fichier nommé exactement « .bat » a pour extension .bat sous Windows, pas pour `extname`.
  return EXTENSIONS_EXECUTABLES.has(extname('_' + basename(nom)).toLowerCase())
}

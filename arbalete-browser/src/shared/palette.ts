// Palette de commandes Ctrl+K (ARB-67) : la liste est construite ici, sans accès à Electron ni à la base, puis tenue par le
// processus principal et affichée par la vue de la barre (couche d'overlays, décision 0002).
export type TypePalette = 'onglet' | 'action' | 'favori' | 'historique'

// `cle` est ce que le processus principal retrouve au choix : id d'onglet, adresse ou id d'action. L'interface ne renvoie
// que l'index de la ligne choisie.
export type EntreePalette = { kind: TypePalette, titre: string, detail: string, cle: string }

// shortcut: liste fixe de quatre actions, sans raccourcis ni commandes de page ; à enrichir quand d'autres actions existent.
export const ACTIONS_PALETTE = [
  { id: 'nouvel-onglet', titre: 'Nouvel onglet', detail: 'Ctrl T' },
  { id: 'rouvrir-onglet', titre: 'Rouvrir le dernier onglet fermé', detail: 'Ctrl Maj T' },
  { id: 'theme', titre: 'Basculer entre thème clair et sombre', detail: '' },
  { id: 'epingler-barre', titre: 'Épingler ou désépingler la barre latérale', detail: 'Ctrl Maj B' }
] as const

export type ActionPalette = typeof ACTIONS_PALETTE[number]['id']

// Plafond par type : la liste reste courte, l'overlay n'a pas de pagination.
export const PALETTE_MAX = { onglet: 6, action: 4, favori: 4, historique: 5 } as const

export type OngletPalette = { id: string, titre: string, url: string, adresse: string }
export type PagePalette = { url: string, titre: string }

const mots = (texte: string) => texte.toLowerCase().split(/\s+/).filter(Boolean)
const contientTout = (champs: string, requis: string[]) => {
  const bas = champs.toLowerCase()
  return requis.every((mot) => bas.includes(mot))
}

// Chaque mot du texte doit se trouver dans le titre ou l'adresse (casse ignorée). Ordre : onglets ouverts, actions, favoris,
// historique. Un favori ou une page déjà ouverte dans un onglet n'est pas répété. Sans texte : onglets et actions seulement.
// shortcut: les accents ne sont pas repliés (comme rechercherPages) ; à revoir avec la recherche de l'historique.
export function construirePalette(
  texte: string,
  onglets: OngletPalette[],
  favoris: PagePalette[],
  historique: PagePalette[]
): EntreePalette[] {
  const requis = mots(texte)
  const trouve = (titre: string, url: string) => contientTout(`${titre} ${url}`, requis)
  const ouverts = new Set(onglets.map((onglet) => onglet.adresse))
  const dejaVu = new Set<string>()
  const pages = (liste: PagePalette[], kind: 'favori' | 'historique'): EntreePalette[] =>
    liste.filter((page) => trouve(page.titre, page.url) && !ouverts.has(page.url) && !dejaVu.has(page.url))
      .slice(0, PALETTE_MAX[kind])
      .map((page) => { dejaVu.add(page.url); return { kind, titre: page.titre || page.url, detail: page.url, cle: page.url } })

  const entreesOnglets = onglets.filter((onglet) => trouve(onglet.titre, onglet.url)).slice(0, PALETTE_MAX.onglet)
    .map((onglet): EntreePalette => ({ kind: 'onglet', titre: onglet.titre || onglet.url, detail: onglet.url, cle: onglet.id }))
  const entreesActions = ACTIONS_PALETTE.filter((action) => contientTout(action.titre, requis)).slice(0, PALETTE_MAX.action)
    .map((action): EntreePalette => ({ kind: 'action', titre: action.titre, detail: action.detail, cle: action.id }))
  if (!requis.length) return [...entreesOnglets, ...entreesActions]
  return [...entreesOnglets, ...entreesActions, ...pages(favoris, 'favori'), ...pages(historique, 'historique')]
}

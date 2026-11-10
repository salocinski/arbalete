// Pile des onglets fermés, pour Ctrl+Maj+T (ARB-20). Ne garde que l'adresse : l'historique de l'onglet fermé ne revient pas.
// shortcut: l'onglet rouvert va en fin de liste, pas à sa place d'origine ; à reprendre si l'ordre devient gênant.

export const FERMES_MAX = 10

// Seules les adresses que l'interface sait rouvrir (celles que will-navigate admet) sont gardées.
const ROUVRABLE = /^(?:https?|file):\/\//i

// Ajoute l'adresse au sommet ; au-delà de FERMES_MAX, les plus anciennes sont oubliées.
export function empiler(pile: string[], url: string): string[] {
  if (!ROUVRABLE.test(url)) return pile
  return [...pile, url].slice(-FERMES_MAX)
}

// Retire le dernier onglet fermé, ou renvoie undefined si la pile est vide.
export function depiler(pile: string[]): { url: string, reste: string[] } | undefined {
  const url = pile.at(-1)
  return url === undefined ? undefined : { url, reste: pile.slice(0, -1) }
}

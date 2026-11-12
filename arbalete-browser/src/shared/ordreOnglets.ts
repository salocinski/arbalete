// Réordonner les onglets par glisser-déposer (ARB-68) : l'onglet déplacé prend l'index de l'onglet sur lequel il est déposé.
// Index hors liste, onglet inconnu ou déplacement sur place : l'ordre ne change pas.
export function ordreApresDeplacementOnglet(ids: string[], id: string, versIndex: number): string[] {
  const depart = ids.indexOf(id)
  if (depart < 0 || !Number.isInteger(versIndex) || versIndex < 0 || versIndex >= ids.length || versIndex === depart) return ids
  const autres = ids.filter((autre) => autre !== id)
  autres.splice(versIndex, 0, id)
  return autres
}

// Nouvelle Map dans l'ordre voulu : l'ordre d'insertion de la Map des onglets est celui que la session écrit.
export function reordonnerOnglets<V>(onglets: Map<string, V>, visibles: string[], id: string, versIndex: number): Map<string, V> {
  const ordre = fusionnerOrdre([...onglets.keys()], visibles, ordreApresDeplacementOnglet(visibles, id, versIndex))
  return new Map(ordre.map((cle) => [cle, onglets.get(cle)!]))
}

// Remet dans `tous` les identifiants de `visibles` (un espace) dans leur nouvel ordre, aux places qu'ils occupaient :
// les onglets des autres espaces ne bougent pas.
export function fusionnerOrdre(tous: string[], visibles: string[], nouvelOrdre: string[]): string[] {
  const dans = new Set(visibles)
  let suivant = 0
  return tous.map((id) => (dans.has(id) ? nouvelOrdre[suivant++] : id))
}

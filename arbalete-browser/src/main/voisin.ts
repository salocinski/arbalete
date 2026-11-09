// Onglet à activer quand on ferme celui qui est actif (ARB-37) : le voisin qui prend sa place, sinon le précédent.
// shortcut: l'ordre est celui de la Map des onglets (ordre d'ouverture), qui est aussi l'ordre affiché ; à revoir si
// la liste devient réordonnable (regroupement, épinglage).
// `ids` est l'ordre des onglets avant la fermeture ; renvoie null s'il ne reste aucun autre onglet.
export function ongletVoisin(ids: string[], ferme: string): string | null {
  const index = ids.indexOf(ferme)
  const restants = ids.filter((id) => id !== ferme)
  if (index === -1) return restants.at(-1) ?? null
  return restants[Math.min(index, restants.length - 1)] ?? null
}

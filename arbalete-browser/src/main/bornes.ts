// Rectangle reçu de l'interface par browser:set-content-bounds (ARB-104) : entiers, dans la zone de contenu de la
// fenêtre. Une valeur aberrante (1e300, NaN) ferait lever setBounds dans un listener sans garde ; null = message ignoré.
export type Rectangle = { x: number; y: number; width: number; height: number }

export function borner(brut: Partial<Rectangle> | undefined, largeurFenetre: number, hauteurFenetre: number): Rectangle | null {
  const { x, y, width, height } = brut ?? {}
  if (![x, y, width, height].every(Number.isFinite)) return null
  const borne = (valeur: number, max: number) => Math.min(Math.max(0, Math.round(valeur)), max)
  const gauche = borne(x as number, largeurFenetre)
  const haut = borne(y as number, hauteurFenetre)
  return {
    x: gauche,
    y: haut,
    width: borne(width as number, largeurFenetre - gauche),
    height: borne(height as number, hauteurFenetre - haut)
  }
}

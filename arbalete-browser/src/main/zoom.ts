// Zoom de la page de l'onglet actif (ARB-107) : depuis la suppression du menu d'application (ARB-101), Ctrl+=, Ctrl+- et
// Ctrl+0 ne font plus rien. Ici, la partie pure : quel geste de zoom forme la touche, et le palier suivant.

export type SensZoom = 'plus' | 'moins' | 'zero'

// Paliers de Chrome (25 % à 500 %).
const PALIERS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5]
// Un facteur à moins de 0,5 % d'un palier est ce palier (Chromium stocke le zoom en puissance de 1,2).
const TOLERANCE = 0.005

type Touche = { key: string, code?: string, control: boolean, alt: boolean, meta: boolean }

// Geste de zoom de la touche, ou undefined. Maj est permis : « + » s'obtient avec Maj sur un clavier QWERTY comme « 0 »
// sur un AZERTY. AltGr arrive comme Ctrl+Alt : il est écarté (comme les autres raccourcis, ARB-18).
export function sensDuZoom(touche: Touche): SensZoom | undefined {
  if (!touche.control || touche.alt || touche.meta) return undefined
  if (touche.key === '=' || touche.key === '+' || touche.code === 'NumpadAdd') return 'plus'
  if (touche.key === '-' || touche.code === 'NumpadSubtract') return 'moins'
  if (touche.key === '0' || touche.code === 'Numpad0') return 'zero'
  return undefined
}

// Facteur à appliquer après un geste : 1 pour zero, sinon le palier voisin (les extrémités restent en place).
export function palierZoom(facteur: number, sens: SensZoom): number {
  if (sens === 'zero') return 1
  if (sens === 'plus') return PALIERS.find((palier) => palier > facteur * (1 + TOLERANCE)) ?? PALIERS[PALIERS.length - 1]
  return [...PALIERS].reverse().find((palier) => palier < facteur * (1 - TOLERANCE)) ?? PALIERS[0]
}

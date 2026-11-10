// Raccourcis de changement d'onglet et de rechargement (ARB-19, ARB-21). Ici, la partie pure : quel geste forme la
// touche, et l'onglet visé. AltGr arrive comme Ctrl+Alt : il est écarté (comme les autres raccourcis, ARB-18).

type Touche = { key: string, code: string, control: boolean, alt: boolean, meta: boolean, shift: boolean }

// Ctrl+Tab et Ctrl+PageDown passent à l'onglet suivant (1), Ctrl+Maj+Tab et Ctrl+PageUp au précédent (-1), comme Chrome.
export function pasDOnglet(t: Touche): 1 | -1 | undefined {
  if (!t.control || t.alt || t.meta) return undefined
  if (t.key === 'Tab') return t.shift ? -1 : 1
  if (t.shift) return undefined
  if (t.key === 'PageDown') return 1
  if (t.key === 'PageUp') return -1
  return undefined
}

// Ctrl+1…8 visent le n-ième onglet, Ctrl+9 le dernier. La touche physique (code) est lue : sur un AZERTY, key vaut « & »,
// « é »… sans Maj, et un chiffre avec Maj.
export function numeroDOnglet(t: Touche): number | undefined {
  if (!t.control || t.alt || t.meta || t.shift) return undefined
  const chiffre = /^(?:Digit|Numpad)([1-9])$/.exec(t.code)
  return chiffre ? Number(chiffre[1]) : undefined
}

// F5 et Ctrl+R rechargent, Ctrl+F5, Maj+F5 et Ctrl+Maj+R rechargent sans le cache. `lettre` est la touche telle que
// l'interprète index.ts (disposition non latine comprise).
export function rechargement(t: Touche, lettre: string): 'normal' | 'sans-cache' | undefined {
  if (t.alt || t.meta) return undefined
  if (t.key === 'F5') return t.control || t.shift ? 'sans-cache' : 'normal'
  if (t.control && lettre === 'r') return t.shift ? 'sans-cache' : 'normal'
  return undefined
}

// Onglet atteint en avançant de `pas` dans l'ordre affiché, en boucle. Renvoie null s'il n'y en a pas d'autre.
export function ongletRelatif(ids: string[], actif: string | null, pas: 1 | -1): string | null {
  if (ids.length < 2) return null
  const index = actif === null ? -1 : ids.indexOf(actif)
  if (index === -1) return ids[0]
  return ids[(index + pas + ids.length) % ids.length]
}

// Ctrl+n : le n-ième onglet, le dernier pour 9. Un numéro sans onglet ne fait rien (null), comme Chrome.
export function ongletNumero(ids: string[], numero: number): string | null {
  if (numero === 9) return ids.at(-1) ?? null
  return ids[numero - 1] ?? null
}

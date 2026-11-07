import { ok } from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Garde-fous des boutons et champs de base (ARB-122) : chaque variante définit ses états, sans dégradé ni valeur
// de couleur en dur (ce dernier point est aussi couvert par tokens.test.ts pour tous les fichiers de l'interface).

const css = readFileSync(fileURLToPath(new URL('./controls.css', import.meta.url)), 'utf8')

test('chaque variante de bouton définit ses états Hover et Active, et Disabled est commun', () => {
  for (const variante of ['primary', 'secondary', 'ghost', 'destructive']) {
    ok(css.includes(`.ui-button--${variante}:not(:disabled):hover`), `${variante} : Hover manque`)
    ok(css.includes(`.ui-button--${variante}:not(:disabled):active`), `${variante} : Active manque`)
  }
  ok(css.includes('.ui-button:disabled'), 'état Disabled manquant')
})

test('les champs gèrent le focus sur tout le champ et l’erreur', () => {
  ok(css.includes('.ui-field:focus-within'), 'focus du champ manquant')
  ok(css.includes('.ui-field--error'), 'état d’erreur manquant')
  ok(css.includes('.ui-field-error'), 'message d’erreur manquant')
})

test('aucun dégradé dans les contrôles', () => {
  ok(!/gradient\(/.test(css), 'DESIGN.md interdit les dégradés sur les boutons')
})

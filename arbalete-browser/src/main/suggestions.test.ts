import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict'
import { test } from 'node:test'
import { modeleDe } from '../shared/moteurs.ts'
import { LONGUEUR_TEXTE_MAX, SUGGESTIONS_MAX, construireSuggestions, deplacerSelection, indexValide, texteSuggestion } from './suggestions.ts'

// Suggestions de la barre d'adresse (ARB-53).

const GOOGLE = modeleDe({ id: 'google', modele: '' })

const page = (url: string, titre = '') => ({ url, titre, visites: 1, derniereVisite: 1 })

test('la première ligne dit ce que ferait Entrée : chercher ou aller à l’adresse', () => {
  deepStrictEqual(construireSuggestions('chat', 'https://www.google.com/search?q=chat', [], GOOGLE)[0],
    { kind: 'recherche', titre: 'chat', url: 'https://www.google.com/search?q=chat' })
  deepStrictEqual(construireSuggestions('example.com', 'https://example.com', [], GOOGLE)[0],
    { kind: 'adresse', titre: 'example.com', url: 'https://example.com' })
})

test('les pages visitées suivent, sans répéter la première ligne, avec l’adresse faute de titre', () => {
  const liste = construireSuggestions('example.com', 'https://example.com', [page('https://example.com', 'Doublon'), page('https://example.com/a', 'A'), page('https://example.com/b')], GOOGLE)
  deepStrictEqual(liste.map((ligne) => [ligne.kind, ligne.titre]), [['adresse', 'example.com'], ['historique', 'A'], ['historique', 'https://example.com/b']])
})

test('la liste est plafonnée, et vide sans texte', () => {
  const pages = Array.from({ length: 20 }, (_, i) => page(`https://example.com/${i}`, String(i)))
  strictEqual(construireSuggestions('ex', 'https://www.google.com/search?q=ex', pages, GOOGLE).length, SUGGESTIONS_MAX)
  deepStrictEqual(construireSuggestions('', 'https://www.google.com', pages, GOOGLE), [])
})

test('les flèches parcourent le texte tapé (-1) puis chaque ligne, en boucle', () => {
  strictEqual(deplacerSelection(-1, 3, 1), 0)
  strictEqual(deplacerSelection(2, 3, 1), -1)
  strictEqual(deplacerSelection(-1, 3, -1), 2)
  strictEqual(deplacerSelection(0, 3, -1), -1)
  strictEqual(deplacerSelection(0, 0, 1), -1)
})

test('seul un entier dans la liste désigne une ligne', () => {
  strictEqual(indexValide(1, 3), 1)
  for (const valeur of [-1, 3, 1.5, '1', undefined, NaN, null]) strictEqual(indexValide(valeur, 3), undefined, String(valeur))
})

test('le texte est une chaîne sans espaces autour, vide si trop long ; autre chose est refusé', () => {
  strictEqual(texteSuggestion('  abc '), 'abc')
  strictEqual(texteSuggestion('x'.repeat(LONGUEUR_TEXTE_MAX)).length, LONGUEUR_TEXTE_MAX)
  strictEqual(texteSuggestion('x'.repeat(LONGUEUR_TEXTE_MAX + 1)), '')
  throws(() => texteSuggestion(3))
})

test('la première ligne est une recherche avec le moteur choisi (ARB-58)', () => {
  const ddg = modeleDe({ id: 'duckduckgo', modele: '' })
  deepStrictEqual(construireSuggestions('chat', 'https://duckduckgo.com/?q=chat', [], ddg)[0],
    { kind: 'recherche', titre: 'chat', url: 'https://duckduckgo.com/?q=chat' })
  strictEqual(construireSuggestions('chat', 'https://www.google.com/search?q=chat', [], ddg)[0].kind, 'adresse')
})

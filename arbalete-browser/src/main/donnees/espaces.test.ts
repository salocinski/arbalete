import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { LONGUEUR_MAX_ICONE_ESPACE, LONGUEUR_MAX_NOM_ESPACE } from '../../shared/espaces.ts'
import { ouvrirBase } from './base.ts'
import { creerEspace, lireEspaces, modifierEspace, ordonnerEspaces, supprimerEspace } from './espaces.ts'
import { MIGRATIONS, appliquerMigrations, versionDuSchema } from './migrations.ts'
import { lireSession, sauverSession } from './session.ts'

// Tests unitaires du modèle de données des espaces (ARB-60).

const dev = { nom: 'Développement', couleur: 'development', icone: '◆' } as const
const perso = { nom: 'Personnel', couleur: 'personal', icone: '✳' } as const

test('les espaces se créent à la suite et se relisent dans leur ordre', () => {
  const db = ouvrirBase(':memory:')
  deepStrictEqual(lireEspaces(db), [])
  const a = creerEspace(db, dev)
  const b = creerEspace(db, perso)
  deepStrictEqual(lireEspaces(db), [{ id: a, ...dev }, { id: b, ...perso }])
})

test('modifier change nom, couleur et icône, et ignore un id inconnu', () => {
  const db = ouvrirBase(':memory:')
  const id = creerEspace(db, dev)
  strictEqual(modifierEspace(db, id, { nom: ' Travail ', couleur: 'work', icone: '▲' }), true)
  deepStrictEqual(lireEspaces(db), [{ id, nom: 'Travail', couleur: 'work', icone: '▲' }])
  strictEqual(modifierEspace(db, id + 1, perso), false)
})

test('les champs invalides sont refusés sans rien écrire', () => {
  const db = ouvrirBase(':memory:')
  throws(() => creerEspace(db, { ...dev, nom: '   ' }))
  throws(() => creerEspace(db, { ...dev, nom: 'x'.repeat(LONGUEUR_MAX_NOM_ESPACE + 1) }))
  throws(() => creerEspace(db, { ...dev, icone: '' }))
  throws(() => creerEspace(db, { ...dev, couleur: '#ff0000' as never }))
  throws(() => creerEspace(db, { ...dev, nom: null as never }))
  deepStrictEqual(lireEspaces(db), [])
})

// Value: protects=un espace existant ne peut pas être corrompu par une mise à jour invalide; fails_when=modifierEspace n'appelle plus validerEspace; why_new=les refus testés ne passent que par creerEspace; seam=none; no_claim=la couche IPC
test('modifier refuse des champs invalides et laisse l’espace intact', () => {
  const db = ouvrirBase(':memory:')
  const id = creerEspace(db, dev)
  throws(() => modifierEspace(db, id, { ...dev, nom: '' }))
  throws(() => modifierEspace(db, id, { ...dev, couleur: '#ff0000' as never }))
  throws(() => modifierEspace(db, id, { ...dev, icone: 'x'.repeat(LONGUEUR_MAX_ICONE_ESPACE + 1) }))
  deepStrictEqual(lireEspaces(db), [{ id, ...dev }])
})

// Value: protects=un espace supprimé entre-temps ne fait pas perdre toute la session; fails_when=l'insertion reprend l'id tel quel (violation de clé étrangère, session non écrite); why_new=seul le SET NULL à la suppression est testé; seam=none; no_claim=la gestion de l'erreur par l'appelant
test('la session enregistre un onglet dont l’espace n’existe plus, sans espace', () => {
  const db = ouvrirBase(':memory:')
  const id = creerEspace(db, dev)
  sauverSession(db, [
    { url: 'https://example.com/a', titre: 'A', actif: true, espace: id },
    { url: 'https://example.com/b', titre: 'B', actif: false, espace: id + 1 }
  ])
  deepStrictEqual(lireSession(db), [
    { url: 'https://example.com/a', titre: 'A', actif: true, espace: id },
    { url: 'https://example.com/b', titre: 'B', actif: false }
  ])
})

// Value: protects=seuls des identifiants entiers atteignent la base; fails_when=validerId est retiré d'une des trois fonctions; why_new=aucun test ne passe un id non entier; seam=none; no_claim=la validation à la frontière IPC
test('un identifiant non entier est refusé', () => {
  const db = ouvrirBase(':memory:')
  const id = creerEspace(db, dev)
  throws(() => modifierEspace(db, 1.5, dev))
  throws(() => supprimerEspace(db, Number.NaN))
  throws(() => ordonnerEspaces(db, [id, '2' as never]))
  deepStrictEqual(lireEspaces(db), [{ id, ...dev }])
})

test('ordonner réécrit l’ordre et refuse une liste qui n’est pas exactement les espaces', () => {
  const db = ouvrirBase(':memory:')
  const a = creerEspace(db, dev)
  const b = creerEspace(db, perso)
  ordonnerEspaces(db, [b, a])
  deepStrictEqual(lireEspaces(db).map((espace) => espace.id), [b, a])
  throws(() => ordonnerEspaces(db, [a]))
  throws(() => ordonnerEspaces(db, [a, a]))
  throws(() => ordonnerEspaces(db, [a, b, b + 1]))
  deepStrictEqual(lireEspaces(db).map((espace) => espace.id), [b, a])
})

test('la session garde l’espace de chaque onglet, et supprimer l’espace libère ses onglets', () => {
  const db = ouvrirBase(':memory:')
  const a = creerEspace(db, dev)
  const b = creerEspace(db, perso)
  const onglets = [
    { url: 'https://example.com/a', titre: 'A', actif: true, espace: a },
    { url: 'https://example.com/b', titre: 'B', actif: false, espace: b },
    { url: 'https://example.com/c', titre: 'C', actif: false }
  ]
  sauverSession(db, onglets)
  deepStrictEqual(lireSession(db), onglets)
  strictEqual(supprimerEspace(db, a), true)
  strictEqual(supprimerEspace(db, a), false)
  deepStrictEqual(lireSession(db), [{ url: 'https://example.com/a', titre: 'A', actif: true }, onglets[1], onglets[2]])
})

test('une base au schéma 4 (avant ARB-60) gagne les espaces sans perdre sa session', () => {
  const ancienne = new DatabaseSync(':memory:')
  appliquerMigrations(ancienne, MIGRATIONS.slice(0, 4))
  ancienne.exec("INSERT INTO onglet (position, url, titre, actif) VALUES (0, 'https://example.com/', 'Exemple', 1)")
  appliquerMigrations(ancienne)
  strictEqual(versionDuSchema(ancienne), MIGRATIONS.length)
  deepStrictEqual(lireSession(ancienne), [{ url: 'https://example.com/', titre: 'Exemple', actif: true }])
  deepStrictEqual(lireEspaces(ancienne), [])
})

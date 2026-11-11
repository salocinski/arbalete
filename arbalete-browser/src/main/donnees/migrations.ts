import type { DatabaseSync } from 'node:sqlite'
import { enTransaction } from './transaction.ts'

// Schéma de la base, une entrée par version (décision 0001) : la migration d'indice i fait passer user_version de i à
// i + 1. Ne jamais modifier une migration publiée, en ajouter une nouvelle à la fin.
export const MIGRATIONS: readonly string[] = [
  // 1 — Session (ARB-44/45) : onglets ouverts dans leur ordre, l'onglet actif marqué.
  `CREATE TABLE onglet (
    position INTEGER PRIMARY KEY,
    url TEXT NOT NULL,
    titre TEXT NOT NULL DEFAULT '',
    actif INTEGER NOT NULL DEFAULT 0 CHECK (actif IN (0, 1))
  )`,
  // 2 — État de l'application (ARB-46) : notes clé/valeur, dont celle d'une session ouverte non refermée.
  `CREATE TABLE etat (
    cle TEXT PRIMARY KEY,
    valeur TEXT NOT NULL
  )`,
  // 3 — Historique (ARB-51) : une page par adresse, avec son titre, son nombre de visites et sa dernière visite ; une
  // visite datée par navigation, pour le regroupement par jour (ARB-52) et l'effacement par période (ARB-54). Dates en
  // millisecondes depuis 1970.
  `CREATE TABLE page (
    id INTEGER PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    titre TEXT NOT NULL DEFAULT '',
    visites INTEGER NOT NULL DEFAULT 0,
    derniere_visite INTEGER NOT NULL
  );
  CREATE TABLE visite (
    id INTEGER PRIMARY KEY,
    page INTEGER NOT NULL REFERENCES page (id) ON DELETE CASCADE,
    date INTEGER NOT NULL
  );
  CREATE INDEX visite_date ON visite (date);
  CREATE INDEX visite_page ON visite (page)`,
  // 4 — Favoris (ARB-47) : une ligne par adresse, avec le titre de la page à l'ajout et la date d'ajout (millisecondes
  // depuis 1970). Les dossiers (ARB-48) s'ajouteront par une migration.
  `CREATE TABLE favori (
    id INTEGER PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    titre TEXT NOT NULL DEFAULT '',
    date INTEGER NOT NULL
  )`,
  // 5 — Espaces (ARB-60) : nom, couleur (nom d'un token), icône et ordre (position croissante) ; chaque onglet de la
  // session peut appartenir à un espace (NULL : aucun, ou espace supprimé).
  `CREATE TABLE espace (
    id INTEGER PRIMARY KEY,
    nom TEXT NOT NULL,
    couleur TEXT NOT NULL,
    icone TEXT NOT NULL,
    position INTEGER NOT NULL
  );
  ALTER TABLE onglet ADD COLUMN espace INTEGER REFERENCES espace (id) ON DELETE SET NULL`
]

export function versionDuSchema(db: DatabaseSync): number {
  return Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)
}

// Une base créée par une version plus récente d'Arbalète est refusée plutôt que lue avec un schéma inconnu.
export class BasePlusRecente extends Error {}

export function refuserBasePlusRecente(db: DatabaseSync, migrations: readonly string[] = MIGRATIONS): void {
  const version = versionDuSchema(db)
  if (version > migrations.length) {
    throw new BasePlusRecente(`Base au schéma ${version}, plus récente que cette version d'Arbalète (schéma ${migrations.length})`)
  }
}

// Applique les migrations manquantes, chacune dans sa transaction avec son numéro de version : un arrêt en cours de
// route laisse la base à la dernière version complète. La version est relue sous le verrou d'écriture : si une autre
// instance vient d'appliquer la migration, elle n'est pas rejouée.
export function appliquerMigrations(db: DatabaseSync, migrations: readonly string[] = MIGRATIONS): void {
  refuserBasePlusRecente(db, migrations)
  for (let cible = versionDuSchema(db) + 1; cible <= migrations.length; cible++) {
    enTransaction(db, () => {
      if (versionDuSchema(db) >= cible) return
      db.exec(migrations[cible - 1])
      db.exec(`PRAGMA user_version = ${cible}`)
    })
  }
}

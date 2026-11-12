import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { ouvrirBase } from './base.ts'
import { listerFavoris } from './favoris.ts'
import { importerFavoris, lireFavorisHtml } from './importFavoris.ts'

// Tests unitaires de l'import des favoris (ARB-50).

const EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3 ADD_DATE="1" PERSONAL_TOOLBAR_FOLDER="true">Barre de favoris</H3>
  <DL><p>
    <DT><A HREF="https://example.com/a?x=1&amp;y=2#frag" ADD_DATE="1">Page &lt;A&gt;</A>
    <DT><H3>Outils</H3>
    <DL><p>
      <DT><A HREF="https://example.org/">Org</A>
    </DL><p>
    <DT><A HREF="javascript:alert(1)">Piège</A>
    <DT><A HREF="file:///C:/secret">Fichier</A>
  </DL><p>
  <DT><A HREF="https://racine.test/">Racine</A>
</DL><p>`

test('lit les favoris, leur dossier le plus proche, et écarte les schémas non web', () => {
  deepStrictEqual(lireFavorisHtml(EXPORT), [
    { url: 'https://example.com/a?x=1&y=2', titre: 'Page <A>', dossier: 'Barre de favoris' },
    { url: 'https://example.org/', titre: 'Org', dossier: 'Outils' },
    { url: 'https://racine.test/', titre: 'Racine', dossier: null }
  ])
})

test('un fichier sans favori ou du texte quelconque donne une liste vide', () => {
  deepStrictEqual(lireFavorisHtml('n’importe quoi'), [])
})

test('importer crée les dossiers, ignore les adresses déjà présentes et se rejoue sans doublon', () => {
  const db = ouvrirBase(':memory:')
  db.prepare('INSERT INTO favori (url, titre, date) VALUES (?, ?, ?)').run('https://example.org/', 'Déjà là', 1)
  strictEqual(importerFavoris(db, lireFavorisHtml(EXPORT)), 2)
  const liste = listerFavoris(db)
  deepStrictEqual(liste.dossiers.map((d) => d.nom), ['Barre de favoris', 'Outils'])
  strictEqual(liste.favoris.length, 3)
  strictEqual(liste.favoris.find((f) => f.url === 'https://example.org/')?.titre, 'Déjà là')
  strictEqual(importerFavoris(db, lireFavorisHtml(EXPORT)), 0)
  strictEqual(listerFavoris(db).dossiers.length, 2)
})

test('après un sous-dossier, les favoris suivants reviennent au dossier parent ; décode guillemets simples et entités numériques', () => {
  const html = `<DL><p><DT><H3>Parent</H3><DL><p>
    <DT><H3>Enfant</H3><DL><p><DT><A HREF='https://enfant.test/'>L&#233;o &#x41;</A></DL><p>
    <DT><A HREF="https://parent.test/">Parent</A>
  </DL><p></DL><p>`
  deepStrictEqual(lireFavorisHtml(html), [
    { url: 'https://enfant.test/', titre: 'Léo A', dossier: 'Enfant' },
    { url: 'https://parent.test/', titre: 'Parent', dossier: 'Parent' }
  ])
})

test('un <DL> sans titre de dossier hérite du dossier nommé le plus proche', () => {
  const html = `<DL><DT><H3>Haut</H3><DL><DL><DT><A HREF="https://x.test/">X</A></DL></DL></DL>`
  deepStrictEqual(lireFavorisHtml(html).map((f) => f.dossier), ['Haut'])
})

test('des balises jamais fermées ne rendent pas la lecture quadratique', () => {
  const debut = Date.now()
  lireFavorisHtml('<a href="https://x.test/">'.repeat(100_000) + '<h3>'.repeat(50_000))
  strictEqual(Date.now() - debut < 3000, true)
})

test('un favori Chrome avec une grosse icône data: (ICON de 10 Ko) est gardé', () => {
  const html = `<DL><DT><A HREF="https://a.test/" ICON="data:image/png;base64,${'A'.repeat(10_000)}">A</A><DT><A HREF="https://b.test/">B</A></DL>`
  deepStrictEqual(lireFavorisHtml(html).map((f) => f.url), ['https://a.test/', 'https://b.test/'])
})

test('des balises ouvertes sans fermeture, en masse, se lisent vite', () => {
  const debut = Date.now()
  lireFavorisHtml('<a x>'.repeat(1_000_000))
  strictEqual(Date.now() - debut < 3000, true)
})

test('des balises sans « > » ne rendent pas la lecture quadratique', () => {
  const debut = Date.now()
  lireFavorisHtml('<a '.repeat(300_000) + '<h3 '.repeat(100_000) + '<dl '.repeat(100_000))
  strictEqual(Date.now() - debut < 3000, true)
})

test('importer réutilise un dossier existant du même nom au lieu d’en créer un', () => {
  const db = ouvrirBase(':memory:')
  db.prepare('INSERT INTO dossier_favori (nom) VALUES (?)').run('Outils')
  strictEqual(importerFavoris(db, [{ url: 'https://a.test/', titre: 'A', dossier: 'Outils' }]), 1)
  const liste = listerFavoris(db)
  strictEqual(liste.dossiers.length, 1)
  strictEqual(liste.favoris[0].dossier, liste.dossiers[0].id)
})

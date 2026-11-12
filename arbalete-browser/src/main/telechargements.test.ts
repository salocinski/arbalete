import { strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { formaterTaille, pourcentage } from '../shared/telechargements.ts'
import { adresseTelechargement, cheminLibre, extensionExecutable, nomFichierSur, schemaAutorise } from './telechargements.ts'

// Tests unitaires des calculs purs des téléchargements (ARB-55).

test('le nom de fichier perd séparateurs, caractères interdits et point final', () => {
  strictEqual(nomFichierSur('rapport.pdf'), 'rapport.pdf')
  strictEqual(nomFichierSur('..\\..\\Windows\\evil.exe'), '.._.._Windows_evil.exe')
  strictEqual(nomFichierSur('a/b:c*d?.txt'), 'a_b_c_d_.txt')
  strictEqual(nomFichierSur('fichier. . '), 'fichier')
  strictEqual(nomFichierSur('a\u0000b\nc'), 'a_b_c')
})

test('un nom vide, de points ou réservé est remplacé', () => {
  strictEqual(nomFichierSur(''), 'telechargement')
  strictEqual(nomFichierSur('...'), 'telechargement')
  strictEqual(nomFichierSur('NUL'), '_NUL')
  strictEqual(nomFichierSur('com1.txt'), '_com1.txt')
  strictEqual(nomFichierSur('console.txt'), 'console.txt')
})

test('un nom trop long est coupé en gardant l’extension', () => {
  const nom = nomFichierSur(`${'a'.repeat(400)}.zip`)
  strictEqual(nom.length, 150)
  strictEqual(nom.endsWith('.zip'), true)
})

test('le chemin évite un fichier existant', () => {
  const pris = new Set(['D\\a.zip', 'D\\a (1).zip'])
  const existe = (chemin: string) => pris.has(chemin.replace(/^.*?([^\\/]+)$/, 'D\\$1'))
  strictEqual(cheminLibre('D', 'b.zip', existe), 'D\\b.zip')
  strictEqual(cheminLibre('D', 'a.zip', existe), 'D\\a (2).zip')
  strictEqual(cheminLibre('D', 'sans-extension', () => false), 'D\\sans-extension')
})

test('l’adresse gardée n’a ni identifiants ni fragment ; un blob: est tronqué', () => {
  // Identifiants factices, assemblés pour ne pas ressembler à un secret dans le dépôt.
  const avecIdentifiants = `https://${'u'}:${'p'}@example.com/f.zip#x`
  strictEqual(adresseTelechargement(avecIdentifiants), 'https://example.com/f.zip')
  strictEqual(adresseTelechargement(`blob:https://example.com/${'a'.repeat(500)}`).length, 200)
})

test('seuls le web et blob: sont téléchargés', () => {
  for (const url of ['http://a/b', 'HTTPS://a/b', 'blob:https://a/uuid']) strictEqual(schemaAutorise(url), true)
  for (const url of ['file:///C:/x', 'data:text/plain,a', 'javascript:1', 'ftp://a/b']) strictEqual(schemaAutorise(url), false)
})

test('le pourcentage est borné, nul de taille inconnue', () => {
  strictEqual(pourcentage(50, 200), 25)
  strictEqual(pourcentage(300, 200), 100)
  strictEqual(pourcentage(5, 0), null)
  strictEqual(pourcentage(-5, 100), 0)
})

test('la taille s’écrit en unités binaires à la française', () => {
  strictEqual(formaterTaille(100), '100 o')
  strictEqual(formaterTaille(1536), '1,5 Ko')
  strictEqual(formaterTaille(100 * 1024 * 1024), '100 Mo')
  strictEqual(formaterTaille(12.3 * 1024 * 1024), '12,3 Mo')
  strictEqual(formaterTaille(80 * 1024 * 1024), '80 Mo')
})

// Value: protects=la coupe à 150 caractères ne laisse ni point ni espace final, et « CON .txt » reste réservé; fails_when=la coupe n'est plus nettoyée ou la regex ignore l'espace avant l'extension; why_new=le test de longueur ne coupe pas sur une espace; seam=none; no_claim=le renommage réel par Windows.
test('un nom coupé ne finit pas sur une espace et « CON .txt » est réservé', () => {
  const nom = nomFichierSur(`${'a'.repeat(149)} .zip`)
  strictEqual(/[. ]$/.test(nom), false)
  strictEqual(nomFichierSur(`${'a'.repeat(148)}. ${'b'.repeat(30)}`).endsWith(' '), false)
  strictEqual(nomFichierSur('CON .txt'), '_CON .txt')
})

// Value: protects=la recherche de « nom (n) » est bornée même si tous les noms existent; fails_when=la boucle redevient illimitée (milliers de lectures du disque dans le processus principal); why_new=le test du chemin libre s'arrête à (2); seam=none; no_claim=le temps réel d'existsSync.
test('la recherche d’un nom libre est bornée', () => {
  let appels = 0
  const chemin = cheminLibre('D', 'a.zip', () => { appels++; return true })
  strictEqual(appels <= 1002, true)
  strictEqual(/^D\\a \(\d{10,}\)\.zip$/.test(chemin), true)
})

// protects: refus d'ouverture d'un exécutable selon sa dernière extension ; fails_when: extension retirée, casse non normalisée, double extension mal classée ; why_new: aucun test direct ; seam: none ; no_claim: SmartScreen, contenu réel du fichier
test('extensionExecutable : se fie à la dernière extension, sans tenir compte de la casse (ARB-56)', () => {
  for (const nom of ['a.exe', 'A.EXE', 'x.txt.exe', 'a.ps1', 'a.msi', 'a.lnk', 'a.jnlp', 'a.dll', 'a.xlsm', 'a.settingcontent-ms']) strictEqual(extensionExecutable(nom), true, nom)
  // Un nom réduit à l'extension (« .bat ») et un chemin complet comptent comme leur extension.
  for (const nom of ['.bat', '.exe', '.hta', '.lnk', 'D\\Téléchargements\\.bat', 'D\\dossier.pdf\\setup.exe']) strictEqual(extensionExecutable(nom), true, nom)
  for (const nom of ['a.pdf', 'x.exe.txt', 'sans-extension', 'D\\dossier.exe\\lisez-moi', '']) strictEqual(extensionExecutable(nom), false, nom)
})

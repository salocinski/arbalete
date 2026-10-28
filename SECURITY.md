# Politique de sécurité

Arbalète est un navigateur : une faille peut exposer les données de ses utilisateurs. Merci de signaler
les problèmes de sécurité **en privé**.

## Signaler une vulnérabilité

- Utilise le **signalement privé de GitHub** : onglet *Security* du dépôt, puis *Report a vulnerability*.
- **N'ouvre pas d'issue publique** et ne publie pas de preuve de concept avant la correction.
- Décris le problème, la version ou le commit concerné, les étapes pour le reproduire et l'impact estimé.

Tu recevras un accusé de réception dans les 7 jours. Nous te tiendrons informé de la correction et,
si tu le souhaites, ton signalement sera crédité dans les notes de version.

## Versions prises en charge

Le projet est au stade de prototype : seule la dernière version de la branche `main` reçoit des correctifs.

## Périmètre

Sont notamment concernés : contournement de l'isolation entre les pages web et l'interface du navigateur,
accès aux API Electron/Node depuis une page, abus des canaux IPC, gestion des permissions, téléchargements,
mises à jour et extensions.

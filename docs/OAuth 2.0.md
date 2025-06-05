Guide pour configurer OAuth 2.0 et obtenir Client ID & Client Secret
Ces étapes sont à réaliser dans la console Google Cloud. Si vous n'avez pas de compte Google Cloud, vous devrez en créer un (cela peut nécessiter une carte de crédit pour la vérification, mais l'utilisation des APIs pour ce type de projet reste généralement dans les limites du niveau gratuit).

Étape 1 : Accéder à la Google Cloud Console

Ouvrez votre navigateur et allez sur https://console.cloud.google.com/.

Connectez-vous avec le compte Google que vous souhaitez utiliser pour gérer ce projet (celui du manager ou un compte développeur).

Étape 2 : Sélectionner ou Créer un Projet

En haut de la page, à côté du logo "Google Cloud Platform", vous verrez le nom du projet actuel. Cliquez dessus.

Si vous avez déjà un projet que vous souhaitez utiliser, sélectionnez-le.

Sinon, cliquez sur "Nouveau projet".

Donnez un nom à votre projet (par exemple, "AppFacturationTherapieOAuth").

Sélectionnez une organisation ou un emplacement si nécessaire (généralement "Aucune organisation" pour les projets personnels).

Cliquez sur "Créer".

Étape 3 : Activer les APIs Nécessaires (Gmail API et Google Calendar API)

Une fois votre projet sélectionné, utilisez la barre de recherche en haut et tapez "API et services", puis sélectionnez "Bibliothèque" dans les résultats.

Dans la bibliothèque d'API, recherchez "Gmail API".

Cliquez sur "Gmail API" dans les résultats.

Cliquez sur le bouton "Activer". Si c'est déjà activé, vous n'avez rien à faire ici.

Retournez à la bibliothèque d'API (vous pouvez rechercher "Bibliothèque d'API" à nouveau).

Recherchez "Google Calendar API".

Cliquez sur "Google Calendar API" dans les résultats.

Cliquez sur le bouton "Activer".

Étape 4 : Configurer l'Écran de Consentement OAuth

Avant de créer des identifiants, vous devez configurer ce que les utilisateurs verront lorsqu'ils autoriseront votre application.

Dans le menu de navigation de gauche (vous pouvez l'ouvrir en cliquant sur l'icône hamburger ☰), allez dans "API et services" > "Écran de consentement OAuth".

Type d'utilisateur :

Si vous testez et que vous êtes le seul utilisateur (avec un compte Gmail standard), vous pouvez choisir "Externe" et ajouter votre propre adresse email comme utilisateur testeur plus tard. Cela évite le processus de vérification de l'application pour l'instant.

Si vous prévoyez de distribuer l'application à d'autres utilisateurs, vous devrez choisir "Externe" et éventuellement passer par un processus de vérification Google plus tard si vous utilisez des "scopes" sensibles. Pour l'instant, restons simples.

Cliquez sur "Créer".

Informations sur l'application :

Nom de l'application : Entrez le nom que les utilisateurs verront (par exemple, "AppFacturationTherapie").

Adresse e-mail d'assistance utilisateur : Votre adresse e-mail.

Logo de l'application : Facultatif pour l'instant.

Domaines de l'application :

Domaine autorisé : Si votre application est hébergée (par exemple, fact.lpz.ovh), ajoutez ce domaine (sans http:// ou https://). Si vous testez en local, vous pouvez laisser vide pour l'instant ou ajouter le domaine que vous utiliserez.

Coordonnées du développeur : Entrez votre adresse e-mail.

Cliquez sur "Enregistrer et continuer".

Champs d'application (Scopes) :

Cliquez sur "Ajouter ou supprimer des champs d'application".

Vous devez ajouter les permissions (scopes) dont votre application aura besoin. Pour Gmail (envoi d'emails) et Calendar (gestion des événements) :

Filtrez ou recherchez "Gmail API" et sélectionnez https://www.googleapis.com/auth/gmail.send (pour envoyer des emails). Vous pourriez aussi avoir besoin de https://www.googleapis.com/auth/gmail.modify si vous voulez gérer des brouillons ou lire des emails, mais pour l'envoi seul, gmail.send suffit.

Filtrez ou recherchez "Google Calendar API" et sélectionnez https://www.googleapis.com/auth/calendar ou https://www.googleapis.com/auth/calendar.events (pour lire et écrire des événements). https://www.googleapis.com/auth/calendar donne un accès plus complet.

Cliquez sur "Mettre à jour" après avoir sélectionné les scopes.

Cliquez sur "Enregistrer et continuer".

Utilisateurs tests :

Si vous avez choisi "Externe" à l'étape 2 et que votre application n'est pas encore vérifiée par Google, vous devez ajouter les comptes Google qui seront autorisés à utiliser l'application pendant la phase de test.

Cliquez sur "Ajouter des utilisateurs".

Entrez l'adresse e-mail du compte Google du manager (et la vôtre pour tester). Vous pouvez en ajouter jusqu'à 100.

Cliquez sur "Ajouter".

Cliquez sur "Enregistrer et continuer".

Vous verrez un résumé. Cliquez sur "Retourner au tableau de bord".

Étape 5 : Créer les Identifiants OAuth 2.0 (Client ID et Client Secret)

Dans le menu de navigation de gauche, allez dans "API et services" > "Identifiants".

Cliquez sur "+ CRÉER DES IDENTIFIANTS" en haut de la page.

Sélectionnez "ID client OAuth".

Type d'application : Choisissez "Application Web".

Nom : Donnez un nom à cet ID client (par exemple, "Client Web AppFacturationTherapie").

Restrictions :

Origines JavaScript autorisées :

Si votre application est accessible via http://fact.lpz.ovh:3000 (ou un autre port si vous utilisez le serveur de développement Node.js localement), ajoutez cette origine. Par exemple, http://localhost:3000 si vous testez en local.

Si votre application est hébergée sur http://fact.lpz.ovh (sans port spécifique pour le front-end servi par un serveur web comme Nginx ou Apache), ajoutez http://fact.lpz.ovh.

URI de redirection autorisés : C'est crucial. C'est l'URL sur votre serveur vers laquelle Google redirigera l'utilisateur après qu'il se soit authentifié et ait donné son consentement. Votre serveur devra avoir un endpoint pour gérer cette redirection.

Pour l'instant, nous pouvons définir une URI placeholder que nous mettrons à jour plus tard. Une convention courante est http://VOTRE_DOMAINE/api/auth/google/callback.

Donc, si vous testez en local avec le serveur Node.js sur le port 3000, vous pourriez mettre : http://localhost:3000/api/auth/google/callback.

Si votre application est sur http://fact.lpz.ovh, vous mettriez : http://fact.lpz.ovh/api/auth/google/callback.

Important : Cette URI doit correspondre exactement à celle que votre serveur attendra.

Cliquez sur "Créer".

Étape 6 : Récupérer votre Client ID et Client Secret

Une fois créé, une fenêtre pop-up apparaîtra affichant "Votre ID client" et "Votre code secret client".

Copiez ces deux valeurs et conservez-les précieusement et de manière sécurisée. Vous en aurez besoin dans la configuration de votre serveur (server.js).

ID Client : VOTRE_CLIENT_ID

Code Secret Client : VOTRE_CLIENT_SECRET

Vous pouvez également les retrouver plus tard en cliquant sur le nom de l'ID client que vous venez de créer dans la liste des "ID clients OAuth 2.0" sur la page "Identifiants".

Points importants :

Sécurité du Client Secret : Le Client Secret doit rester secret ! Ne l'exposez jamais côté client (dans votre main.js ou index.html). Il ne doit être utilisé que sur votre serveur.

URI de redirection : L'URI de redirection que vous avez configurée doit correspondre exactement à celle que votre serveur (server.js) utilisera pour recevoir la réponse de Google après l'authentification. Nous allons configurer cet endpoint sur votre serveur dans les prochaines étapes.

Scopes (Champs d'application) : Les scopes que vous avez sélectionnés déterminent à quelles données de l'utilisateur votre application peut demander l'accès. Si vous avez besoin d'accéder à plus de données plus tard, vous devrez ajouter de nouveaux scopes à votre écran de consentement et potentiellement redemander le consentement de l'utilisateur.

Une fois que vous avez votre Client ID et votre Client Secret, nous pourrons passer à l'étape suivante : modifier votre server.js pour implémenter le flux OAuth 2.0.

Dites-moi quand vous aurez ces informations !
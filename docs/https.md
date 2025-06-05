1. Installation de Certbot
bash# Mise à jour des paquets
sudo apt update

# Installation de Certbot et du plugin Nginx
sudo apt install certbot python3-certbot-nginx
2. Obtention du certificat SSL
bash# Obtenir le certificat pour votre domaine
sudo certbot --nginx -d fact.lpz.ovh
Certbot va :

Vérifier que votre domaine pointe bien vers votre serveur
Générer automatiquement le certificat
Modifier votre configuration Nginx

3. Configuration Nginx mise à jour
Voici votre configuration corrigée et optimisée :Configuration Nginx HTTPSCode # /etc/nginx/sites-available/ostm

# Redirection HTTP vers HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name fact.lpz.ovh;
    return 301 https://$host$request_uri;
}

# Configuration HTTPS
server {
    listen 443 ssl http2;
    liste4. Étapes à suivre
Étape 1: Sauvegardez votre configuration actuelle
bashsudo cp /etc/nginx/sites-available/ostm /etc/nginx/sites-available/ostm.backup
Étape 2: Obtenez le certificat
bashsudo certbot --nginx -d fact.lpz.ovh
Étape 3: Testez la configuration
bashsudo nginx -t
Étape 4: Rechargez Nginx
bashsudo systemctl reload nginx
5. Configuration du renouvellement automatique
Le certificat Let's Encrypt expire tous les 90 jours. Certbot installe automatiquement un cron job pour le renouvellement :
bash# Vérifier que le renouvellement automatique est configuré
sudo certbot renew --dry-run

# Voir les tâches cron de Certbot
sudo systemctl list-timers | grep certbot
6. Vérifications importantes
Vérifiez que votre domaine pointe vers votre serveur :
bashdig fact.lpz.ovh
Testez votre certificat SSL :
Utilisez SSL Labs pour tester votre configuration SSL.
7. Configuration Node.js (si nécessaire)
Si votre application Node.js a besoin de savoir qu'elle est derrière un proxy HTTPS, ajoutez ceci dans votre server.js :
javascript// Si vous utilisez Express
app.set('trust proxy', 1);

// Pour vérifier si la requête est en HTTPS
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});
Dépannage courant

Erreur "Domain validation failed" : Vérifiez que votre domaine pointe bien vers votre serveur
Port 80 non accessible : Assurez-vous que le port 80 est ouvert dans votre firewall
Nginx ne démarre pas : Vérifiez la syntaxe avec sudo nginx -t


#!/bin/bash
# chmod +x install_therafact.sh
# ./install_therafact.sh

# ==============================================================================
# Script d'installation all-in-one pour TheraFact
# Installe Nginx, Node.js, PM2 et déploie le projet TheraFact
# Compatible avec Ubuntu fraîchement installé
# ==============================================================================

# Configuration
PROJECT_NAME="therafact"
DOMAIN="fact.lpz.ovh"  # Changez cette valeur pour votre domaine
PROJECT_DIR="/var/www/$PROJECT_NAME"
GITHUB_REPO="https://github.com/sctfic/TheraFact.git"
NODE_VERSION="lts"

# Ce que fait le script :
# 🔧 Installation des composants

# Met à jour Ubuntu
# Installe Node.js LTS via NodeSource
# Installe PM2 globalement
# Installe Nginx
# Installe toutes les dépendances nécessaires pour Puppeteer

# 📦 Déploiement du projet

# Clone le projet TheraFact depuis GitHub
# Installe automatiquement toutes les dépendances du package.json
# Crée la structure de dossiers nécessaire
# Configure les fichiers de données par défaut

# ⚙️ Configuration PM2

# Crée un fichier ecosystem.config.js si absent
# Configure les logs, redémarrages automatiques
# Optimise pour Puppeteer en production
# Démarre l'application automatiquement

# 🌐 Configuration Nginx

# Configure un reverse proxy vers Node.js
# Active la compression gzip
# Ajoute des headers de sécurité
# Configure le rate limiting
# Sert les fichiers statiques directement

# 🛡️ Sécurité

# Configure le firewall UFW
# Protège les fichiers sensibles (.tsv, .json privés)
# Ajoute des headers de sécurité

# 📋 Scripts de gestion

# deploy.sh - Pour les mises à jour
# monitor.sh - Pour le monitoring
# backup.sh - Pour les sauvegardes

# Caractéristiques du script :

# ✅ Détection intelligente : Vérifie si les composants sont déjà installés
# ✅ Gestion d'erreurs : S'arrête en cas de problème
# ✅ Affichage coloré : Interface claire avec codes couleurs
# ✅ Configuration adaptative : Crée les fichiers manquants
# ✅ Vérifications finales : Teste que tout fonctionne
# ✅ Documentation : Affiche toutes les infos importantes à la fin

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

set -e  # Arrêt en cas d'erreur

# Fonction d'affichage
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_separator() {
    echo "========================================================================"
}

# Vérification des privilèges root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "Ce script ne doit pas être exécuté en tant que root."
        print_warning "Exécutez-le avec un utilisateur ayant les privilèges sudo."
        exit 1
    fi
    
    if ! sudo -n true 2>/dev/null; then
        print_error "L'utilisateur actuel n'a pas les privilèges sudo."
        exit 1
    fi
}

# Mise à jour du système
update_system() {
    print_separator
    print_status "Mise à jour du système Ubuntu..."
    
    sudo apt update -y
    sudo apt upgrade -y
    sudo apt install -y curl wget git build-essential software-properties-common apt-transport-https ca-certificates gnupg lsb-release
    
    print_success "Système mis à jour avec succès"
}

# Installation de Node.js
install_nodejs() {
    print_separator
    print_status "Installation de Node.js..."
    
    # Vérifier si Node.js est déjà installé
    if command -v node &> /dev/null; then
        current_version=$(node --version)
        print_warning "Node.js est déjà installé (version: $current_version)"
        read -p "Voulez-vous le réinstaller ? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Installation de Node.js ignorée"
            return
        fi
    fi
    
    # Installation via NodeSource
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Vérification de l'installation
    node_version=$(node --version)
    npm_version=$(npm --version)
    
    print_success "Node.js installé avec succès"
    print_status "Version Node.js: $node_version"
    print_status "Version npm: $npm_version"
}

# Installation de PM2
install_pm2() {
    print_separator
    print_status "Installation de PM2..."
    
    # Installation globale de PM2
    sudo npm install -g pm2@latest
    
    # Configuration de PM2 pour le démarrage automatique
    pm2 startup systemd -u $USER --hp $HOME
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
    
    pm2_version=$(pm2 --version)
    print_success "PM2 installé avec succès (version: $pm2_version)"
}

# Installation de Nginx
install_nginx() {
    print_separator
    print_status "Installation de Nginx..."
    
    # Vérifier si Nginx est déjà installé
    if command -v nginx &> /dev/null; then
        print_warning "Nginx est déjà installé"
        sudo systemctl status nginx --no-pager -l || true
        read -p "Voulez-vous le reconfigurer ? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Configuration de Nginx ignorée"
            return
        fi
    else
        sudo apt install -y nginx
    fi
    
    # Démarrage et activation de Nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    print_success "Nginx installé et configuré"
}

# Installation des dépendances pour Puppeteer
install_puppeteer_deps() {
    print_separator
    print_status "Installation des dépendances Puppeteer..."
    
    sudo apt-get update
    sudo apt-get install -y \
        fonts-liberation \
        gconf-service \
        libappindicator1 \
        libasound2 \
        libatk1.0-0 \
        libcairo-gobject2 \
        libdrm2 \
        libgconf-2-4 \
        libgtk-3-0 \
        libgtk2.0-0 \
        libnspr4 \
        libnss3 \
        libx11-xcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        wget \
        xdg-utils \
        fonts-noto-color-emoji
    
    print_success "Dépendances Puppeteer installées"
}

# Clonage et configuration du projet
setup_project() {
    print_separator
    print_status "Configuration du projet TheraFact..."
    
    # Suppression du répertoire s'il existe déjà
    if [ -d "$PROJECT_DIR" ]; then
        print_warning "Le répertoire $PROJECT_DIR existe déjà"
        read -p "Voulez-vous le supprimer et recommencer ? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo rm -rf $PROJECT_DIR
        else
            print_error "Installation annulée"
            exit 1
        fi
    fi
    
    # Création du répertoire et clonage
    sudo mkdir -p $PROJECT_DIR
    sudo chown -R $USER:$USER $PROJECT_DIR
    
    print_status "Clonage du projet depuis GitHub..."
    git clone $GITHUB_REPO $PROJECT_DIR
    
    cd $PROJECT_DIR
    
    # Vérification des fichiers essentiels
    if [ ! -f "package.json" ]; then
        print_error "Fichier package.json non trouvé dans le projet"
        exit 1
    fi
    
    if [ ! -f "server.js" ]; then
        print_error "Fichier server.js non trouvé dans le projet"
        exit 1
    fi
    
    print_success "Projet cloné avec succès"
}

# Installation des dépendances Node.js
install_dependencies() {
    print_separator
    print_status "Installation des dépendances Node.js..."
    
    cd $PROJECT_DIR
    
    # Installation des dépendances
    npm ci --production
    
    print_success "Dépendances installées avec succès"
    
    # Affichage des dépendances installées
    print_status "Dépendances installées :"
    npm list --depth=0
}

# Configuration de PM2
configure_pm2() {
    print_separator
    print_status "Configuration de PM2..."
    
    cd $PROJECT_DIR
    
    # Vérifier si ecosystem.config.js existe
    if [ ! -f "ecosystem.config.js" ]; then
        print_warning "Fichier ecosystem.config.js non trouvé, création d'un fichier par défaut..."
        
        cat > ecosystem.config.js << 'EOL'
module.exports = {
  apps: [{
    name: 'therafact',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Options de logging
    log_file: '/var/log/pm2/therafact.log',
    out_file: '/var/log/pm2/therafact-out.log',
    error_file: '/var/log/pm2/therafact-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Options de redémarrage
    max_memory_restart: '500M',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Options avancées
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'data', 'public'],
    
    // Variables d'environnement pour Puppeteer
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      PUPPETEER_ARGS: '--no-sandbox --disable-setuid-sandbox'
    }
  }]
};
EOL
    fi
    
    # Création du répertoire de logs
    sudo mkdir -p /var/log/pm2
    sudo chown -R $USER:$USER /var/log/pm2
    
    # Création des répertoires de données
    mkdir -p data public/Facts public/Devis
    
    # Création des fichiers de données s'ils n'existent pas
    [ ! -f "data/clients.tsv" ] && echo -e "id\tnom\tprenom\ttelephone\temail\tadresse\tville\tnotes\tdefaultTarifId\tstatut\tdateCreation" > data/clients.tsv
    [ ! -f "data/tarifs.tsv" ] && echo -e "id\tlibelle\tmontant" > data/tarifs.tsv
    [ ! -f "data/seances.tsv" ] && echo -e "id_seance\tid_client\tdate_heure_seance\tid_tarif\tmontant_facture\tstatut_seance\tmode_paiement\tdate_paiement\tinvoice_number\tdevis_number" > data/seances.tsv
    
    # Création du fichier de configuration par défaut
    if [ ! -f "data/settings.json" ]; then
        cat > data/settings.json << 'EOL'
{
  "manager": {
    "nom": "Votre Nom",
    "titre": "Thérapeute",
    "adresse": "Votre Adresse",
    "ville": "Votre Ville",
    "telephone": "Votre Téléphone",
    "email": "votre.email@exemple.com"
  },
  "tva": 0,
  "mentions": {
    "tva": "TVA non applicable, art. 293 B du CGI",
    "paiement": "Paiement à réception de facture",
    "assurance": "Assurance RCP : Compagnie d'assurance"
  }
}
EOL
    fi
    
    # Démarrage de l'application avec PM2
    pm2 start ecosystem.config.js --env production
    pm2 save
    
    print_success "Application démarrée avec PM2"
    pm2 status
}

# Configuration de Nginx
configure_nginx() {
    print_separator
    print_status "Configuration de Nginx..."
    
    # Sauvegarde de la configuration par défaut
    sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
    
    # Création de la configuration pour TheraFact
    sudo tee /etc/nginx/sites-available/$PROJECT_NAME > /dev/null << EOL
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Logs
    access_log /var/log/nginx/${PROJECT_NAME}.access.log;
    error_log /var/log/nginx/${PROJECT_NAME}.error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;

    # Servir les fichiers statiques directement
    location /public/ {
        alias $PROJECT_DIR/public/;
        expires 7d;
        add_header Cache-Control "public";
        try_files \$uri \$uri/ =404;
    }

    # Reverse proxy vers Node.js
    location / {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3000;
        access_log off;
    }

    # Bloquer l'accès aux fichiers sensibles
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~ \.(tsv|json)\$ {
        location ~ ^/public/ {
            # Autoriser l'accès aux fichiers publics
        }
        deny all;
    }
}
EOL
    
    # Activation de la configuration
    sudo ln -sf /etc/nginx/sites-available/$PROJECT_NAME /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test de la configuration
    sudo nginx -t
    
    # Redémarrage de Nginx
    sudo systemctl reload nginx
    
    print_success "Nginx configuré avec succès"
}

# Configuration du firewall
configure_firewall() {
    print_separator
    print_status "Configuration du firewall..."
    
    # Vérifier si UFW est installé
    if command -v ufw &> /dev/null; then
        sudo ufw --force enable
        sudo ufw allow ssh
        sudo ufw allow 'Nginx Full'
        sudo ufw status
        print_success "Firewall UFW configuré"
    else
        print_warning "UFW non installé, configuration ignorée"
    fi
}

# Création des scripts de gestion
create_management_scripts() {
    print_separator
    print_status "Création des scripts de gestion..."
    
    cd $PROJECT_DIR
    
    # Script de déploiement
    cat > deploy.sh << 'EOL'
#!/bin/bash
cd /var/www/therafact

echo "🚀 Démarrage du déploiement..."

# Sauvegarder les données
echo "📦 Sauvegarde des données..."
cp -r data/ data_backup_$(date +%Y%m%d_%H%M%S)/

# Mise à jour du code
echo "📥 Mise à jour du code..."
git pull origin main

# Installation des dépendances
echo "📦 Installation des dépendances..."
npm ci --production

# Redémarrage avec PM2
echo "🔄 Redémarrage de l'application..."
pm2 reload ecosystem.config.js --env production

echo "✅ Déploiement terminé avec succès!"
pm2 status
EOL
    
    # Script de monitoring
    cat > monitor.sh << 'EOL'
#!/bin/bash

echo "📊 Statut des services TheraFact"
echo "================================="

echo "🟢 PM2 Status:"
pm2 status

echo -e "\n🟢 Nginx Status:"
sudo systemctl status nginx --no-pager -l

echo -e "\n📊 Utilisation système:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')%"
echo "RAM: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "Disque: $(df -h / | awk 'NR==2{print $3 "/" $2 " (" $5 " utilisé)"}')"

echo -e "\n📝 Logs récents PM2:"
pm2 logs --lines 10 --nostream

echo -e "\n📝 Logs récents Nginx:"
sudo tail -5 /var/log/nginx/therafact.access.log
EOL
    
    # Script de sauvegarde
    cat > backup.sh << 'EOL'
#!/bin/bash

BACKUP_DIR="/var/backups/therafact"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="therafact_backup_$DATE.tar.gz"

echo "💾 Création de la sauvegarde..."

# Créer le répertoire de sauvegarde
sudo mkdir -p $BACKUP_DIR

# Créer l'archive
tar -czf /tmp/$BACKUP_FILE \
    --exclude='node_modules' \
    --exclude='.git' \
    -C /var/www therafact/

# Déplacer vers le répertoire de sauvegarde
sudo mv /tmp/$BACKUP_FILE $BACKUP_DIR/

echo "✅ Sauvegarde créée: $BACKUP_DIR/$BACKUP_FILE"

# Garder seulement les 10 dernières sauvegardes
sudo find $BACKUP_DIR -name "therafact_backup_*.tar.gz" -type f -mtime +10 -delete

echo "🗂️  Sauvegardes disponibles:"
sudo ls -lah $BACKUP_DIR/
EOL
    
    # Rendre les scripts exécutables
    chmod +x deploy.sh monitor.sh backup.sh
    
    print_success "Scripts de gestion créés"
}

# Vérification finale
final_check() {
    print_separator
    print_status "Vérification finale de l'installation..."
    
    # Test de l'application
    sleep 5
    
    if curl -f -s http://localhost:3000 > /dev/null; then
        print_success "✅ Application Node.js accessible sur le port 3000"
    else
        print_error "❌ Application Node.js non accessible"
    fi
    
    if curl -f -s http://localhost > /dev/null; then
        print_success "✅ Nginx fonctionne et proxy vers l'application"
    else
        print_error "❌ Nginx ne fonctionne pas correctement"
    fi
    
    # Vérifier PM2
    if pm2 list | grep -q "therafact"; then
        print_success "✅ Application gérée par PM2"
    else
        print_error "❌ Application non trouvée dans PM2"
    fi
}

# Affichage des informations finales
display_final_info() {
    print_separator
    print_success "🎉 Installation terminée avec succès !"
    print_separator
    
    echo -e "${GREEN}Informations importantes :${NC}"
    echo "• Application : http://$DOMAIN"
    echo "• Répertoire : $PROJECT_DIR"
    echo "• Logs PM2 : pm2 logs therafact"
    echo "• Logs Nginx : /var/log/nginx/therafact.*.log"
    echo ""
    echo -e "${YELLOW}Scripts de gestion disponibles :${NC}"
    echo "• $PROJECT_DIR/deploy.sh - Déploiement"
    echo "• $PROJECT_DIR/monitor.sh - Monitoring"
    echo "• $PROJECT_DIR/backup.sh - Sauvegarde"
    echo ""
    echo -e "${YELLOW}Commandes utiles :${NC}"
    echo "• pm2 status - Statut des applications"
    echo "• pm2 restart therafact - Redémarrer l'app"
    echo "• pm2 logs therafact - Voir les logs"
    echo "• sudo systemctl status nginx - Statut Nginx"
    echo ""
    echo -e "${BLUE}Configuration de l'email (optionnel) :${NC}"
    echo "Éditez le fichier data/settings.json pour configurer"
    echo "les variables d'environnement GMAIL_USER et GMAIL_APP_PASSWORD"
    echo "pour l'envoi d'emails avec les factures/devis."
    
    print_separator
}

# Fonction principale
main() {
    print_separator
    echo -e "${GREEN}🏥 Installation de TheraFact - Application de Facturation pour Thérapeutes${NC}"
    print_separator
    
    print_status "Début de l'installation..."
    
    check_root
    update_system
    install_nodejs
    install_pm2
    install_nginx
    install_puppeteer_deps
    setup_project
    install_dependencies
    configure_pm2
    configure_nginx
    configure_firewall
    create_management_scripts
    final_check
    display_final_info
    
    print_success "Installation terminée ! 🎉"
}

# Exécution du script principal
main "$@"
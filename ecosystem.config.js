module.exports = { // Configuration de PM2
    apps: [
      {
        name: 'TheraFact', //  Therapie Facturation
        script: 'server.js',          // Le fichier principal de ton application
        watch: true,                      // Active la surveillance des fichiers
        ignore_watch: ['node_modules', 'logs', 'data', 'docs'],  // Liste des fichiers/répertoires à ignorer
        env: {
          NODE_ENV: 'development',        // Définir l'environnement pour le développement
        },
        env_production: {
          NODE_ENV: 'production',         // Environnement de production
        },
      },
    ],
  };
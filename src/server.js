// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { loadAndInitializeOAuthClient, authState } = require('./controllers/authController'); // Importer authState
const { exit } = require('process');
const defaultPort = 3000;

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

require('./routes')(app);


async function startServer() {
    await loadAndInitializeOAuthClient();
    const PORT = process.env.PORT || defaultPort;

    if (process.env.PORT > 1 && process.env.PORT < 65536) {
        // console.log('< process.env >',process.env);
    } else {
        console.warn(`Avertissement: process.env.PORT (${process.env.PORT}) non défini dans les variables d'environnement. Utilisation du port par défaut ${defaultPort}.`);
        console.warn('pm2 reload ecosystem.config.js')
    }

    app.listen(PORT, () => {
        console.log(`API on http://localhost:${PORT} > mode [${process.env.NODE_ENV}]`);
        console.log("\n--- Vérifications au démarrage ---");

        // Ce test fonctionne car il vérifie une propriété sur un objet partagé
        if (!authState.oauth2Client) {
            console.error("❌ ERREUR CRITIQUE: Client OAuth2 non initialisé. Vérifiez votre fichier OAuth2.0.json.");
        } else {
            console.log("✅ OAuth2: Client initialisé. Le serveur est prêt à accepter les connexions Google.");
        }
        
        try {
            require.resolve('jspdf');
            console.log("✅ jsPDF: Le module est prêt pour la génération de PDF.");
        } catch(e) {
            console.warn("🟡 jsPDF: Le module 'jspdf' n'est pas installé. La génération de PDF ne fonctionnera pas.");
        }

        console.log("---------------------------------\n");
        console.log("Le serveur attend la connexion d'un utilisateur pour activer les services Google (Mail, Calendar)...");
    });
}

startServer().catch(error => {
    console.error("Impossible de démarrer le serveur:", error);
    exit(1);
});
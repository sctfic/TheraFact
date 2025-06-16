// controllers/authController.js
const { google } = require('googleapis');
const { readSettingsJson, writeSettingsJson, getDataPath } = require('../helpers/fileHelper');
const calendarHelper = require('../helpers/calendarHelper');
const path = require('path');
const fs = require('fs').promises;
const { PATHS } = require('../config/constants');

const OAUTH_CREDENTIALS_PATH = path.join(__dirname, '../../OAuth2.0.json');

// Centralisation de l'état dans un seul objet partagé
const authState = {
    oauth2Client: null,
    googleOAuthConfig: {},
    activeGoogleAuthTokens: {
        accessToken: null,
        refreshToken: null,
        expiryDate: null,
        userEmail: null,
        scopes: []
    }
};

async function loadAndInitializeOAuthClient() {
    try {
        const credentialsContent = await fs.readFile(OAUTH_CREDENTIALS_PATH, 'utf8');
        const credentials = JSON.parse(credentialsContent);
        if (!credentials.web || !credentials.web.client_id || !credentials.web.client_secret || !credentials.web.redirect_uris) {
            throw new Error("Fichier OAuth2.0.json mal formaté ou incomplet.");
        }
        authState.googleOAuthConfig = {
            clientId: credentials.web.client_id,
            clientSecret: credentials.web.client_secret,
            redirectUri: credentials.web.redirect_uris[0]
        };

        // On modifie la propriété de l'objet authState, qui sera visible partout
        authState.oauth2Client = new google.auth.OAuth2(
            authState.googleOAuthConfig.clientId,
            authState.googleOAuthConfig.clientSecret,
            authState.googleOAuthConfig.redirectUri
        );
        console.log("Client OAuth2 initialisé.");

    } catch (error) {
        console.error("Erreur critique chargement/initialisation OAuth2:", error.message);
        authState.oauth2Client = null;
        calendarHelper.setAuth(null);
    }
}

function handleGoogleAuth(req, res) {
    if (!authState.oauth2Client) {
        return res.status(500).send("Erreur: Configuration OAuth2 non initialisée.");
    }
    const scopes = [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email', 
        'https://www.googleapis.com/auth/userinfo.profile' 
    ];
    const authorizeUrl = authState.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent' 
    });
    res.redirect(authorizeUrl);
}

async function handleGoogleCallback(req, res) {
    if (!authState.oauth2Client) {
        return res.status(500).send("Erreur: Configuration OAuth2 non initialisée.");
    }
    const { code } = req.query;
    if (!code) {
        return res.status(400).send("Erreur: Code d'autorisation manquant.");
    }
    try {
        const { tokens } = await authState.oauth2Client.getToken(code);
        authState.oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: authState.oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const userEmail = userInfo.data.email;
        const userName = userInfo.data.name;
        const profilePictureUrl = userInfo.data.picture;

        authState.activeGoogleAuthTokens.accessToken = tokens.access_token;
        authState.activeGoogleAuthTokens.refreshToken = tokens.refresh_token || authState.activeGoogleAuthTokens.refreshToken;
        authState.activeGoogleAuthTokens.expiryDate = tokens.expiry_date;
        authState.activeGoogleAuthTokens.userEmail = userEmail;
        authState.activeGoogleAuthTokens.scopes = tokens.scope ? tokens.scope.split(' ') : [];

        const userPath = getDataPath(userEmail);
        await fs.mkdir(userPath, { recursive: true });
        await fs.mkdir(path.join(userPath, PATHS.DEVIS_DIR), { recursive: true });
        await fs.mkdir(path.join(userPath, PATHS.FACTS_DIR), { recursive: true });

        let settings = await readSettingsJson(userEmail);
        settings.googleOAuth = {
            userEmail: userEmail,
            userName: userName,
            profilePictureUrl: profilePictureUrl,
            refreshToken: authState.activeGoogleAuthTokens.refreshToken,
            scopes: authState.activeGoogleAuthTokens.scopes
        };
        if (settings.manager && !settings.manager.email) { 
            settings.manager.email = userEmail;
        }
        await writeSettingsJson(settings, userEmail);

        console.log(`Tokens obtenus et sauvegardés pour ${userEmail}. Refresh token présent: ${!!authState.activeGoogleAuthTokens.refreshToken}`);
        calendarHelper.setAuth(authState.oauth2Client);

        res.redirect('/index.html?oauth_success=true#viewConfig');
    } catch (error) {
        console.error("Erreur lors de l'échange du code ou de la sauvegarde des jetons:", error.message, error.stack);
        res.status(500).send(`Erreur d'authentification Google: ${error.message}`);
    }
}

async function handleGoogleDisconnect(req, res) {
    // Note: la vérification originale `if (!oauth2Client)` était incorrecte,
    // il faut vérifier `authState.oauth2Client`.
    if (!authState.oauth2Client) {
        return res.status(500).json({ success: false, message: "Configuration OAuth non initialisée." });
    }
    try {
        const userEmail = authState.activeGoogleAuthTokens.userEmail;
        const settings = await readSettingsJson(userEmail);
        const refreshTokenToRevoke = settings.googleOAuth ? settings.googleOAuth.refreshToken : null;

        if (refreshTokenToRevoke) {
            await authState.oauth2Client.revokeToken(refreshTokenToRevoke);
            console.log("Jeton de rafraîchissement révoqué avec succès pour", userEmail);
        }
        
        settings.googleOAuth = { userEmail: null, userName: null, profilePictureUrl: null, refreshToken: null, scopes: [] };
        await writeSettingsJson(settings, userEmail);

        authState.activeGoogleAuthTokens = { accessToken: null, refreshToken: null, expiryDate: null, userEmail: null, scopes: [] };
        authState.oauth2Client.setCredentials(null);
        calendarHelper.setAuth(null);

        res.json({ success: true, message: "Compte Google déconnecté avec succès." });
    } catch (error) {
        console.error("Erreur lors de la déconnexion du compte Google:", error.message);
        // ... (gestion d'erreur)
        res.status(500).json({ success: false, message: `Erreur lors de la déconnexion: ${error.message}` });
    }
}

// Exporter l'objet d'état et les fonctions
module.exports = {
    loadAndInitializeOAuthClient,
    handleGoogleAuth,
    handleGoogleCallback,
    handleGoogleDisconnect,
    authState // Exporter l'objet entier
};
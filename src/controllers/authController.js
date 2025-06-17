// controllers/authController.js
const { google } = require('googleapis');
const { readSettingsJson, writeSettingsJson, getDataPath } = require('../helpers/fileHelper');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { PATHS } = require('../config/constants');

const OAUTH_CREDENTIALS_PATH = path.join(__dirname, '../../OAuth2.0.json');

const authState = {
    oauth2Client: null,
    googleOAuthConfig: {},
};

const sessionStore = new Map();

async function loadAndInitializeOAuthClient() {
    try {
        const credentialsContent = await fs.readFile(OAUTH_CREDENTIALS_PATH, 'utf8');
        const credentials = JSON.parse(credentialsContent);
        authState.googleOAuthConfig = {
            clientId: credentials.web.client_id,
            clientSecret: credentials.web.client_secret,
            redirectUri: credentials.web.redirect_uris[0]
        };
        authState.oauth2Client = new google.auth.OAuth2(
            authState.googleOAuthConfig.clientId,
            authState.googleOAuthConfig.clientSecret,
            authState.googleOAuthConfig.redirectUri
        );
        console.log("Client OAuth2 de base initialisé.");
    } catch (error) {
        console.error("Erreur critique chargement/initialisation OAuth2:", error.message);
        authState.oauth2Client = null;
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
        if (!tokens.refresh_token) {
            return res.status(400).send("Le jeton de rafraîchissement (refresh_token) est manquant. Veuillez révoquer l'accès de l'application dans les paramètres de votre compte Google et réessayez.");
        }

        const tempClient = new google.auth.OAuth2(authState.googleOAuthConfig.clientId);
        tempClient.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: tempClient });
        const userInfo = await oauth2.userinfo.get();
        const userEmail = userInfo.data.email;

        const sessionId = crypto.randomBytes(32).toString('hex');
        sessionStore.set(sessionId, {
            refreshToken: tokens.refresh_token,
            userEmail: userEmail
        });
        
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000
        };
        res.cookie('session_id', sessionId, cookieOptions);
        
        const userPath = getDataPath(userEmail);
        await fs.mkdir(userPath, { recursive: true });
        await fs.mkdir(path.join(userPath, PATHS.DEVIS_DIR), { recursive: true });
        await fs.mkdir(path.join(userPath, PATHS.FACTS_DIR), { recursive: true });
        let settings = await readSettingsJson(userEmail);

        // --- CORRECTION APPLIQUÉE ICI ---
        settings.googleOAuth = { 
            userEmail: userEmail, 
            userName: userInfo.data.name, 
            profilePictureUrl: userInfo.data.picture,
            // On extrait la chaîne de scopes, on la sépare par les espaces, et on la sauvegarde
            scopes: tokens.scope ? tokens.scope.split(' ') : [] 
        };
        // --- FIN DE LA CORRECTION ---

        await writeSettingsJson(settings, userEmail);

        console.log(`Session créée pour ${userEmail}.`);
        res.redirect('/index.html?oauth_success=true#viewConfig');

    } catch (error) {
        console.error("Erreur lors de l'échange du code:", error.message, error.stack);
        res.status(500).send(`Erreur d'authentification Google: ${error.message}`);
    }
}

async function handleGoogleDisconnect(req, res) {
    const sessionId = req.cookies.session_id;
    if (!sessionId) {
        return res.status(400).json({ success: false, message: "Session non trouvée." });
    }

    const session = sessionStore.get(sessionId);
    if (session && session.refreshToken) {
        try {
            await authState.oauth2Client.revokeToken(session.refreshToken);
            console.log(`Jeton révoqué pour la session de ${session.userEmail}.`);
        } catch (error) {
            console.error("Erreur lors de la révocation du jeton (le jeton était peut-être déjà invalide) :", error.message);
        }
    }
    
    sessionStore.delete(sessionId);
    res.clearCookie('session_id');
    res.json({ success: true, message: "Déconnexion réussie." });
}

module.exports = {
    loadAndInitializeOAuthClient,
    handleGoogleAuth,
    handleGoogleCallback,
    handleGoogleDisconnect,
    authState,
    sessionStore
};
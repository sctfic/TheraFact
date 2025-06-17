// middlewares/authMiddleware.js
const { google } = require('googleapis');
const { authState, sessionStore } = require('../controllers/authController');

async function isGoogleAuthenticated(req, res, next) {
    const sessionId = req.cookies.session_id;
    const session = sessionId ? sessionStore.get(sessionId) : null;

    // Si une session valide existe, on authentifie l'utilisateur
    if (session && session.refreshToken) {
        try {
            const requestOauth2Client = new google.auth.OAuth2(
                authState.googleOAuthConfig.clientId,
                authState.googleOAuthConfig.clientSecret,
                authState.googleOAuthConfig.redirectUri
            );
            
            requestOauth2Client.setCredentials({ refresh_token: session.refreshToken });

            const { token: accessToken } = await requestOauth2Client.getAccessToken();
            if (!accessToken) {
                throw new Error("Impossible d'obtenir un jeton d'accès.");
            }
            
            // On enrichit la requête avec les infos de l'utilisateur authentifié
            req.oauth2Client = requestOauth2Client;
            req.userEmail = session.userEmail;
            req.isDemo = false; // Ce n'est pas une session de démo

            return next();

        } catch (error) {
            // Le jeton de session est invalide ou expiré, on le nettoie
            console.error("Jeton de session invalide:", error.message);
            sessionStore.delete(sessionId);
            res.clearCookie('session_id');
            // On continue en mode démo
        }
    }

    // Si aucune session valide n'a été trouvée, on continue en mode démo
    console.log("Aucune session valide, passage en mode démo pour la requête.");
    req.userEmail = null;       // getDataPath(null) pointera vers le dossier 'demo'
    req.oauth2Client = null;    // Pas de client OAuth pour le mode démo
    req.isDemo = true;          // On marque la requête comme étant une démo
    
    next();
}

module.exports = { isGoogleAuthenticated };
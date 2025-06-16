// helpers/emailHelper.js
const nodemailer = require('nodemailer');
const { oauth2Client, activeGoogleAuthTokens, googleOAuthConfig } = require('../controllers/authController');

async function createTransporter() {
    if (!oauth2Client || !activeGoogleAuthTokens.userEmail || !activeGoogleAuthTokens.refreshToken) {
        throw new Error("Configuration Gmail (OAuth2) incomplète ou invalide sur le serveur.");
    }

    // S'assurer que les credentials du client oauth sont à jour avec le refresh token
    oauth2Client.setCredentials({
        refresh_token: activeGoogleAuthTokens.refreshToken
    });
    
    let accessTokenForMail = activeGoogleAuthTokens.accessToken;
    // Rafraîchir le jeton d'accès s'il est manquant ou sur le point d'expirer
    if (!accessTokenForMail || (activeGoogleAuthTokens.expiryDate && activeGoogleAuthTokens.expiryDate < Date.now() + 60000 )) {
        try {
            const { token, expiry_date } = await oauth2Client.getAccessToken(); 
            accessTokenForMail = token;
            // Mettre à jour l'état global
            activeGoogleAuthTokens.accessToken = token; 
            activeGoogleAuthTokens.expiryDate = expiry_date;
        } catch (refreshError) {
            console.error("Erreur lors du rafraîchissement du jeton d'accès pour Nodemailer:", refreshError.response?.data || refreshError.message);
            throw new Error(`Impossible de rafraîchir le jeton d'accès Google: ${refreshError.message}`);
        }
    }

    // Créer le transporteur avec les informations à jour
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: activeGoogleAuthTokens.userEmail,
            clientId: googleOAuthConfig.clientId,
            clientSecret: googleOAuthConfig.clientSecret,
            refreshToken: activeGoogleAuthTokens.refreshToken,
            accessToken: accessTokenForMail, 
            expires: activeGoogleAuthTokens.expiryDate 
        }
    });
}

async function sendEmailWithNodemailer(mailOptions) {
    const transporter = await createTransporter();
    return transporter.sendMail(mailOptions);
}

/**
 * NOUVELLE FONCTION
 * Vérifie la connexion au service de messagerie de Google en utilisant les credentials OAuth2.
 * @returns {Promise<boolean>} Renvoie true si la connexion est réussie.
 * @throws {Error} Lance une erreur si la vérification échoue.
 */
async function verifyMailConnection() {
    try {
        const transporter = await createTransporter();
        await transporter.verify();
        return true;
    } catch (error) {
        throw new Error(`La vérification de la connexion à Gmail a échoué : ${error.message}`);
    }
}

module.exports = {
    sendEmailWithNodemailer,
    verifyMailConnection // Exporter la nouvelle fonction
};
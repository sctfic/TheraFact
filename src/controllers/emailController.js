// controllers/emailController.js
const { authState } = require('./authController');
const nodemailer = require('nodemailer');
const { readSettingsJson, getDataPath } = require('../helpers/fileHelper');
const { generatePdfWithJspdf } = require('../helpers/documentHelper');
const { PATHS } = require('../config/constants');
const fs = require('fs').promises;
const path = require('path');

async function sendInvoiceByEmail(req, res) {
    const { invoiceNumber } = req.params;
    const { clientEmail } = req.body;
    const userEmail = authState.activeGoogleAuthTokens.userEmail;
    const dataPath = getDataPath(userEmail);

    if (!clientEmail) return res.status(400).json({ message: "Email client requis." });
    
    try {
        const settings = await readSettingsJson(userEmail); 
        const factsDir = path.join(dataPath, PATHS.FACTS_DIR);
        const invoiceJsonPath = path.join(factsDir, `${invoiceNumber}.json`);
        const invoiceData = JSON.parse(await fs.readFile(invoiceJsonPath, 'utf8'));
        
        const pdfBuffer = await generatePdfWithJspdf(invoiceData);
        
        const mailOptions = {
            from: `"${settings.manager.name || 'Votre Cabinet'}" <${authState.activeGoogleAuthTokens.userEmail}>`, 
            to: clientEmail, 
            cc: authState.activeGoogleAuthTokens.userEmail, 
            subject: `Facture ${invoiceNumber} - ${settings.manager.name || 'Votre Cabinet'}`,
            html: `Bonjour,<br><br>Veuillez trouver ci-joint votre facture N° ${invoiceNumber}.<br><br>Cordialement,<br>${settings.manager.name}`,
            attachments: [{ filename: `Facture-${invoiceNumber}.pdf`, content: Buffer.from(pdfBuffer), contentType: 'application/pdf' }]
        };
        await sendEmailWithNodemailer(mailOptions);
        res.status(200).json({ message: `Facture ${invoiceNumber} envoyée à ${clientEmail}.` });
    } catch (error) {
        console.error(`Erreur envoi email facture ${invoiceNumber}:`, error);
        res.status(500).json({ message: `Échec envoi email: ${error.message}` });
    }
}

async function sendDevisByEmail(req, res) {
    const { devisNumber } = req.params;
    const { clientEmail } = req.body;
    const userEmail = authState.activeGoogleAuthTokens.userEmail;
    const dataPath = getDataPath(userEmail);

    if (!clientEmail) return res.status(400).json({ message: "Email client requis." });
    
    try {
        const settings = await readSettingsJson(userEmail);
        const devisDir = path.join(dataPath, PATHS.DEVIS_DIR);
        const devisJsonPath = path.join(devisDir, `${devisNumber}.json`);
        const devisData = JSON.parse(await fs.readFile(devisJsonPath, 'utf8'));

        const pdfBuffer = await generatePdfWithJspdf(devisData);
        
        const mailOptions = {
            from: `"${settings.manager.name || 'Votre Cabinet'}" <${authState.activeGoogleAuthTokens.userEmail}>`,
            to: clientEmail, 
            cc: authState.activeGoogleAuthTokens.userEmail,
            subject: `Devis ${devisNumber} - ${settings.manager.name || 'Votre Cabinet'}`,
            html: `Bonjour,<br><br>Veuillez trouver ci-joint le devis N° ${devisNumber} demandé.<br><br>Cordialement,<br>${settings.manager.name}`,
            attachments: [{ filename: `Devis-${devisNumber}.pdf`, content: Buffer.from(pdfBuffer), contentType: 'application/pdf' }]
        };
        await sendEmailWithNodemailer(mailOptions);
        res.status(200).json({ message: `Devis ${devisNumber} envoyé à ${clientEmail}.` });
    } catch (error) {
        console.error(`Erreur envoi email devis ${devisNumber}:`, error);
        res.status(500).json({ message: `Échec envoi email: ${error.message}` });
    }
}

async function sendEmailWithNodemailer(mailOptions) {
    if (!authState.oauth2Client || !authState.activeGoogleAuthTokens.userEmail || !authState.activeGoogleAuthTokens.refreshToken) {
        throw new Error("Configuration Gmail (OAuth2) incomplète ou invalide sur le serveur.");
    }

    authState.oauth2Client.setCredentials({
        refresh_token: authState.activeGoogleAuthTokens.refreshToken
    });
    
    let accessTokenForMail = authState.activeGoogleAuthTokens.accessToken;
    if (!accessTokenForMail || (authState.activeGoogleAuthTokens.expiryDate && authState.activeGoogleAuthTokens.expiryDate < Date.now() + 60000 )) {
        try {
            const { token, expiry_date } = await authState.oauth2Client.getAccessToken(); 
            accessTokenForMail = token;
            authState.activeGoogleAuthTokens.accessToken = token; 
            authState.activeGoogleAuthTokens.expiryDate = expiry_date;
        } catch (refreshError) {
            throw new Error(`Impossible de rafraîchir le jeton d'accès Google: ${refreshError.message}`);
        }
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: authState.activeGoogleAuthTokens.userEmail,
            clientId: authState.googleOAuthConfig.clientId,
            clientSecret: authState.googleOAuthConfig.clientSecret,
            refreshToken: authState.activeGoogleAuthTokens.refreshToken,
            accessToken: accessTokenForMail, 
            expires: authState.activeGoogleAuthTokens.expiryDate 
        }
    });
    return transporter.sendMail(mailOptions);
}

module.exports = {
    sendInvoiceByEmail,
    sendDevisByEmail
};
// controllers/emailController.js
const { google } = require('googleapis');
const { readSettingsJson, getDataPath } = require('../helpers/fileHelper');
const { generatePdfWithJspdf } = require('../helpers/documentHelper');
const { PATHS } = require('../config/constants');
const fs = require('fs').promises;
const path = require('path');

/**
 * Crée un message MIME compatible avec l'API Gmail
 * @param {Object} mailOptions - Options de l'email
 * @returns {Promise<string>} Message encodé en base64
 */
async function createGmailMessage(mailOptions) {
    const boundary = 'boundary_' + Math.random().toString().substr(2);
    
    let messageParts = [
        `From: ${mailOptions.from}`,
        `To: ${mailOptions.to}`,
        `Cc: ${mailOptions.cc}`,
        `Subject: ${mailOptions.subject}`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        `Content-Type: text/html; charset=utf-8`,
        '',
        mailOptions.html
    ];

    // Ajouter les pièces jointes
    if (mailOptions.attachments && mailOptions.attachments.length > 0) {
        for (const attachment of mailOptions.attachments) {
            messageParts.push(
                `--${boundary}`,
                `Content-Type: ${attachment.contentType}`,
                `Content-Disposition: attachment; filename="${attachment.filename}"`,
                'Content-Transfer-Encoding: base64',
                '',
                attachment.content.toString('base64')
            );
        }
    }

    messageParts.push(`--${boundary}--`);

    const rawMessage = messageParts.join('\n');
    
    return Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Envoi un email via l'API Gmail
 * @param {Object} mailOptions - Options de l'email
 * @param {Object} oauth2Client - Client OAuth2
 * @returns {Promise<Object>} Réponse de l'API Gmail
 */
async function sendEmailWithGmailAPI(mailOptions, oauth2Client) {
    try {
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const encodedMessage = await createGmailMessage(mailOptions);

        const response = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage
            }
        });

        return response.data;
    } catch (error) {
        console.error("Erreur lors de l'envoi via Gmail API:", error);
        throw error;
    }
}

/**
 * Envoie une facture par email
 */
async function sendInvoiceByEmail(req, res) {
    const { invoiceNumber } = req.params;
    const { clientEmail } = req.body;
    const { userEmail, oauth2Client } = req;
    const dataPath = getDataPath(userEmail);

    if (!clientEmail) {
        return res.status(400).json({ message: "Email client requis." });
    }

    try {
        const settings = await readSettingsJson(userEmail);
        const invoiceJsonPath = path.join(dataPath, PATHS.FACTS_DIR, `${invoiceNumber}.json`);
        const invoiceData = JSON.parse(await fs.readFile(invoiceJsonPath, 'utf8'));
        const pdfBuffer = await generatePdfWithJspdf(invoiceData);

        const mailOptions = {
            from: `"${settings.manager.name || 'Votre Cabinet'}" <${userEmail}>`,
            to: clientEmail,
            cc: userEmail,
            subject: `Facture ${invoiceNumber} - ${settings.manager.name || 'Votre Cabinet'}`,
            html: `Bonjour,<br><br>Veuillez trouver ci-joint votre facture N° ${invoiceNumber}.<br><br>Cordialement,<br>${settings.manager.name}`,
            attachments: [{
                filename: `Facture-${invoiceNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        };

        await sendEmailWithGmailAPI(mailOptions, oauth2Client);
        res.status(200).json({ message: `Facture ${invoiceNumber} envoyée à ${clientEmail}.` });
    } catch (error) {
        console.error(`Erreur envoi email facture ${invoiceNumber}:`, error);
        res.status(500).json({ message: `Échec envoi email: ${error.message}` });
    }
}

/**
 * Envoie un devis par email
 */
async function sendDevisByEmail(req, res) {
    const { devisNumber } = req.params;
    const { clientEmail } = req.body;
    const { userEmail, oauth2Client } = req;
    const dataPath = getDataPath(userEmail);

    if (!clientEmail) {
        return res.status(400).json({ message: "Email client requis." });
    }

    try {
        const settings = await readSettingsJson(userEmail);
        const devisJsonPath = path.join(dataPath, PATHS.DEVIS_DIR, `${devisNumber}.json`);
        const devisData = JSON.parse(await fs.readFile(devisJsonPath, 'utf8'));
        const pdfBuffer = await generatePdfWithJspdf(devisData);

        const mailOptions = {
            from: `"${settings.manager.name || 'Votre Cabinet'}" <${userEmail}>`,
            to: clientEmail,
            cc: userEmail,
            subject: `Devis ${devisNumber} - ${settings.manager.name || 'Votre Cabinet'}`,
            html: `Bonjour,<br><br>Veuillez trouver ci-joint le devis N° ${devisNumber} demandé.<br><br>Cordialement,<br>${settings.manager.name}`,
            attachments: [{
                filename: `Devis-${devisNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        };

        await sendEmailWithGmailAPI(mailOptions, oauth2Client);
        res.status(200).json({ message: `Devis ${devisNumber} envoyé à ${clientEmail}.` });
    } catch (error) {
        console.error(`Erreur envoi email devis ${devisNumber}:`, error);
        res.status(500).json({ message: `Échec envoi email: ${error.message}` });
    }
}

module.exports = {
    sendInvoiceByEmail,
    sendDevisByEmail
};
// src/controllers/emailController.js
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
    console.log("createGmailMessage: Début de la création du message MIME.");
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
    console.log("createGmailMessage: Headers et corps HTML ajoutés.");

    // Ajouter les pièces jointes
    if (mailOptions.attachments && mailOptions.attachments.length > 0) {
        console.log(`createGmailMessage: Ajout de ${mailOptions.attachments.length} pièce(s) jointe(s).`);
        for (const attachment of mailOptions.attachments) {
            console.log(`createGmailMessage: Traitement de la pièce jointe "${attachment.filename}".`);
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
    console.log("createGmailMessage: Fin du message MIME.");

    const rawMessage = messageParts.join('\n');
    const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    
    console.log(`createGmailMessage: Message brut de ${rawMessage.length} octets encodé en base64url.`);
    return encodedMessage;
}

/**
 * Envoi un email via l'API Gmail
 * @param {Object} mailOptions - Options de l'email
 * @param {Object} oauth2Client - Client OAuth2
 * @returns {Promise<Object>} Réponse de l'API Gmail
 */
async function sendEmailWithGmailAPI(mailOptions, oauth2Client) {
    try {
        console.log("sendEmailWithGmailAPI: Initialisation de l'API Gmail.");
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        console.log("sendEmailWithGmailAPI: Création du message encodé.");
        const encodedMessage = await createGmailMessage(mailOptions);

        console.log("sendEmailWithGmailAPI: Appel à gmail.users.messages.send...");
        const response = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage
            }
        });

        console.log("sendEmailWithGmailAPI: Réponse de l'API reçue avec succès. ID du message:", response.data.id);
        return response.data;
    } catch (error) {
        console.error("sendEmailWithGmailAPI: Erreur détaillée lors de l'envoi via Gmail API:", error);
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
    
    console.log(`\n--- Début du processus sendInvoiceByEmail pour la facture ${invoiceNumber} ---`);
    console.log(`sendInvoiceByEmail: Destinataire: ${clientEmail}, Utilisateur: ${userEmail}`);

    if (!clientEmail) {
        console.error("sendInvoiceByEmail: Email du client manquant dans la requête.");
        return res.status(400).json({ message: "Email client requis." });
    }

    try {
        const dataPath = getDataPath(userEmail);
        console.log(`sendInvoiceByEmail: Chemin des données déterminé : ${dataPath}`);

        console.log("sendInvoiceByEmail: Lecture du fichier de configuration...");
        const settings = await readSettingsJson(userEmail);
        console.log("sendInvoiceByEmail: Fichier de configuration lu avec succès.");

        const invoiceJsonPath = path.join(dataPath, PATHS.FACTS_DIR, `${invoiceNumber}.json`);
        console.log(`sendInvoiceByEmail: Lecture des données de la facture depuis ${invoiceJsonPath}...`);
        const invoiceData = JSON.parse(await fs.readFile(invoiceJsonPath, 'utf8'));
        console.log("sendInvoiceByEmail: Données de la facture lues avec succès.");

        console.log("sendInvoiceByEmail: Génération du PDF de la facture...");
        const pdfBuffer = await generatePdfWithJspdf(invoiceData);
        console.log(`sendInvoiceByEmail: PDF généré avec succès. Taille du buffer : ${pdfBuffer.byteLength} octets.`);

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

        console.log("sendInvoiceByEmail: Options de l'email construites :", { ...mailOptions, attachments: `[${pdfBuffer.byteLength} octets PDF]` });

        console.log("sendInvoiceByEmail: Appel de la fonction d'envoi...");
        await sendEmailWithGmailAPI(mailOptions, oauth2Client);
        console.log(`sendInvoiceByEmail: Envoi réussi pour la facture ${invoiceNumber}.`);
        
        res.status(200).json({ message: `Facture ${invoiceNumber} envoyée à ${clientEmail}.` });

    } catch (error) {
        console.error(`sendInvoiceByEmail: ERREUR GLOBALE pour la facture ${invoiceNumber}:`, error);
        res.status(500).json({ message: `Échec envoi email: ${error.message}` });
    }
    console.log(`--- Fin du processus sendInvoiceByEmail pour la facture ${invoiceNumber} ---\n`);
}

/**
 * Envoie un devis par email
 */
async function sendDevisByEmail(req, res) {
    const { devisNumber } = req.params;
    const { clientEmail } = req.body;
    const { userEmail, oauth2Client } = req;

    console.log(`\n--- Début du processus sendDevisByEmail pour le devis ${devisNumber} ---`);
    console.log(`sendDevisByEmail: Destinataire: ${clientEmail}, Utilisateur: ${userEmail}`);

    if (!clientEmail) {
        console.error("sendDevisByEmail: Email du client manquant dans la requête.");
        return res.status(400).json({ message: "Email client requis." });
    }

    try {
        const dataPath = getDataPath(userEmail);
        console.log(`sendDevisByEmail: Chemin des données déterminé : ${dataPath}`);

        console.log("sendDevisByEmail: Lecture du fichier de configuration...");
        const settings = await readSettingsJson(userEmail);
        console.log("sendDevisByEmail: Fichier de configuration lu avec succès.");

        const devisJsonPath = path.join(dataPath, PATHS.DEVIS_DIR, `${devisNumber}.json`);
        console.log(`sendDevisByEmail: Lecture des données du devis depuis ${devisJsonPath}...`);
        const devisData = JSON.parse(await fs.readFile(devisJsonPath, 'utf8'));
        console.log("sendDevisByEmail: Données du devis lues avec succès.");

        console.log("sendDevisByEmail: Génération du PDF du devis...");
        const pdfBuffer = await generatePdfWithJspdf(devisData);
        console.log(`sendDevisByEmail: PDF généré avec succès. Taille du buffer : ${pdfBuffer.byteLength} octets.`);

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

        console.log("sendDevisByEmail: Options de l'email construites :", { ...mailOptions, attachments: `[${pdfBuffer.byteLength} octets PDF]` });

        console.log("sendDevisByEmail: Appel de la fonction d'envoi...");
        await sendEmailWithGmailAPI(mailOptions, oauth2Client);
        console.log(`sendDevisByEmail: Envoi réussi pour le devis ${devisNumber}.`);

        res.status(200).json({ message: `Devis ${devisNumber} envoyé à ${clientEmail}.` });
    } catch (error) {
        console.error(`sendDevisByEmail: ERREUR GLOBALE pour le devis ${devisNumber}:`, error);
        res.status(500).json({ message: `Échec envoi email: ${error.message}` });
    }
    console.log(`--- Fin du processus sendDevisByEmail pour le devis ${devisNumber} ---\n`);
}

module.exports = {
    sendInvoiceByEmail,
    sendDevisByEmail
};
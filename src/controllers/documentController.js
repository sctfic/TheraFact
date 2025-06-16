// controllers/documentController.js
const { getDataPath } = require('../helpers/fileHelper');
const { authState } = require('./authController');
const { PATHS } = require('../config/constants');
const fs = require('fs').promises;
const path = require('path');

async function getInvoiceJson(req, res) {
    const { invoiceNumber } = req.params;
    const dataPath = getDataPath(authState.activeGoogleAuthTokens.userEmail);

    if (!/^FAC-\d{4}-\d{4,}$/.test(invoiceNumber)) {
        return res.status(400).send('Numéro de facture invalide.');
    }
    const factsDir = path.join(dataPath, PATHS.FACTS_DIR);
    const filePath = path.join(factsDir, `${invoiceNumber}.json`);
    try {
        await fs.access(filePath);
        // Important: Utiliser path.resolve pour obtenir un chemin absolu pour res.sendFile
        res.sendFile(path.resolve(filePath));
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).send('Facture non trouvée.');
        } else {
            console.error(`Erreur accès facture ${invoiceNumber}:`, error);
            res.status(500).send('Erreur serveur.');
        }
    }
}

async function getDevisJson(req, res) {
    const { devisNumber } = req.params;
    const dataPath = getDataPath(authState.activeGoogleAuthTokens.userEmail);
     if (!/^DEV-\d{4}-\d{4,}$/.test(devisNumber)) {
        return res.status(400).send('Numéro de devis invalide.');
    }
    const devisDir = path.join(dataPath, PATHS.DEVIS_DIR);
    const filePath = path.join(devisDir, `${devisNumber}.json`);
    try {
        await fs.access(filePath);
        // Important: Utiliser path.resolve pour obtenir un chemin absolu pour res.sendFile
        res.sendFile(path.resolve(filePath));
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).send('Devis non trouvé.');
        } else {
            console.error(`Erreur accès devis ${devisNumber}:`, error);
            res.status(500).send('Erreur serveur.');
        }
    }
}

module.exports = {
    getInvoiceJson,
    getDevisJson
};
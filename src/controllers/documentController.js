// src/controllers/documentController.js
const { getDataPath } = require('../helpers/fileHelper');
const { generatePdfWithJspdf } = require('../helpers/documentHelper');
const path = require('path');
const fs = require('fs');
const { PATHS } = require('../config/constants');

async function getInvoiceJson(req, res) {
    const { invoiceNumber } = req.params;
    const { userEmail } = req; 
    const dataPath = getDataPath(userEmail);

    if (!/^FAC-\d{4}-\d{4,}$/.test(invoiceNumber)) {
        return res.status(400).send('Numéro de facture invalide.');
    }
    const factsDir = path.join(dataPath, PATHS.FACTS_DIR);
    const filePath = path.join(factsDir, `${invoiceNumber}.json`);
    try {
        await fs.promises.access(filePath);
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
    const { userEmail } = req;
    const dataPath = getDataPath(userEmail);

     if (!/^DEV-\d{4}-\d{4,}$/.test(devisNumber)) {
        return res.status(400).send('Numéro de devis invalide.');
    }
    const devisDir = path.join(dataPath, PATHS.DEVIS_DIR);
    const filePath = path.join(devisDir, `${devisNumber}.json`);
    try {
        await fs.promises.access(filePath);
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

// NOUVEAU : Logique pour servir le PDF
async function serveDocumentPdf(req, res) {
    const { docNumber } = req.params;
    const { userEmail } = req;
    const dataPath = getDataPath(userEmail);
    
    const isDevis = docNumber.startsWith('DEV-');
    const docDir = isDevis ? PATHS.DEVIS_DIR : PATHS.FACTS_DIR;
    const pdfPath = path.join(dataPath, docDir, `${docNumber}.pdf`);
    
    try {
        // 1. Essayer de servir le PDF s'il existe déjà
        await fs.promises.access(pdfPath);
        console.log(`PDF existant trouvé pour ${docNumber}. Service du fichier.`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${docNumber}.pdf"`);
        return fs.createReadStream(pdfPath).pipe(res);
    } catch (error) {
        // 2. Si le PDF n'existe pas (ENOENT), le générer
        if (error.code === 'ENOENT') {
            console.log(`PDF non trouvé pour ${docNumber}. Génération à la volée...`);
            try {
                const jsonPath = path.join(dataPath, docDir, `${docNumber}.json`);
                const jsonData = JSON.parse(await fs.promises.readFile(jsonPath, 'utf8'));
                
                const pdfBuffer = await generatePdfWithJspdf(jsonData);
                if (!pdfBuffer) throw new Error("La génération du PDF a échoué et a renvoyé un buffer nul.");

                // Sauvegarder le PDF nouvellement généré
                await fs.promises.writeFile(pdfPath, pdfBuffer);
                console.log(`Nouveau PDF sauvegardé : ${pdfPath}`);

                // Servir le buffer
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename="${docNumber}.pdf"`);
                return res.send(pdfBuffer);

            } catch (genError) {
                console.error(`Erreur lors de la génération/sauvegarde du PDF pour ${docNumber}:`, genError);
                return res.status(500).send(`Erreur lors de la génération du document ${docNumber}.`);
            }
        }
        
        // Gérer les autres erreurs d'accès
        console.error(`Erreur d'accès au fichier PDF pour ${docNumber}:`, error);
        return res.status(500).send(`Erreur serveur lors de l'accès au document ${docNumber}.`);
    }
}

module.exports = {
    getInvoiceJson,
    getDevisJson,
    serveDocumentPdf // Export de la nouvelle fonction
};
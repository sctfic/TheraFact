// src/controllers/documentController.js
const { getDataPath } = require('../helpers/fileHelper');
const { generatePdfWithJspdf } = require('../helpers/documentHelper'); // Import de la fonction
const path = require('path');
const fs = require('fs').promises;
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
        await fs.access(filePath);
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
        await fs.access(filePath);
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

// NOUVEAU : Fonction de test pour la génération de PDF
async function testPdfGeneration(req, res) {
    console.log("--- Lancement de la génération du PDF de test ---");
    try {
        // 1. Création de données de test complètes
        const testInvoiceData = {
            invoiceNumber: "TEST-2025-0001",
            invoiceDate: new Date().toLocaleDateString('fr-FR'),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString('fr-FR'),
            client: {
                name: "Client de Démonstration",
                address: "123 Rue de l'Exemple",
                city: "75001 Paris",
            },
            service: [
                { Date: "15/06/2025", description: "Séance de test standard", quantity: 1, unitPrice: 60 },
                { Date: "16/06/2025", description: "Consultation approfondie", quantity: 2, unitPrice: 75.50 }
            ],
            tva: 20.0,
            manager: {
                name: "Mon Cabinet Thérapeutique",
                title: "Thérapeute Certifié",
                address: "456 Avenue de la Santé",
                city: "64000 PAU",
                phone: "01 23 45 67 89",
                email: "contact@moncabinet.fr"
            },
            legal: {
                siret: "123 456 789 00010",
                ape: "8690F",
                adeli: "N/A",
                iban: "FR76 3000 4000 0500 0012 3456 789",
                bic: "BNPAFRPPXXX",
                tvaMention: "TVA applicable au taux de 20%",
                paymentTerms: "Paiement à 30 jours.",
                insurance: "Assurance Pro XYZ - Contrat 987654"
            }
        };

        // 2. Appel de la fonction de génération
        const pdfBuffer = await generatePdfWithJspdf(testInvoiceData);
        console.log("PDF de test généré en mémoire.");

        // 3. Sauvegarde du fichier de test
        const testPdfDir = path.join(__dirname, '../../data');
        const testPdfPath = path.join(testPdfDir, 'test.pdf');
        await fs.mkdir(testPdfDir, { recursive: true });
        await fs.writeFile(testPdfPath, pdfBuffer);
        console.log(`Fichier de test sauvegardé dans : ${testPdfPath}`);

        // 4. Envoi du PDF au navigateur
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=test.pdf'); // 'inline' pour l'afficher, 'attachment' pour le télécharger
        res.send(pdfBuffer);
        console.log("PDF de test envoyé au navigateur.");

    } catch (error) {
        console.error("Erreur lors de la génération du PDF de test :", error);
        res.status(500).send("Erreur lors de la génération du PDF de test : " + error.message);
    }
}

module.exports = {
    getInvoiceJson,
    getDevisJson,
    testPdfGeneration // Export de la nouvelle fonction
};
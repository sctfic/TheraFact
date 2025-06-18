// src/routes/documentRoutes.js
const { getInvoiceJson, getDevisJson, testPdfGeneration } = require('../controllers/documentController');
const { isGoogleAuthenticated } = require('../middlewares/authMiddleware');

module.exports = (app) => {
    // Les routes pour les vrais documents nécessitent une authentification
    app.get('/api/data/factures/:invoiceNumber.json', isGoogleAuthenticated, getInvoiceJson);
    app.get('/api/data/devis/:devisNumber.json', isGoogleAuthenticated, getDevisJson);

    // NOUVEAU : Route de test publique pour la génération de PDF
    app.get('/api/test-pdf', testPdfGeneration);
};
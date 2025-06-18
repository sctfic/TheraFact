// src/routes/documentRoutes.js
const { getInvoiceJson, getDevisJson, testPdfGeneration, serveDocumentPdf } = require('../controllers/documentController');
const { isGoogleAuthenticated } = require('../middlewares/authMiddleware');

module.exports = (app) => {
    // NOUVEAU : Route pour visualiser les PDF (factures ou devis)
    app.get('/api/documents/view/:docNumber.pdf', isGoogleAuthenticated, serveDocumentPdf);
    
    // Routes pour récupérer les données JSON (utilisé par invoice.html, maintenant une fallback)
    app.get('/api/data/factures/:invoiceNumber.json', isGoogleAuthenticated, getInvoiceJson);
    app.get('/api/data/devis/:devisNumber.json', isGoogleAuthenticated, getDevisJson);
};
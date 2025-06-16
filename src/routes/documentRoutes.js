const { getInvoiceJson, getDevisJson } = require('../controllers/documentController');

module.exports = (app) => {
    app.get('/api/data/factures/:invoiceNumber.json', getInvoiceJson);
    app.get('/api/data/devis/:devisNumber.json', getDevisJson);
};
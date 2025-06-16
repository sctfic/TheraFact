const { 
    getAllSeances,
    getInvoiceStatus,
    createOrUpdateSeance,
    deleteSeance,
    generateInvoice,
    generateDevis
} = require('../controllers/seanceController');

module.exports = (app) => {
    app.get('/api/seances', getAllSeances);
    app.get('/api/invoice/:invoiceNumber/status', getInvoiceStatus);
    app.post('/api/seances', createOrUpdateSeance);
    app.delete('/api/seances/:id', deleteSeance);
    app.post('/api/seances/:seanceId/generate-invoice', generateInvoice);
    app.post('/api/seances/:seanceId/generate-devis', generateDevis);
};
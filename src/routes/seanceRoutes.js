// routes/seanceRoutes.js
const { 
    getAllSeances,
    getInvoiceStatus,
    createOrUpdateSeance,
    deleteSeance,
    generateInvoice,
    generateDevis
} = require('../controllers/seanceController');
const { isGoogleAuthenticated } = require('../middlewares/authMiddleware');

module.exports = (app) => {
    app.get('/api/seances', isGoogleAuthenticated, getAllSeances);
    app.get('/api/invoice/:invoiceNumber/status', isGoogleAuthenticated, getInvoiceStatus);
    app.post('/api/seances', isGoogleAuthenticated, createOrUpdateSeance);
    app.delete('/api/seances/:id', isGoogleAuthenticated, deleteSeance);
    app.post('/api/seances/:seanceId/generate-invoice', isGoogleAuthenticated, generateInvoice);
    app.post('/api/seances/:seanceId/generate-devis', isGoogleAuthenticated, generateDevis);
};
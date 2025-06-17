// routes/emailRoutes.js
const { sendInvoiceByEmail, sendDevisByEmail } = require('../controllers/emailController');
const { isGoogleAuthenticated } = require('../middlewares/authMiddleware');

module.exports = (app) => {
    // Protéger ces routes, car il faut être connecté pour envoyer un email
    app.post('/api/invoice/:invoiceNumber/send-by-email', isGoogleAuthenticated, sendInvoiceByEmail);
    app.post('/api/devis/:devisNumber/send-by-email', isGoogleAuthenticated, sendDevisByEmail);
};
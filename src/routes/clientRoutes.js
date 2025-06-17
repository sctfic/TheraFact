// routes/clientRoutes.js
const { 
    getAllClients, 
    createOrUpdateClient, 
    deleteClient 
} = require('../controllers/clientController');
const { isGoogleAuthenticated } = require('../middlewares/authMiddleware');

module.exports = (app) => {
    app.get('/api/clients', isGoogleAuthenticated, getAllClients);
    app.post('/api/clients', isGoogleAuthenticated, createOrUpdateClient);
    app.delete('/api/clients/:id', isGoogleAuthenticated, deleteClient);
};
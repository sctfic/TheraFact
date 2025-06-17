// routes/tarifRoutes.js
const { 
    getAllTarifs, 
    createOrUpdateTarif, 
    deleteTarif 
} = require('../controllers/tarifController');
const { isGoogleAuthenticated } = require('../middlewares/authMiddleware');

module.exports = (app) => {
    app.get('/api/tarifs', isGoogleAuthenticated, getAllTarifs);
    app.post('/api/tarifs', isGoogleAuthenticated, createOrUpdateTarif);
    app.delete('/api/tarifs/:id', isGoogleAuthenticated, deleteTarif);
};
// routes/authRoutes.js
const { 
    handleGoogleAuth, 
    handleGoogleCallback, 
    handleGoogleDisconnect 
} = require('../controllers/authController');
const { isGoogleAuthenticated } = require('../middlewares/authMiddleware'); // Importez le middleware

module.exports = (app) => {
    // Ces routes doivent être publiques pour permettre la connexion
    app.get('/api/auth/google', handleGoogleAuth);
    app.get('/api/auth/google/callback', handleGoogleCallback);
    
    // Cette route doit être protégée : on ne peut se déconnecter que si on est connecté
    app.post('/api/auth/google/disconnect', isGoogleAuthenticated, handleGoogleDisconnect);
};
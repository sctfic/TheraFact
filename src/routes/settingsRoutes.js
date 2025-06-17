// routes/settingsRoutes.js
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { isGoogleAuthenticated } = require('../middlewares/authMiddleware');

module.exports = (app) => {
    app.get('/api/settings', isGoogleAuthenticated, getSettings);
    app.post('/api/settings', isGoogleAuthenticated, updateSettings);
};
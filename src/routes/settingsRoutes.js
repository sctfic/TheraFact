const { getSettings, updateSettings } = require('../controllers/settingsController');

module.exports = (app) => {
    app.get('/api/settings', getSettings);
    app.post('/api/settings', updateSettings);
};
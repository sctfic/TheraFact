const { updateSpreadsheet } = require('../controllers/spreadsheetController');
const { isGoogleAuthenticated } = require('../middlewares/authMiddleware');

module.exports = function(app) {
    app.post('/api/export-to-sheets', isGoogleAuthenticated, updateSpreadsheet);
};
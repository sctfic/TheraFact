const authRoutes = require('./authRoutes');
const clientRoutes = require('./clientRoutes');
const tarifRoutes = require('./tarifRoutes');
const seanceRoutes = require('./seanceRoutes');
const settingsRoutes = require('./settingsRoutes');
const documentRoutes = require('./documentRoutes');
const calendarRoutes = require('./calendarRoutes');

module.exports = (app) => {
    authRoutes(app);
    clientRoutes(app);
    tarifRoutes(app);
    seanceRoutes(app);
    settingsRoutes(app);
    documentRoutes(app);
    calendarRoutes(app);
};
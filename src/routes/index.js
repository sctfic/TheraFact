const authRoutes = require('./authRoutes');
const clientRoutes = require('./clientRoutes');
const tarifRoutes = require('./tarifRoutes');
const seanceRoutes = require('./seanceRoutes');
const settingsRoutes = require('./settingsRoutes');
const spreadsheetRoutes = require('./spreadsheetRoutes');
const documentRoutes = require('./documentRoutes');
const calendarRoutes = require('./calendarRoutes');
const emailRoutes = require('./emailRoutes');

module.exports = (app) => {
    authRoutes(app);
    clientRoutes(app);
    tarifRoutes(app);
    seanceRoutes(app);
    settingsRoutes(app);
    spreadsheetRoutes(app);
    documentRoutes(app);
    calendarRoutes(app);
    emailRoutes(app);
};
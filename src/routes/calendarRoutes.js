const { getCalendarAvailability } = require('../controllers/calendarController');

module.exports = (app) => {
    app.get('/api/calendar/availability', getCalendarAvailability);
};
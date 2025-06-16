// controllers/calendarController.js
const { authState } = require('./authController');
const { google } = require('googleapis');

async function getCalendarAvailability(req, res) {
    console.log("Appel reçu sur /api/calendar/availability");
    if (!authState.oauth2Client || !authState.activeGoogleAuthTokens.refreshToken) {
        console.warn("Tentative de récupération des disponibilités sans connexion Google.");
        return res.status(401).json({ message: "Le compte Google n'est pas connecté sur le serveur." });
    }

    try {
        const calendar = google.calendar({ version: 'v3', auth: authState.oauth2Client });
        const calendarId = 'primary';
        const timeMin = new Date();
        const timeMax = new Date();
        timeMax.setDate(timeMin.getDate() + 90);

        const response = await calendar.freebusy.query({
            requestBody: {
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                items: [{ id: calendarId }],
            },
        });

        if (!response.data.calendars || !response.data.calendars[calendarId]) {
            throw new Error(`Le calendrier avec l'ID '${calendarId}' n'a pas été trouvé dans la réponse de l'API.`);
        }

        const busySlots = response.data.calendars[calendarId].busy;
        res.status(200).json(busySlots);

    } catch (error) {
        console.error("Erreur DÉTAILLÉE dans /api/calendar/availability:", error);
        res.status(500).json({
            message: "Erreur lors de la récupération des disponibilités.",
            error: error.message || "Erreur inconnue du serveur."
        });
    }
}

module.exports = {
    getCalendarAvailability
};
// controllers/calendarController.js
const { google } = require('googleapis');

async function getCalendarAvailability(req, res) {
    const { oauth2Client, isDemo } = req;

    // Si on est en mode démo, on renvoie une réponse vide sans contacter Google.
    if (isDemo) {
        console.log("Mode démo : renvoi d'une liste de disponibilités vide.");
        return res.status(200).json([]);
    }

    try {
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
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
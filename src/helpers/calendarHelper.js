// helpers/calendarHelper.js
const { google } = require('googleapis');

let authClient = null;

function setAuth(auth) {
    authClient = auth;
}

function isCalendarConfigured() {
    return authClient !== null;
}

async function createEvent(calendarId, summary, description, startDateTime, durationMinutes, organizerEmail) {
    if (!authClient) throw new Error("Google Calendar non configuré");
    
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + durationMinutes);

    const event = {
        summary: summary,
        description: description,
        start: {
            dateTime: startDateTime.toISOString(),
            timeZone: 'Europe/Paris',
        },
        end: {
            dateTime: endDateTime.toISOString(),
            timeZone: 'Europe/Paris',
        },
        organizer: {
            email: organizerEmail,
            self: true
        },
        reminders: {
            useDefault: true,
        },
    };

    try {
        const response = await calendar.events.insert({
            calendarId: calendarId,
            resource: event,
        });
        return response.data.id;
    } catch (error) {
        console.error('Erreur création événement calendrier:', error.message);
        throw error;
    }
}

async function updateEvent(calendarId, eventId, summary, description, startDateTime, durationMinutes, organizerEmail) {
    if (!authClient) throw new Error("Google Calendar non configuré");
    
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + durationMinutes);

    const event = {
        summary: summary,
        description: description,
        start: {
            dateTime: startDateTime.toISOString(),
            timeZone: 'Europe/Paris',
        },
        end: {
            dateTime: endDateTime.toISOString(),
            timeZone: 'Europe/Paris',
        },
        organizer: {
            email: organizerEmail,
            self: true
        },
    };

    try {
        await calendar.events.update({
            calendarId: calendarId,
            eventId: eventId,
            resource: event,
        });
    } catch (error) {
        console.error('Erreur mise à jour événement calendrier:', error.message);
        throw error;
    }
}

async function deleteEvent(calendarId, eventId) {
    if (!authClient) throw new Error("Google Calendar non configuré");
    
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    try {
        await calendar.events.delete({
            calendarId: calendarId,
            eventId: eventId,
        });
    } catch (error) {
        console.error('Erreur suppression événement calendrier:', error.message);
        throw error;
    }
}

module.exports = {
    setAuth,
    isCalendarConfigured,
    createEvent,
    updateEvent,
    deleteEvent
};
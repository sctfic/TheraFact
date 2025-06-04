// google-calendar-helper.js
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs').promises;

let calendar;
let auth;
let calendarConfigured = false;

// Chemin vers le fichier de clé du compte de service
// Priorité : Variable d'environnement, puis chemin par défaut 'credentials.json'
const KEYFILEPATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'credentials.json');


async function init(specificKeyFilePath) {
    const keyFilePathToUse = specificKeyFilePath || KEYFILEPATH;
    try {
        await fs.access(keyFilePathToUse); // Vérifier si le fichier existe
        auth = new google.auth.GoogleAuth({
            keyFile: keyFilePathToUse,
            scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
        });
        const authClient = await auth.getClient();
        google.options({ auth: authClient });
        calendar = google.calendar({ version: 'v3', auth });
        calendarConfigured = true;
        console.log('Google Calendar API authentifié avec succès via:', keyFilePathToUse);
    } catch (error) {
        console.warn(`Échec de l'initialisation de Google Calendar API avec ${keyFilePathToUse}: ${error.message}`);
        console.warn("  Assurez-vous que le fichier de clé du compte de service est correctement placé et que l'API Google Calendar est activée pour votre projet.");
        calendarConfigured = false;
    }
}

function isCalendarConfigured() {
    return calendarConfigured;
}

async function createEvent(calendarId = 'primary', summary, description, startTime, durationMinutes, attendeeEmail) {
    if (!calendarConfigured || !calendar) throw new Error('Google Calendar n\'est pas configuré.');

    const eventStartTime = new Date(startTime);
    const eventEndTime = new Date(eventStartTime.getTime() + durationMinutes * 60000);

    const event = {
        summary: summary,
        description: description,
        start: {
            dateTime: eventStartTime.toISOString(),
            timeZone: 'Europe/Paris', // Ou la timezone appropriée
        },
        end: {
            dateTime: eventEndTime.toISOString(),
            timeZone: 'Europe/Paris',
        },
        attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 24 * 60 }, // Rappel 1 jour avant
                { method: 'popup', minutes: 60 },    // Rappel 1 heure avant
            ],
        },
    };

    try {
        const res = await calendar.events.insert({
            calendarId: calendarId,
            resource: event,
            sendNotifications: true, // Envoyer des notifications aux participants
        });
        console.log('Événement créé: %s', res.data.htmlLink);
        return res.data.id; // Retourner l'ID de l'événement
    } catch (error) {
        console.error('Erreur lors de la création de l\'événement Google Calendar:', error.message);
        throw error;
    }
}

async function deleteEvent(calendarId = 'primary', eventId) {
    if (!calendarConfigured || !calendar) throw new Error('Google Calendar n\'est pas configuré.');
    if (!eventId) throw new Error('ID de l\'événement requis pour la suppression.');

    try {
        await calendar.events.delete({
            calendarId: calendarId,
            eventId: eventId,
            sendNotifications: true,
        });
        console.log(`Événement ${eventId} supprimé.`);
    } catch (error) {
        console.error(`Erreur lors de la suppression de l'événement ${eventId}:`, error.message);
        // Gérer le cas où l'événement n'existe plus (code 404 ou 410)
        if (error.code === 404 || error.code === 410) {
            console.warn(`L'événement ${eventId} n'a pas été trouvé pour suppression (peut-être déjà supprimé).`);
            return; // Ne pas lever d'erreur si l'événement est déjà parti
        }
        throw error;
    }
}

async function updateEvent(calendarId = 'primary', eventId, summary, description, startTime, durationMinutes, attendeeEmail) {
    if (!calendarConfigured || !calendar) throw new Error('Google Calendar n\'est pas configuré.');
    if (!eventId) throw new Error('ID de l\'événement requis pour la mise à jour.');

    const eventStartTime = new Date(startTime);
    const eventEndTime = new Date(eventStartTime.getTime() + durationMinutes * 60000);

    const eventPatch = {
        summary: summary,
        description: description,
        start: {
            dateTime: eventStartTime.toISOString(),
            timeZone: 'Europe/Paris',
        },
        end: {
            dateTime: eventEndTime.toISOString(),
            timeZone: 'Europe/Paris',
        },
        attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
        // Les rappels peuvent aussi être mis à jour si nécessaire
    };

    try {
        const res = await calendar.events.patch({
            calendarId: calendarId,
            eventId: eventId,
            resource: eventPatch,
            sendNotifications: true,
        });
        console.log('Événement mis à jour: %s', res.data.htmlLink);
        return res.data.id;
    } catch (error) {
        console.error(`Erreur lors de la mise à jour de l'événement ${eventId}:`, error.message);
        throw error;
    }
}


module.exports = {
    init,
    isCalendarConfigured,
    createEvent,
    deleteEvent,
    updateEvent,
};

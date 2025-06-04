// google-calendar-helper.js
const { google } = require('googleapis');

let calendar;
let oauth2ClientInstance; // Stockera l'instance du client OAuth2 authentifié
let calendarConfigured = false;

/**
 * Sets the authenticated OAuth2 client for the Calendar API.
 * This function should be called from server.js after OAuth2 authentication is successful
 * or when loading stored refresh tokens.
 * @param {google.auth.OAuth2} authClient - The authenticated OAuth2 client.
 */
function setAuth(authClient) {
    if (authClient) {
        oauth2ClientInstance = authClient;
        google.options({ auth: oauth2ClientInstance }); // Set auth as a global default
        calendar = google.calendar({ version: 'v3', auth: oauth2ClientInstance });
        // Consider configured if we have an auth client,
        // actual usability depends on valid tokens which are handled by oauth2ClientInstance.
        calendarConfigured = true;
        console.log('Google Calendar Helper: Authentification OAuth2 configurée.');
    } else {
        oauth2ClientInstance = null;
        calendar = null;
        calendarConfigured = false;
        console.log('Google Calendar Helper: Authentification OAuth2 réinitialisée.');
    }
}

/**
 * Checks if the Calendar helper is configured with an OAuth2 client.
 * @returns {boolean} True if configured, false otherwise.
 */
function isCalendarConfigured() {
    // La configuration dépend maintenant de la présence d'un client OAuth2
    // et idéalement de la présence d'un refresh token pour une utilisation à long terme.
    // Pour les opérations, il faut un access token valide (géré par le client OAuth2).
    return calendarConfigured && !!oauth2ClientInstance;
}

/**
 * Ensures the OAuth2 client has a valid access token, refreshing if necessary.
 * @throws {Error} If unable to refresh the access token.
 */
async function ensureValidAccessToken() {
    if (!oauth2ClientInstance) throw new Error('Client OAuth2 non initialisé dans calendarHelper.');
    if (!oauth2ClientInstance.credentials || !oauth2ClientInstance.credentials.refresh_token) {
        // This case should ideally be handled by redirecting the user to re-authenticate
        // if no refresh token is available.
        console.warn('Tentative d\'opération calendrier sans jeton de rafraîchissement.');
        // throw new Error('Jeton de rafraîchissement manquant. Veuillez reconnecter le compte Google.');
    }

    // Vérifier si l'access token est sur le point d'expirer ou a expiré
    const expiryDate = oauth2ClientInstance.credentials.expiry_date;
    if (!oauth2ClientInstance.credentials.access_token || (expiryDate && expiryDate < (Date.now() + 60000))) { // 60 secondes de marge
        console.log('Google Calendar Helper: Rafraîchissement du jeton d\'accès...');
        try {
            const { credentials } = await oauth2ClientInstance.refreshAccessToken();
            oauth2ClientInstance.setCredentials(credentials);
            // Mettre à jour l'instance globale de google.auth pour les appels suivants
            google.options({ auth: oauth2ClientInstance });
            calendar = google.calendar({ version: 'v3', auth: oauth2ClientInstance }); // Réassigner avec le client mis à jour
            console.log('Google Calendar Helper: Jeton d\'accès rafraîchi avec succès.');
        } catch (error) {
            console.error('Google Calendar Helper: Erreur lors du rafraîchissement du jeton d\'accès:', error.message);
            throw new Error(`Impossible de rafraîchir le jeton d'accès Google: ${error.message}`);
        }
    }
}


async function createEvent(calendarId = 'primary', summary, description, startTime, durationMinutes, attendeeEmail) {
    if (!isCalendarConfigured() || !calendar) throw new Error('Google Calendar n\'est pas configuré ou authentifié via OAuth2.');
    await ensureValidAccessToken(); // S'assurer que l'access token est valide

    const eventStartTime = new Date(startTime);
    const eventEndTime = new Date(eventStartTime.getTime() + durationMinutes * 60000);

    const event = {
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
        attendees: attendeeEmail ? [{ email: attendeeEmail }] : [], // L'organisateur (l'utilisateur OAuth) est ajouté par défaut
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 24 * 60 }, 
                { method: 'popup', minutes: 60 },    
            ],
        },
    };

    try {
        const res = await calendar.events.insert({
            calendarId: calendarId,
            resource: event,
            sendNotifications: true, 
        });
        console.log('Événement créé via OAuth: %s', res.data.htmlLink);
        return res.data.id; 
    } catch (error) {
        console.error('Erreur lors de la création de l\'événement Google Calendar via OAuth:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function deleteEvent(calendarId = 'primary', eventId) {
    if (!isCalendarConfigured() || !calendar) throw new Error('Google Calendar n\'est pas configuré ou authentifié via OAuth2.');
    if (!eventId) throw new Error('ID de l\'événement requis pour la suppression.');
    await ensureValidAccessToken();

    try {
        await calendar.events.delete({
            calendarId: calendarId,
            eventId: eventId,
            sendNotifications: true,
        });
        console.log(`Événement ${eventId} supprimé via OAuth.`);
    } catch (error) {
        console.error(`Erreur lors de la suppression de l'événement ${eventId} via OAuth:`, error.response ? error.response.data : error.message);
        if (error.code === 404 || error.code === 410) {
            console.warn(`L'événement ${eventId} n'a pas été trouvé pour suppression (peut-être déjà supprimé).`);
            return; 
        }
        throw error;
    }
}

async function updateEvent(calendarId = 'primary', eventId, summary, description, startTime, durationMinutes, attendeeEmail) {
    if (!isCalendarConfigured() || !calendar) throw new Error('Google Calendar n\'est pas configuré ou authentifié via OAuth2.');
    if (!eventId) throw new Error('ID de l\'événement requis pour la mise à jour.');
    await ensureValidAccessToken();

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
    };

    try {
        const res = await calendar.events.patch({
            calendarId: calendarId,
            eventId: eventId,
            resource: eventPatch,
            sendNotifications: true,
        });
        console.log('Événement mis à jour via OAuth: %s', res.data.htmlLink);
        return res.data.id;
    } catch (error) {
        console.error(`Erreur lors de la mise à jour de l'événement ${eventId} via OAuth:`, error.response ? error.response.data : error.message);
        throw error;
    }
}


module.exports = {
    setAuth, // Remplacer init par setAuth
    isCalendarConfigured,
    createEvent,
    deleteEvent,
    updateEvent,
};

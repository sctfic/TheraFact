// controllers/settingsController.js
const { readSettingsJson, writeSettingsJson, getDataPath, getDataContextName } = require('../helpers/fileHelper');
const { authState } = require('./authController');

async function getSettings(req, res) {
    try {
        const userEmail = authState.activeGoogleAuthTokens.userEmail;
        const settings = await readSettingsJson(userEmail);
        const dataContext = getDataContextName(userEmail);

        const clientSafeSettings = {
            manager: {
                name: settings.manager.name,
                title: settings.manager.title,
                description: settings.manager.description,
                address: settings.manager.address,
                city: settings.manager.city,
                phone: settings.manager.phone,
                email: settings.manager.email, 
            },
            googleOAuth: { 
                isConnected: !!(settings.googleOAuth && settings.googleOAuth.refreshToken),
                userEmail: settings.googleOAuth?.userEmail || null,
                userName: settings.googleOAuth?.userName || null, // Envoyer le nom
                profilePictureUrl: settings.googleOAuth?.profilePictureUrl || null, // Envoyer l'avatar
                scopes: settings.googleOAuth?.scopes || []
            },
            tva: settings.tva,
            legal: settings.legal,
            googleCalendar: settings.googleCalendar,
            dataContext: dataContext
        };
        res.json(clientSafeSettings);
    } catch (error) {
        console.error('Erreur API GET /api/settings :', error.message);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des paramètres' });
    }
}


async function updateSettings(req, res) {
    try {
        const userEmail = authState.activeGoogleAuthTokens.userEmail;
        const newSettingsFromClient = req.body;
        let currentSettings = await readSettingsJson(userEmail); 

        const settingsToSave = {
            ...currentSettings,
            manager: {
                ...currentSettings.manager,
                name: newSettingsFromClient.manager?.name ?? currentSettings.manager.name,
                title: newSettingsFromClient.manager?.title ?? currentSettings.manager.title,
                description: newSettingsFromClient.manager?.description ?? currentSettings.manager.description,
                address: newSettingsFromClient.manager?.address ?? currentSettings.manager.address,
                city: newSettingsFromClient.manager?.city ?? currentSettings.manager.city,
                phone: newSettingsFromClient.manager?.phone ?? currentSettings.manager.phone,
                email: newSettingsFromClient.manager?.email ?? currentSettings.manager.email,
            },
            tva: newSettingsFromClient.tva ?? currentSettings.tva,
            legal: { ...currentSettings.legal, ...(newSettingsFromClient.legal || {}) },
            googleCalendar: { ...currentSettings.googleCalendar, ...(newSettingsFromClient.googleCalendar || {}) }
        };
        
        settingsToSave.googleOAuth = currentSettings.googleOAuth;

        await writeSettingsJson(settingsToSave, userEmail);

        const clientSafeResponse = { ...settingsToSave };
         if (clientSafeResponse.manager) {
            delete clientSafeResponse.manager.encodedGmailAppPassword; 
        }
        if (clientSafeResponse.googleOAuth) { 
            delete clientSafeResponse.googleOAuth.refreshToken;
        }
        
        // Ajouter le dataContext à la réponse
        clientSafeResponse.dataContext = getDataContextName(userEmail);

        res.status(200).json(clientSafeResponse); 
    } catch (error) {
        console.error('Erreur API POST /api/settings :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde des paramètres' });
    }
}

module.exports = {
    getSettings,
    updateSettings
};
// controllers/settingsController.js
const { readSettingsJson, writeSettingsJson, getDataPath, getDataContextName } = require('../helpers/fileHelper'); // Ajout de writeSettingsJson

async function getSettings(req, res) {
    try {
        // userEmail sera null en mode démo, ce qui est géré par getDataPath et getDataContextName
        const { userEmail, isDemo } = req;
        const settings = await readSettingsJson(userEmail);
        const dataContext = getDataContextName(userEmail);

        const clientSafeSettings = {
            manager: settings.manager,
            googleOAuth: {
                isConnected: !isDemo, // Connecté seulement si ce n'est pas une démo
                userEmail: isDemo ? null : (settings.googleOAuth?.userEmail || userEmail),
                userName: isDemo ? null : (settings.googleOAuth?.userName || null),
                profilePictureUrl: isDemo ? null : (settings.googleOAuth?.profilePictureUrl || null),
                scopes: isDemo ? [] : (settings.googleOAuth?.scopes || [])
            },
            tva: settings.tva,
            legal: settings.legal,
            googleCalendar: settings.googleCalendar,
            dataContext: dataContext
        };
        res.json(clientSafeSettings);
    } catch (error) {
        console.error('Erreur API GET /api/settings :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des paramètres' });
    }
}

async function updateSettings(req, res) {
    try {
        const { userEmail, isDemo } = req;
        if (isDemo) {
            return res.status(403).json({ message: "La modification des paramètres est désactivée en mode démo." });
        }
        
        const newSettingsFromClient = req.body;
        let currentSettings = await readSettingsJson(userEmail);

        const settingsToSave = {
            ...currentSettings,
            manager: { ...currentSettings.manager, ...newSettingsFromClient.manager },
            tva: newSettingsFromClient.tva ?? currentSettings.tva,
            legal: { ...currentSettings.legal, ...newSettingsFromClient.legal },
            googleCalendar: { ...currentSettings.googleCalendar, ...newSettingsFromClient.googleCalendar }
        };

        await writeSettingsJson(settingsToSave, userEmail);
        
        const response = { 
            ...settingsToSave,
            dataContext: getDataContextName(userEmail)
        };
        
        // Ne pas supprimer googleOAuth de la réponse
        res.status(200).json(response);
    } catch (error) {
        console.error('Erreur API POST /api/settings :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde des paramètres' });
    }
}

module.exports = {
    getSettings,
    updateSettings
};
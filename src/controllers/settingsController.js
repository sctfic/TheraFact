// src/controllers/settingsController.js
const { readSettingsJson, writeSettingsJson, getDataPath, getDataContextName } = require('../helpers/fileHelper');
const fs = require('fs').promises;
const path = require('path');

async function getSettings(req, res) {
    try {
        const { userEmail, isDemo } = req;
        const settings = await readSettingsJson(userEmail);
        const dataContext = getDataContextName(userEmail);

        const clientSafeSettings = {
            manager: settings.manager,
            googleOAuth: {
                isConnected: !isDemo,
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
        
        res.status(200).json(response);
    } catch (error) {
        console.error('Erreur API POST /api/settings :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde des paramètres' });
    }
}

async function getAppVersion(req, res) {
    try {
        // Le chemin est relatif au fichier actuel (src/controllers)
        const packageJsonPath = path.join(__dirname, '../../package.json');
        const fileContent = await fs.readFile(packageJsonPath, 'utf8');
        const packageData = JSON.parse(fileContent);
        res.json({ version: packageData.version || 'N/A' });
    } catch (error) {
        console.error("Erreur lors de la lecture de package.json :", error);
        res.status(500).json({ message: "Impossible de récupérer la version de l'application." });
    }
}

module.exports = {
    getSettings,
    updateSettings,
    getAppVersion // Export de la nouvelle fonction
};
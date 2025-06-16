// helpers/fileHelper.js
const fs = require('fs').promises;
const path = require('path');
const { defaultSettings } = require('../config/defaultSettings');
const { 
    CLIENTS_HEADERS,
    TARIFS_HEADERS,
    SEANCES_HEADERS,
    PATHS 
} = require('../config/constants');

function getUserPrefix(email) {
    if (!email || !email.includes('@')) return null;
    return email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '');
}

function getDataPath(email) {
    const userPrefix = getUserPrefix(email);
    if (userPrefix) {
        return path.join(PATHS.BASE_DATA_DIR, userPrefix);
    }
    return path.join(PATHS.BASE_DATA_DIR, PATHS.DEMO_DIR_NAME);
}

function getDataContextName(email) {
    const userPrefix = getUserPrefix(email);
    return userPrefix || PATHS.DEMO_DIR_NAME;
}


function parseTSV(tsvString, headers) {
    const lines = tsvString.trim().split(/\r?\n/);
    if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) return [];
    const parsedHeaders = lines[0].split('\t').map(h => h.trim());
    const effectiveHeaders = headers && headers.length > 0 ? headers : parsedHeaders;
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        const values = lines[i].split('\t');
        const entry = {};
        
        effectiveHeaders.forEach((header, index) => {
            let value = values[index] !== undefined ? values[index].trim() : null;
            if (value === '' || value === 'null' || value === undefined || value === 'undefined') {
                value = null;
            }
            if (header === 'montant' || header === 'montant_facture' || header === 'tva') {
                entry[header] = value !== null ? parseFloat(value) : 0;
            } else if (header === 'duree') {
                entry[header] = value !== null ? parseInt(value, 10) : null;
            } else {
                entry[header] = value;
            }
        });
        
        if (Object.keys(entry).some(key => entry[key] !== null)) {
            data.push(entry);
        }
    }
    
    return data;
}

function formatTSV(dataArray, headers) {
    const headerString = headers.join('\t');
    const rows = dataArray.map(item => {
        return headers.map(header => {
            let value = item[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'number' && (header === 'montant' || header === 'montant_facture' || header === 'tva')) {
                return value.toFixed(2);
            }
            if (typeof value === 'number' && header === 'duree') return String(value);
            return String(value).replace(/\t|\n|\r/g, ' ');
        }).join('\t');
    });
    return [headerString, ...rows].join('\r\n') + '\r\n';
}

async function readSettingsJson(userEmail) {
    const dataPath = getDataPath(userEmail);
    try {
        await fs.access(dataPath);
        const settingsFilePath = path.join(dataPath, PATHS.SETTINGS_FILE);
        const data = await fs.readFile(settingsFilePath, 'utf8');
        const loadedSettings = JSON.parse(data);
        const mergedSettings = {
            ...defaultSettings,
            ...loadedSettings,
            manager: { ...defaultSettings.manager, ...(loadedSettings.manager || {}) },
            googleOAuth: { ...defaultSettings.googleOAuth, ...(loadedSettings.googleOAuth || {}) },
            legal: { ...defaultSettings.legal, ...(loadedSettings.legal || {}) },
            googleCalendar: { ...defaultSettings.googleCalendar, ...(loadedSettings.googleCalendar || {}) }
        };
        return mergedSettings;
    } catch (error) {
        if (error.code === 'ENOENT') {
            try {
                await writeSettingsJson(defaultSettings, userEmail); // Crée le fichier pour l'utilisateur
                return { ...defaultSettings }; 
            } catch (writeError) {
                console.error(`Échec création ${PATHS.SETTINGS_FILE} pour ${userEmail}:`, writeError.message);
                return { ...defaultSettings };
            }
        }
        console.error(`Erreur lecture/parsing ${PATHS.SETTINGS_FILE} pour ${userEmail}:`, error.message);
        return { ...defaultSettings }; 
    }
}


async function writeSettingsJson(settingsToSave, userEmail) {
    const dataPath = getDataPath(userEmail);
    try {
        await fs.mkdir(dataPath, { recursive: true });
        const cleanSettings = JSON.parse(JSON.stringify(settingsToSave)); 
        if (cleanSettings.manager) {
            delete cleanSettings.manager.gmailAppPassword; 
            delete cleanSettings.manager.encodedGmailAppPassword; 
        }
        await fs.writeFile(
            path.join(dataPath, PATHS.SETTINGS_FILE), 
            JSON.stringify(cleanSettings, null, 2), 
            'utf8'
        );
    } catch (error) {
        console.error(`Erreur écriture ${PATHS.SETTINGS_FILE} pour ${userEmail}:`, error.message);
    }
}

module.exports = {
    parseTSV,
    formatTSV,
    readSettingsJson,
    writeSettingsJson,
    getDataPath,
    getDataContextName
};
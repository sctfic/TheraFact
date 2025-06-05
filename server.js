// server.js
const express = require('express');
const fs = require('fs').promises;
const fssync = require('fs'); 
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');
let puppeteer; 

try {
  puppeteer = require('puppeteer');
} catch (error) {
  console.warn("ATTENTION : Le module 'puppeteer' n'est pas installé. La génération de PDF ne fonctionnera pas.");
  puppeteer = null;
}

const { google } = require('googleapis');
const calendarHelper = require('./google-calendar-helper'); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dataDir = path.join(__dirname, 'data');
const clientsFilePath = path.join(dataDir, 'clients.tsv');
const tarifsFilePath = path.join(dataDir, 'tarifs.tsv');
const seancesFilePath = path.join(dataDir, 'seances.tsv');
const settingsFilePath = path.join(dataDir, 'settings.json');
const factsDir = path.join(__dirname, 'public', 'Facts');
const devisDir = path.join(__dirname, 'public', 'Devis');
const OAUTH_CREDENTIALS_PATH = path.join(__dirname, 'OAuth2.0.json');

fs.mkdir(dataDir, { recursive: true }).catch(console.error);
fs.mkdir(factsDir, { recursive: true }).catch(console.error);
fs.mkdir(devisDir, { recursive: true }).catch(console.error);

let oauth2Client;
let googleOAuthConfig = {}; 
let activeGoogleAuthTokens = {
    accessToken: null,
    refreshToken: null,
    expiryDate: null,
    userEmail: null, 
    scopes: []
};

const defaultSettings = {
  manager: {
    name: "", title: "", description: "", address: "", city: "", phone: "", email: "",
  },
  googleOAuth: { 
    userEmail: null,
    refreshToken: null, 
    scopes: []
  },
  tva: 0,
  legal: { 
    siret: "", ape: "", adeli: "", iban: "", bic: "", 
    tvaMention: "TVA non applicable selon l'article 293B du Code Général des Impôts", 
    paymentTerms: "Paiement à réception de facture", 
    insurance: "AXA Assurances - Police n° 123456789 - Garantie territoriale : France/Europe"
  },
  googleCalendar: { 
    calendarId: "primary",
  }
};

async function loadAndInitializeOAuthClient() {
    try {
        const credentialsContent = await fs.readFile(OAUTH_CREDENTIALS_PATH, 'utf8');
        const credentials = JSON.parse(credentialsContent);
        if (!credentials.web || !credentials.web.client_id || !credentials.web.client_secret || !credentials.web.redirect_uris) {
            throw new Error("Fichier OAuth2.0.json mal formaté ou incomplet.");
        }
        googleOAuthConfig = {
            clientId: credentials.web.client_id,
            clientSecret: credentials.web.client_secret,
            redirectUri: credentials.web.redirect_uris[0] 
        };

        oauth2Client = new google.auth.OAuth2(
            googleOAuthConfig.clientId,
            googleOAuthConfig.clientSecret,
            googleOAuthConfig.redirectUri
        );
        console.log("Client OAuth2 initialisé.");

        const settings = await readSettingsJson(); 
        if (settings.googleOAuth && settings.googleOAuth.refreshToken) {
            oauth2Client.setCredentials({
                refresh_token: settings.googleOAuth.refreshToken
            });
            activeGoogleAuthTokens.refreshToken = settings.googleOAuth.refreshToken;
            activeGoogleAuthTokens.userEmail = settings.googleOAuth.userEmail;
            activeGoogleAuthTokens.scopes = settings.googleOAuth.scopes || [];
            console.log(`Jeton de rafraîchissement chargé pour ${activeGoogleAuthTokens.userEmail}.`);
            
            try {
                const { token: newAccessToken, expiry_date: newExpiryDate } = await oauth2Client.getAccessToken();
                activeGoogleAuthTokens.accessToken = newAccessToken;
                activeGoogleAuthTokens.expiryDate = newExpiryDate;
                oauth2Client.setCredentials({ ...oauth2Client.credentials, access_token: newAccessToken });
                console.log("Jeton d'accès rafraîchi au démarrage.");
                calendarHelper.setAuth(oauth2Client); // Configurer calendarHelper avec le client authentifié
            } catch (refreshError) {
                console.warn("Impossible de rafraîchir le jeton d'accès au démarrage:", refreshError.message);
                calendarHelper.setAuth(null); // S'assurer que calendarHelper n'a pas d'auth si le refresh échoue
            }
        } else {
            calendarHelper.setAuth(null); // Pas de jetons, pas d'auth pour calendarHelper
        }
    } catch (error) {
        console.error("Erreur critique chargement/initialisation OAuth2:", error.message);
        oauth2Client = null; 
        calendarHelper.setAuth(null);
    }
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

const clientsHeaders = ['id', 'nom', 'prenom', 'telephone', 'email', 'adresse', 'ville', 'notes', 'defaultTarifId', 'statut', 'dateCreation'];
async function readClientsTsv() { 
    try {
        await fs.access(dataDir); 
        const data = await fs.readFile(clientsFilePath, 'utf8');
        return parseTSV(data, clientsHeaders);
    } catch (error) {
        if (error.code === 'ENOENT') { 
            await fs.writeFile(clientsFilePath, clientsHeaders.join('\t') + '\r\n', 'utf8');
            return []; 
        }
        console.error(`Erreur lecture ${clientsFilePath}:`, error.message);
        return []; 
    }
}
async function writeClientsTsv(clients) { 
    try {
        await fs.mkdir(dataDir, { recursive: true }); 
        await fs.writeFile(clientsFilePath, formatTSV(clients, clientsHeaders), 'utf8');
    } catch (error) {
        console.error(`Erreur écriture ${clientsFilePath}:`, error.message);
    }
}

const tarifsHeaders = ['id', 'libelle', 'montant', 'duree'];
async function readTarifsTsv() {
    try {
        await fs.access(dataDir);
        const data = await fs.readFile(tarifsFilePath, 'utf8');
        return parseTSV(data, tarifsHeaders);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(tarifsFilePath, tarifsHeaders.join('\t') + '\r\n', 'utf8');
            return [];
        }
        console.error(`Erreur lecture ${tarifsFilePath}:`, error.message);
        return [];
    }
 }
async function writeTarifsTsv(tarifs) {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(tarifsFilePath, formatTSV(tarifs, tarifsHeaders), 'utf8');
    } catch (error) {
        console.error(`Erreur écriture ${tarifsFilePath}:`, error.message);
    }
 }

const seancesHeaders = ['id_seance', 'id_client', 'date_heure_seance', 'id_tarif', 'montant_facture', 'statut_seance', 'mode_paiement', 'date_paiement', 'invoice_number', 'devis_number', 'googleCalendarEventId'];
async function readSeancesTsv() { 
    try {
        await fs.access(dataDir);
        const data = await fs.readFile(seancesFilePath, 'utf8');
        return parseTSV(data, seancesHeaders);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(seancesFilePath, seancesHeaders.join('\t') + '\r\n', 'utf8');
            return [];
        }
        console.error(`Erreur lecture ${seancesFilePath}:`, error.message);
        return [];
    }
}
async function writeSeancesTsv(seances) { 
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(seancesFilePath, formatTSV(seances, seancesHeaders), 'utf8');
    } catch (error) {
        console.error(`Erreur écriture ${seancesFilePath}:`, error.message);
    }
}


async function readSettingsJson() {
    try {
        await fs.access(dataDir);
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
                await fs.writeFile(settingsFilePath, JSON.stringify(defaultSettings, null, 2), 'utf8');
                return { ...defaultSettings }; 
            } catch (writeError) {
                 console.error(`Échec création ${settingsFilePath}:`, writeError.message);
                 return { ...defaultSettings };
            }
        }
        console.error(`Erreur lecture/parsing ${settingsFilePath}:`, error.message);
        return { ...defaultSettings }; 
    }
}

async function writeSettingsJson(settingsToSave) {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        const cleanSettings = JSON.parse(JSON.stringify(settingsToSave)); 
        if (cleanSettings.manager) {
            delete cleanSettings.manager.gmailAppPassword; 
            delete cleanSettings.manager.encodedGmailAppPassword; 
        }
        await fs.writeFile(settingsFilePath, JSON.stringify(cleanSettings, null, 2), 'utf8');
    } catch (error) {
        console.error(`Erreur écriture ${settingsFilePath}:`, error.message);
    }
}

async function generateClientId(nom, prenom, existingClients) { 
    const cleanNom = nom.trim().toUpperCase().replace(/[^A-Z0-9_]/gi, '').substring(0, 10);
    const cleanPrenom = prenom.trim().toUpperCase().replace(/[^A-Z0-9_]/gi, '').substring(0, 5);
    let baseId = `${cleanNom}_${cleanPrenom}`;
    let suffix = 1;
    let newId = baseId;
    while (existingClients.some(client => client.id === newId)) {
        newId = `${baseId}_${suffix}`;
        suffix++;
    }
    return newId;
}
async function generateTarifId(libelle, montant, existingTarifs) { 
    const cleanLibelle = libelle.trim().toUpperCase().replace(/[^A-Z0-9_]/gi, '').substring(0,15);
    let baseId = `TARIF_${cleanLibelle}`;
    let suffix = 1;
    let newId = baseId;
    while (existingTarifs.some(tarif => tarif.id === newId)) {
        newId = `${baseId}_${suffix}`;
        suffix++;
    }
    return newId;
}
function formatDateDDMMYYYY(dateString) { 
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) { return ''; }
}
function calculateValidityOrDueDate(baseDateStr, days = 30) {
    if (!baseDateStr) return '';
    try {
        const date = new Date(baseDateStr);
        if (isNaN(date.getTime())) return '';
        date.setDate(date.getDate() + days);
        return formatDateDDMMYYYY(date);
    } catch (e) { return ''; }
 }
async function getNextInvoiceNumber() {
    const currentYear = new Date().getFullYear();
    const prefix = `FAC-${currentYear}-`;
    let maxCounter = 0;
    try {
        const allSeances = await readSeancesTsv();
        allSeances.forEach(seance => {
            if (seance.invoice_number && seance.invoice_number.startsWith(prefix)) {
                const numPart = parseInt(seance.invoice_number.substring(prefix.length), 10);
                if (!isNaN(numPart) && numPart > maxCounter) maxCounter = numPart;
            }
        });
    } catch (err) { console.warn("Avertissement: Impossible de lire les numéros de facture existants:", err.message); }
    return `${prefix}${(maxCounter + 1).toString().padStart(4, '0')}`;
 }
async function getNextDevisNumber() {
    const currentYear = new Date().getFullYear();
    const prefix = `DEV-${currentYear}-`;
    let maxCounter = 0;
    try {
        const files = await fs.readdir(devisDir);
        files.forEach(file => {
            if (file.startsWith(prefix) && file.endsWith('.json')) {
                const numPart = parseInt(file.substring(prefix.length, file.length - 5), 10);
                if (!isNaN(numPart) && numPart > maxCounter) maxCounter = numPart;
            }
        });
    } catch (err) { if (err.code !== 'ENOENT') console.warn("Avertissement: Impossible de lire les numéros de devis existants:", err.message); }
    return `${prefix}${(maxCounter + 1).toString().padStart(4, '0')}`;
 }

// --- Endpoints OAuth 2.0 ---
app.get('/api/auth/google', (req, res) => {
    if (!oauth2Client) {
        return res.status(500).send("Erreur: Configuration OAuth2 non initialisée.");
    }
    const scopes = [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email', 
        'https://www.googleapis.com/auth/userinfo.profile' 
    ];
    const authorizeUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', 
        scope: scopes,
        prompt: 'consent' 
    });
    res.redirect(authorizeUrl);
});

app.get('/api/auth/google/callback', async (req, res) => {
    if (!oauth2Client) {
        return res.status(500).send("Erreur: Configuration OAuth2 non initialisée.");
    }
    const { code } = req.query;
    if (!code) {
        return res.status(400).send("Erreur: Code d'autorisation manquant.");
    }
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const userEmail = userInfo.data.email;

        activeGoogleAuthTokens.accessToken = tokens.access_token;
        activeGoogleAuthTokens.refreshToken = tokens.refresh_token || activeGoogleAuthTokens.refreshToken; 
        activeGoogleAuthTokens.expiryDate = tokens.expiry_date;
        activeGoogleAuthTokens.userEmail = userEmail;
        activeGoogleAuthTokens.scopes = tokens.scope ? tokens.scope.split(' ') : [];

        let settings = await readSettingsJson();
        settings.googleOAuth = {
            userEmail: userEmail,
            refreshToken: activeGoogleAuthTokens.refreshToken, 
            scopes: activeGoogleAuthTokens.scopes
        };
        if (settings.manager && !settings.manager.email) { 
            settings.manager.email = userEmail;
        }
        await writeSettingsJson(settings);
        
        console.log(`Tokens obtenus et sauvegardés pour ${userEmail}. Refresh token présent: ${!!activeGoogleAuthTokens.refreshToken}`);
        calendarHelper.setAuth(oauth2Client); 

        res.redirect('/index.html?oauth_success=true#viewConfig');
    } catch (error) {
        console.error("Erreur lors de l'échange du code ou de la sauvegarde des jetons:", error.message, error.stack);
        res.status(500).send(`Erreur d'authentification Google: ${error.message}`);
    }
});

app.post('/api/auth/google/disconnect', async (req, res) => {
    if (!oauth2Client) {
        return res.status(500).json({ success: false, message: "Configuration OAuth non initialisée." });
    }
    try {
        const settings = await readSettingsJson();
        const refreshTokenToRevoke = settings.googleOAuth ? settings.googleOAuth.refreshToken : null;

        if (refreshTokenToRevoke) {
            await oauth2Client.revokeToken(refreshTokenToRevoke);
            console.log("Jeton de rafraîchissement révoqué avec succès.");
        }
        
        settings.googleOAuth = { userEmail: null, refreshToken: null, scopes: [] };
        await writeSettingsJson(settings);

        activeGoogleAuthTokens = { accessToken: null, refreshToken: null, expiryDate: null, userEmail: null, scopes: [] };
        oauth2Client.setCredentials(null); 
        calendarHelper.setAuth(null); 

        res.json({ success: true, message: "Compte Google déconnecté avec succès." });
    } catch (error) {
        console.error("Erreur lors de la déconnexion du compte Google:", error.message);
        try {
            let settings = await readSettingsJson();
            settings.googleOAuth = { userEmail: null, refreshToken: null, scopes: [] };
            await writeSettingsJson(settings);
            activeGoogleAuthTokens = { accessToken: null, refreshToken: null, expiryDate: null, userEmail: null, scopes: [] };
            if(oauth2Client) oauth2Client.setCredentials(null);
            calendarHelper.setAuth(null);
        } catch (clearError) {
            console.error("Erreur lors du nettoyage des tokens après échec de révocation:", clearError.message);
        }
        res.status(500).json({ success: false, message: `Erreur lors de la déconnexion: ${error.message}` });
    }
});


// --- Points d'API Clients, Tarifs ---
app.get('/api/clients', async (req, res) => { 
    try {
        const clients = await readClientsTsv();
        res.json(clients);
    } catch (error) { 
        console.error('Erreur API GET /api/clients :', error.message);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des clients' }); 
    }
});
app.post('/api/clients', async (req, res) => { 
    try {
        const newClient = req.body;
        let clients = await readClientsTsv();
        if (!newClient.id) {
            newClient.id = await generateClientId(newClient.nom, newClient.prenom, clients);
            newClient.dateCreation = new Date().toISOString();
            newClient.statut = newClient.statut || 'actif';
        }
        const index = clients.findIndex(c => c.id === newClient.id);
        if (index > -1) clients[index] = { ...clients[index], ...newClient };
        else clients.push(newClient);
        await writeClientsTsv(clients);
        res.status(200).json(newClient);
    } catch (error) { 
        console.error('Erreur API POST /api/clients :', error.message);
        res.status(500).json({ message: 'Erreur lors de la sauvegarde du client' }); 
    }
});
app.delete('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let clients = await readClientsTsv();
        let seances = await readSeancesTsv(); 
        if (seances.some(s => s.id_client === id)) return res.status(400).json({ message: "Ce client a des séances. Supprimez ou réassignez ses séances d'abord." });
        const initialLength = clients.length;
        clients = clients.filter(c => c.id !== id);
        if (clients.length === initialLength) return res.status(404).json({ message: 'Client non trouvé' });
        await writeClientsTsv(clients);
        res.status(200).json({ message: 'Client supprimé avec succès' });
    } catch (error) { 
        console.error('Erreur API DELETE /api/clients/:id :', error.message);
        res.status(500).json({ message: 'Erreur lors de la suppression du client' }); 
    }
 });

app.get('/api/tarifs', async (req, res) => { 
    try {
        const tarifs = await readTarifsTsv();
        res.json(tarifs);
    } catch (error) { 
        console.error('Erreur API GET /api/tarifs :', error.message);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des tarifs' }); 
    }
});
app.post('/api/tarifs', async (req, res) => { 
    try {
        const newTarif = req.body;
        let tarifs = await readTarifsTsv();
        if (!newTarif.id) newTarif.id = await generateTarifId(newTarif.libelle, newTarif.montant, tarifs);
        newTarif.duree = newTarif.duree ? parseInt(newTarif.duree, 10) : null;
        if (newTarif.duree !== null && isNaN(newTarif.duree)) return res.status(400).json({ message: 'La durée doit être un nombre valide.' });
        const index = tarifs.findIndex(t => t.id === newTarif.id);
        if (index > -1) tarifs[index] = newTarif;
        else tarifs.push(newTarif);
        await writeTarifsTsv(tarifs);
        res.status(200).json(newTarif);
    } catch (error) { 
        console.error('Erreur API POST /api/tarifs :', error.message);
        res.status(500).json({ message: 'Erreur lors de la sauvegarde du tarif' }); 
    }
});
app.delete('/api/tarifs/:id', async (req, res) => { 
    try {
        const { id } = req.params;
        let tarifs = await readTarifsTsv();
        let clients = await readClientsTsv(); 
        let seances = await readSeancesTsv(); 
        if (clients.some(c => c.defaultTarifId === id) || seances.some(s => s.id_tarif === id)) {
            return res.status(400).json({ message: "Ce tarif est utilisé comme tarif par défaut pour un client ou dans des séances. Veuillez d'abord le modifier." });
        }
        const initialLength = tarifs.length;
        tarifs = tarifs.filter(t => t.id !== id);
        if (tarifs.length === initialLength) return res.status(404).json({ message: 'Tarif non trouvé' });
        await writeTarifsTsv(tarifs);
        res.status(200).json({ message: 'Tarif supprimé avec succès' });
    } catch (error) { 
        console.error('Erreur API DELETE /api/tarifs/:id :', error.message);
        res.status(500).json({ message: 'Erreur lors de la suppression du tarif' }); 
    }
});

// --- Points d'API Séances ---
app.get('/api/seances', async (req, res) => { 
    try {
        let seances = await readSeancesTsv();
        let tsvModified = false;

        let existingInvoiceFiles = [];
        try {
            const files = await fs.readdir(factsDir);
            existingInvoiceFiles = files.filter(file => file.endsWith('.json')).map(file => file.slice(0, -5));
        } catch (err) {
            if (err.code !== 'ENOENT') console.warn(`Impossible de lire le répertoire des factures ${factsDir}: ${err.message}`);
        }
        
        for (let i = 0; i < seances.length; i++) {
            const seance = seances[i];
            if (seance.invoice_number && seance.invoice_number.trim() !== '') {
                if (!existingInvoiceFiles.includes(seance.invoice_number)) {
                    seances[i].invoice_number = null;
                    tsvModified = true;
                }
            }
        }

        let existingDevisFiles = [];
        try {
            const files = await fs.readdir(devisDir);
            existingDevisFiles = files.filter(file => file.endsWith('.json')).map(file => file.slice(0, -5));
        } catch (err) {
            if (err.code !== 'ENOENT') console.warn(`Impossible de lire le répertoire des devis ${devisDir}: ${err.message}`);
        }

        for (let i = 0; i < seances.length; i++) {
            const seance = seances[i];
            if (seance.devis_number && seance.devis_number.trim() !== '') {
                if (!existingDevisFiles.includes(seance.devis_number)) {
                    seances[i].devis_number = null;
                    tsvModified = true;
                }
            }
        }

        if (tsvModified) {
            await writeSeancesTsv(seances);
        }
        res.json(seances);
    } catch (error) { 
        console.error('Erreur API GET /api/seances :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des séances' }); 
    }
});
app.get('/api/invoice/:invoiceNumber/status', async (req, res) => { 
    const { invoiceNumber } = req.params;
    try {
        const allSeances = await readSeancesTsv();
        const isDevisRequest = invoiceNumber.startsWith('DEV-');
        const seance = allSeances.find(s => isDevisRequest ? s.devis_number === invoiceNumber : s.invoice_number === invoiceNumber);
        if (!seance) return res.status(404).json({ message: `Document ${invoiceNumber} non lié à une séance.` });
        if (isDevisRequest) {
            res.json({ documentType: 'devis', statusText: 'DEVIS', seanceId: seance.id_seance, isFuture: new Date(seance.date_heure_seance) > new Date() });
        } else {
            let statusTextForWatermark = seance.statut_seance;
            if (seance.statut_seance === 'APAYER') statusTextForWatermark = 'À PAYER';
            else if (seance.statut_seance === 'PAYEE') statusTextForWatermark = 'PAYÉE';
            else if (seance.statut_seance === 'ANNULEE') statusTextForWatermark = 'ANNULÉE';
            else if (seance.statut_seance === 'PLANIFIEE') statusTextForWatermark = 'PLANIFIÉE';
            res.json({ documentType: 'invoice', statut_seance: seance.statut_seance, statusText: statusTextForWatermark, seanceId: seance.id_seance });
        }
    } catch (error) { 
        console.error(`Erreur API GET /api/invoice/:invoiceNumber/status pour ${invoiceNumber}:`, error.message);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération du statut du document.' }); 
    }
});

app.post('/api/seances', async (req, res) => {
    try {
        const seanceData = req.body;
        let allSeances = await readSeancesTsv();
        const client = (await readClientsTsv()).find(c => c.id === seanceData.id_client);
        const tarif = (await readTarifsTsv()).find(t => t.id === seanceData.id_tarif);

        const index = allSeances.findIndex(s => s.id_seance === seanceData.id_seance);
        let isNewSeance = index === -1;
        let oldSeanceData = isNewSeance ? null : { ...allSeances[index] };

        if (isNewSeance) {
            allSeances.push(seanceData);
        } else {
            allSeances[index] = { ...allSeances[index], ...seanceData };
        }
        
        const currentSeance = isNewSeance ? seanceData : allSeances[index];

        if (oauth2Client && activeGoogleAuthTokens.refreshToken && calendarHelper.isCalendarConfigured()) {
            // Assurer que le client OAuth a les bons credentials (surtout le refresh token)
            oauth2Client.setCredentials({ refresh_token: activeGoogleAuthTokens.refreshToken });
            try {
                // S'assurer d'avoir un access token frais
                if (!activeGoogleAuthTokens.accessToken || (activeGoogleAuthTokens.expiryDate && activeGoogleAuthTokens.expiryDate < Date.now() + 60000)) {
                    const { token, expiry_date } = await oauth2Client.getAccessToken(); // Force le rafraîchissement
                    activeGoogleAuthTokens.accessToken = token;
                    activeGoogleAuthTokens.expiryDate = expiry_date;
                    oauth2Client.setCredentials({ ...oauth2Client.credentials, access_token: token }); // Mettre à jour le client
                }
                calendarHelper.setAuth(oauth2Client); // Passer le client authentifié au helper

                const seanceDateTime = new Date(currentSeance.date_heure_seance);
                let dureeMinutes = tarif && tarif.duree ? parseInt(tarif.duree) : 60;
                if (isNaN(dureeMinutes) || dureeMinutes <= 0) dureeMinutes = 60;

                const eventSummary = `Séance ${client ? client.prenom + ' ' + client.nom : 'Client'} (${tarif ? tarif.libelle : 'Tarif'})`;
                const eventDescription = `Séance avec ${client ? client.prenom + ' ' + client.nom : 'un client'}.\nTarif: ${tarif ? tarif.libelle : 'N/A'}\nStatut: ${currentSeance.statut_seance}`;
                const settings = await readSettingsJson(); // Pour calendarId
                const calendarIdToUse = settings.googleCalendar.calendarId || 'primary';

                if (isNewSeance && currentSeance.statut_seance !== 'ANNULEE') {
                    const eventId = await calendarHelper.createEvent(calendarIdToUse, eventSummary, eventDescription, seanceDateTime, dureeMinutes, activeGoogleAuthTokens.userEmail);
                    currentSeance.googleCalendarEventId = eventId;
                } else if (!isNewSeance && oldSeanceData) { // Mise à jour d'une séance existante
                    const existingEventId = oldSeanceData.googleCalendarEventId;
                    if (currentSeance.statut_seance === 'ANNULEE' && oldSeanceData.statut_seance !== 'ANNULEE' && existingEventId) {
                        await calendarHelper.deleteEvent(calendarIdToUse, existingEventId); 
                        currentSeance.googleCalendarEventId = null;
                    } else if (currentSeance.statut_seance !== 'ANNULEE' && oldSeanceData.statut_seance === 'ANNULEE') { // Réactivation
                        const eventId = await calendarHelper.createEvent(calendarIdToUse, eventSummary, eventDescription, seanceDateTime, dureeMinutes, activeGoogleAuthTokens.userEmail);
                        currentSeance.googleCalendarEventId = eventId;
                    } else if (currentSeance.statut_seance !== 'ANNULEE' && existingEventId) { // MAJ d'un événement existant non annulé
                        await calendarHelper.updateEvent(calendarIdToUse, existingEventId, eventSummary, eventDescription, seanceDateTime, dureeMinutes, activeGoogleAuthTokens.userEmail);
                    } else if (currentSeance.statut_seance !== 'ANNULEE' && !existingEventId) { // Cas où une séance existante n'avait pas d'event GCal
                        const eventId = await calendarHelper.createEvent(calendarIdToUse, eventSummary, eventDescription, seanceDateTime, dureeMinutes, activeGoogleAuthTokens.userEmail);
                        currentSeance.googleCalendarEventId = eventId;
                    }
                }
            } catch (calError) { 
                console.error("Erreur interaction Google Calendar lors de la sauvegarde de séance:", calError.message);
                // Ne pas bloquer la sauvegarde de la séance pour une erreur calendrier
            }
        }
        // S'assurer que la version avec l'éventuel googleCalendarEventId est bien celle qui est mise dans le tableau
        if (isNewSeance) allSeances[allSeances.length -1] = currentSeance; 
        else allSeances[index] = currentSeance;

        await writeSeancesTsv(allSeances);
        res.status(200).json({ message: 'Séance enregistrée avec succès.', updatedSeance: currentSeance });

    } catch (error) {
        console.error('Erreur API POST /api/seances :', error.message, error.stack);
        res.status(500).json({ message: `Erreur lors de la sauvegarde de la séance: ${error.message}` });
    }
});

app.delete('/api/seances/:id', async (req, res) => { 
    try {
        const { id } = req.params;
        let seances = await readSeancesTsv();
        const seanceToDelete = seances.find(s => s.id_seance === id);
        if (!seanceToDelete) return res.status(404).json({ message: 'Séance non trouvée' });
        if (seanceToDelete.invoice_number) return res.status(400).json({ message: "Cette séance a été facturée et ne peut pas être supprimée directement." });
        
        if (seanceToDelete.googleCalendarEventId && oauth2Client && activeGoogleAuthTokens.refreshToken && calendarHelper.isCalendarConfigured()) {
            oauth2Client.setCredentials({ refresh_token: activeGoogleAuthTokens.refreshToken });
            try { 
                 // S'assurer d'avoir un access token frais
                if (!activeGoogleAuthTokens.accessToken || (activeGoogleAuthTokens.expiryDate && activeGoogleAuthTokens.expiryDate < Date.now() + 60000)) {
                    const { token } = await oauth2Client.getAccessToken(); // Force le rafraîchissement
                    activeGoogleAuthTokens.accessToken = token;
                    oauth2Client.setCredentials({ ...oauth2Client.credentials, access_token: token }); // Mettre à jour le client
                }
                calendarHelper.setAuth(oauth2Client); // Passer le client authentifié au helper
                const settings = await readSettingsJson(); // Pour calendarId
                const calendarIdToUse = settings.googleCalendar.calendarId || 'primary';
                await calendarHelper.deleteEvent(calendarIdToUse, seanceToDelete.googleCalendarEventId); 
                console.log(`Événement calendrier ${seanceToDelete.googleCalendarEventId} supprimé (suite à suppression séance).`);
            } 
            catch (calError) { console.warn(`Avertissement: Erreur lors de la suppression de l'événement calendrier ${seanceToDelete.googleCalendarEventId}: ${calError.message}`); }
        }
        if (seanceToDelete.devis_number) { 
            const devisJsonPath = path.join(devisDir, `${seanceToDelete.devis_number}.json`);
            try { await fs.unlink(devisJsonPath); console.log(`Fichier devis ${seanceToDelete.devis_number}.json supprimé.`); } 
            catch (unlinkError) { if (unlinkError.code !== 'ENOENT') console.warn(`Avertissement: Impossible de supprimer le fichier devis ${seanceToDelete.devis_number}.json : ${unlinkError.message}`);}
        }
        seances = seances.filter(s => s.id_seance !== id);
        await writeSeancesTsv(seances);
        res.status(200).json({ message: 'Séance supprimée avec succès' });
    } catch (error) { 
        console.error('Erreur API DELETE /api/seances/:id :', error.message);
        res.status(500).json({ message: 'Erreur lors de la suppression de la séance' }); 
    }
});

app.post('/api/seances/:seanceId/generate-invoice', async (req, res) => { 
    const { seanceId } = req.params;
    try {
        let allSeances = await readSeancesTsv();
        const seanceIndex = allSeances.findIndex(s => s.id_seance === seanceId);
        if (seanceIndex === -1) return res.status(404).json({ message: "Séance non trouvée." });
        const seance = allSeances[seanceIndex];
        if (seance.invoice_number) { 
            const invoiceJsonPathCheck = path.join(factsDir, `${seance.invoice_number}.json`);
            try {
                await fs.access(invoiceJsonPathCheck);
                return res.status(400).json({ message: `Cette séance a déjà été facturée avec le numéro ${seance.invoice_number}.` });
            } catch (e) {
                console.warn(`Le numéro de facture ${seance.invoice_number} existe pour la séance ${seanceId} mais le fichier JSON est manquant. Une nouvelle facture sera générée.`);
            }
        }

        const clientsData = await readClientsTsv();
        const client = clientsData.find(c => c.id === seance.id_client);
        if (!client) return res.status(404).json({ message: "Client associé à la séance non trouvé." });
        const tarifsData = await readTarifsTsv();
        const tarif = tarifsData.find(t => t.id === seance.id_tarif);
        if (!tarif) return res.status(404).json({ message: "Tarif associé à la séance non trouvé."});
        const settings = await readSettingsJson();
        const invoiceNumber = await getNextInvoiceNumber();
        const invoiceDate = new Date().toISOString(); 
        
        const invoiceData = {
            invoiceNumber: invoiceNumber,
            invoiceDate: formatDateDDMMYYYY(invoiceDate),
            seanceId: seance.id_seance, 
            client: {
                name: `${client.prenom || ''} ${client.nom || ''}`.trim(),
                address: client.adresse || '',
                city: client.ville || ''
            },
            service: [
                {
                    description: tarif.libelle || 'Prestation de service',
                    quantity: 1,
                    unitPrice: parseFloat(seance.montant_facture) || 0,
                    Date: formatDateDDMMYYYY(seance.date_heure_seance)
                }
            ],
            dueDate: calculateValidityOrDueDate(invoiceDate),
            tva: settings.tva || 0,
            manager: settings.manager || {},
            legal: settings.legal || {}
        };
        await fs.mkdir(factsDir, { recursive: true }); 
        const invoiceJsonPath = path.join(factsDir, `${invoiceNumber}.json`);
        await fs.writeFile(invoiceJsonPath, JSON.stringify(invoiceData, null, 2), 'utf8');
        allSeances[seanceIndex].invoice_number = invoiceNumber;
        allSeances[seanceIndex].devis_number = null; 
        if (allSeances[seanceIndex].statut_seance !== 'PAYEE' && allSeances[seanceIndex].statut_seance !== 'ANNULEE') {
            allSeances[seanceIndex].statut_seance = 'APAYER';
        }
        await writeSeancesTsv(allSeances);
        res.status(200).json({ message: 'Facture générée avec succès', invoiceNumber: invoiceNumber, newSeanceStatus: allSeances[seanceIndex].statut_seance });
    } catch (error) {
        console.error('Erreur API POST /api/seances/:seanceId/generate-invoice :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur lors de la génération de la facture.' });
    }
});
app.post('/api/seances/:seanceId/generate-devis', async (req, res) => { 
    const { seanceId } = req.params;
    try {
        let allSeances = await readSeancesTsv();
        const seanceIndex = allSeances.findIndex(s => s.id_seance === seanceId);
        if (seanceIndex === -1) return res.status(404).json({ message: "Séance non trouvée." });
        const seance = allSeances[seanceIndex];
        if (new Date(seance.date_heure_seance) <= new Date()) return res.status(400).json({ message: "Un devis ne peut être généré que pour une séance future." });
        if (seance.devis_number) { 
            const devisJsonPathCheck = path.join(devisDir, `${seance.devis_number}.json`);
            try {
                await fs.access(devisJsonPathCheck);
                return res.status(400).json({ message: `Cette séance a déjà un devis (${seance.devis_number}).` });
            } catch (e) {
                console.warn(`Le numéro de devis ${seance.devis_number} existe pour la séance ${seanceId} mais le fichier JSON est manquant. Un nouveau devis sera généré.`);
            }
        }
        if (seance.invoice_number) return res.status(400).json({ message: `Cette séance a déjà été facturée (${seance.invoice_number}) et ne peut pas faire l'objet d'un nouveau devis.` });

        const clientsData = await readClientsTsv();
        const client = clientsData.find(c => c.id === seance.id_client);
        if (!client) return res.status(404).json({ message: "Client associé à la séance non trouvé." });
        const tarifsData = await readTarifsTsv();
        const tarif = tarifsData.find(t => t.id === seance.id_tarif);
        if (!tarif) return res.status(404).json({ message: "Tarif associé à la séance non trouvé."});
        const settings = await readSettingsJson();
        const devisNumber = await getNextDevisNumber();
        const devisGenerationDate = new Date().toISOString();
        const devisData = {
            devisNumber: devisNumber, 
            devisDate: formatDateDDMMYYYY(devisGenerationDate), 
            seanceId: seance.id_seance, 
            client: {
                name: `${client.prenom || ''} ${client.nom || ''}`.trim(),
                address: client.adresse || '',
                city: client.ville || ''
            },
            service: [{
                description: tarif.libelle || 'Prestation de service (objet du devis)',
                quantity: 1,
                unitPrice: parseFloat(seance.montant_facture) || 0,
                Date: formatDateDDMMYYYY(seance.date_heure_seance) 
            }],
            validityDate: calculateValidityOrDueDate(devisGenerationDate, 30), 
            tva: settings.tva || 0,
            manager: settings.manager || {},
            legal: settings.legal || {}
        };
        await fs.mkdir(devisDir, { recursive: true }); 
        const devisJsonPath = path.join(devisDir, `${devisNumber}.json`);
        await fs.writeFile(devisJsonPath, JSON.stringify(devisData, null, 2), 'utf8');
        allSeances[seanceIndex].devis_number = devisNumber;
        await writeSeancesTsv(allSeances);
        res.status(200).json({ message: 'Devis généré avec succès', devisNumber: devisNumber });
    } catch (error) {
        console.error('Erreur API POST /api/seances/:seanceId/generate-devis :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur lors de la génération du devis.' });
    }
});
function generateDocumentHtmlForEmail(data) { 
    const isDevis = !!data.devisNumber;
    const docNumber = isDevis ? data.devisNumber : data.invoiceNumber;
    const docDate = isDevis ? data.devisDate : data.invoiceDate;
    const effectiveDueDateOrValidity = isDevis ? data.validityDate : data.dueDate; 
    const docTitle = isDevis ? 'DEVIS' : 'FACTURE';
    const docTypeLabel = isDevis ? 'Devis' : 'Facture';
    const paymentLabel = isDevis ? "MONTANT TOTAL DU DEVIS" : "MONTANT À RÉGLER";
    const clientLabel = isDevis ? 'Adressé à :' : 'Facturé à :';
    const itemDateLabel = isDevis ? 'Date Prestation Prévue' : 'Date';


    const formatDateForHtml = (dateStr) => {
        if (!dateStr) return 'N/A';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr; 
        try {
            return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch(e) { return dateStr; }
    };
    const formatCurrency = (value) => (typeof value === 'number' ? value : parseFloat(value || 0)).toFixed(2).replace('.', ',') + ' €';

    let itemsHtml = '';
    let total_ht = 0;
    if (data.service && Array.isArray(data.service)) {
        data.service.forEach(item => {
            const itemQuantity = parseFloat(item.quantity) || 1;
            const itemUnitPrice = parseFloat(item.unitPrice) || 0;
            const itemTotal = itemQuantity * itemUnitPrice;
            total_ht += itemTotal;
            itemsHtml += `
                <tr>
                    <td>${item.Date || formatDateForHtml(docDate)}</td>
                    <td>${item.description || 'Service'}</td>
                    <td style="text-align:right;">${itemQuantity}</td>
                    <td style="text-align:right;">${formatCurrency(itemUnitPrice)}</td>
                    <td style="text-align:right;">${formatCurrency(itemTotal)}</td>
                </tr>
            `;
        });
    }

    const tvaRate = parseFloat(data.tva) || 0;
    const tvaPercentage = tvaRate > 1 ? tvaRate : tvaRate * 100;
    const tvaAsDecimal = tvaRate > 1 ? tvaRate / 100 : tvaRate;
    const tvaAmount = total_ht * tvaAsDecimal;
    const total_ttc = total_ht + tvaAmount;

    const manager = data.manager || {};
    const client = data.client || {};
    const legal = data.legal || {};

    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>${docTypeLabel} ${docNumber}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; padding: 20px; border: 1px solid #eee; max-width: 800px; margin-left: auto; margin-right: auto; }
            .header, .client-info, .totals, .legal-mentions { margin-bottom: 20px; }
            .header { display: flex; justify-content: space-between; flex-wrap: wrap; }
            .manager-info { flex: 1 1 300px; margin-bottom:10px;}
            .invoice-info { text-align: right; flex: 1 1 300px; margin-bottom:10px;}
            .invoice-title { text-align: center; font-size: 1.8rem; color: #0056b3; margin: 20px 0; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size:0.9em; }
            th { background-color: #f2f2f2; }
            .total-row td { font-weight: bold; background-color: #f8f9fa;}
            .right { text-align: right; }
            .legal-mentions p {margin: 5px 0; font-size: 0.85em;}
            h4 {margin-top: 10px; margin-bottom:5px;}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="manager-info">
                <strong>${manager.name || 'Nom du Thérapeute'}</strong><br>
                ${manager.title || ''}<br>
                ${manager.description || ''}<br>
                ${manager.address || 'Adresse Manager'}<br>
                ${manager.city || 'Ville Manager'}<br>
                Téléphone : ${manager.phone || ''}<br>
                Email : ${manager.email || ''}
            </div>
            <div class="invoice-info">
                <strong>${docTypeLabel} N° : ${docNumber || (isDevis ? 'DEV-YYYY-XXXX' : 'FAC-YYYY-XXXX')}</strong><br>
                Date d'émission : ${docDate || formatDateForHtml(new Date().toISOString())}<br>
                ${isDevis ? 'Valide jusqu\'au :' : 'Date d\'échéance :'} ${effectiveDueDateOrValidity || formatDateForHtml(new Date(new Date().setDate(new Date().getDate() + 30)).toISOString())}
            </div>
        </div>

        <div class="invoice-title">${docTitle}</div>

        <div class="client-info">
            <strong>${clientLabel}</strong><br>
            ${client.name || 'Nom Client'}<br>
            ${client.address || 'Adresse Client'}<br>
            ${client.city || 'Ville Client'}
        </div>

        <table>
            <thead>
                <tr><th>${itemDateLabel}</th><th>Description</th><th class="right">Qté</th><th class="right">P.U. (€)</th><th class="right">Total HT (€)</th></tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <div class="totals">
            <table>
                <tbody>
                    <tr><td colspan="4" class="right">Total HT</td><td class="right">${formatCurrency(total_ht)}</td></tr>
                    <tr><td colspan="4" class="right">TVA (${tvaPercentage.toFixed(2).replace('.', ',')}%)</td><td class="right">${formatCurrency(tvaAmount)}</td></tr>
                    <tr class="total-row"><td colspan="4" class="right">Total TTC</td><td class="right">${formatCurrency(total_ttc)}</td></tr>
                </tbody>
            </table>
            <h3 class="right" style="color: #0056b3;">${paymentLabel} : ${formatCurrency(total_ttc)}</h3>
        </div>

        <div class="legal-mentions">
            <h4>Mentions Légales</h4>
            <p>SIRET : ${legal.siret || 'N/A'}<br>
            Code APE : ${legal.ape || 'N/A'}<br>
            N° ADELI : ${legal.adeli || 'N/A'}</p>
            <p>IBAN : ${legal.iban || 'N/A'}<br>
            BIC : ${legal.bic || 'N/A'}</p>
            <p>TVA : ${legal.tvaMention || (tvaPercentage === 0 ? "TVA non applicable - Art. 293B du CGI" : `TVA au taux de ${tvaPercentage.toFixed(2).replace('.', ',')}%`)}</p>
            ${!isDevis ? `<p>Conditions de règlement : ${legal.paymentTerms || 'Paiement à réception.'}</p>` : ''}
            <p>Assurance RCP : ${legal.insurance || 'N/A'}</p>
        </div>
    </body>
    </html>
    `;
}
async function generatePdfFromHtml(htmlContent) { 
    if (!puppeteer) {
      throw new Error("Puppeteer n'est pas disponible. La génération de PDF est désactivée.");
    }
    let browser = null;
    try {
        const puppeteerOptions = {
            args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-accelerated-2d-canvas','--no-first-run','--no-zygote','--disable-gpu'],
            headless: true 
        };
        browser = await puppeteer.launch(puppeteerOptions);
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4', printBackground: true,
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
        });
        return pdfBuffer;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// --- Envoi d'email avec OAuth2 ---
async function sendEmailWithNodemailer(mailOptions) {
    if (!oauth2Client || !activeGoogleAuthTokens.userEmail || !activeGoogleAuthTokens.refreshToken) {
        console.error("Tentative d'envoi d'email sans configuration OAuth2 complète ou jeton de rafraîchissement.");
        throw new Error("Configuration Gmail (OAuth2) incomplète ou invalide sur le serveur.");
    }

    oauth2Client.setCredentials({
        refresh_token: activeGoogleAuthTokens.refreshToken
    });
    
    let accessTokenForMail = activeGoogleAuthTokens.accessToken;
    if (!accessTokenForMail || (activeGoogleAuthTokens.expiryDate && activeGoogleAuthTokens.expiryDate < Date.now() + 60000 )) {
        try {
            const { token, expiry_date } = await oauth2Client.getAccessToken(); 
            accessTokenForMail = token;
            activeGoogleAuthTokens.accessToken = token; 
            activeGoogleAuthTokens.expiryDate = expiry_date;
        } catch (refreshError) {
            console.error("Erreur lors du rafraîchissement du jeton d'accès pour Nodemailer:", refreshError.message);
            throw new Error(`Impossible de rafraîchir le jeton d'accès Google: ${refreshError.message}`);
        }
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: activeGoogleAuthTokens.userEmail,
            clientId: googleOAuthConfig.clientId,
            clientSecret: googleOAuthConfig.clientSecret,
            refreshToken: activeGoogleAuthTokens.refreshToken,
            accessToken: accessTokenForMail, 
            expires: activeGoogleAuthTokens.expiryDate 
        }
    });
    return transporter.sendMail(mailOptions);
}

app.post('/api/invoice/:invoiceNumber/send-by-email', async (req, res) => {
    const { invoiceNumber } = req.params;
    const { clientEmail } = req.body; 
    if (!clientEmail) return res.status(400).json({ message: "Email client requis." });
    if (!puppeteer) return res.status(500).json({ message: "Erreur PDF." });
    
    try {
        const settings = await readSettingsJson(); 
        const invoiceJsonPath = path.join(factsDir, `${invoiceNumber}.json`);
        const invoiceData = JSON.parse(await fs.readFile(invoiceJsonPath, 'utf8'));
        const documentHtmlForEmailBody = generateDocumentHtmlForEmail(invoiceData);
        const pdfBuffer = await generatePdfFromHtml(documentHtmlForEmailBody);
        const mailOptions = {
            from: `"${settings.manager.name || 'Votre Cabinet'}" <${activeGoogleAuthTokens.userEmail}>`, 
            to: clientEmail, 
            cc: activeGoogleAuthTokens.userEmail, 
            subject: `Facture ${invoiceNumber} - ${settings.manager.name || 'Votre Cabinet'}`,
            html: documentHtmlForEmailBody,
            attachments: [{ filename: `Facture-${invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
        };
        await sendEmailWithNodemailer(mailOptions);
        res.status(200).json({ message: `Facture ${invoiceNumber} envoyée à ${clientEmail}.` });
    } catch (error) {
        console.error(`Erreur envoi email facture ${invoiceNumber}:`, error);
        res.status(500).json({ message: `Échec envoi email: ${error.message}` });
    }
});

app.post('/api/devis/:devisNumber/send-by-email', async (req, res) => {
    const { devisNumber } = req.params;
    const { clientEmail } = req.body; 
    if (!clientEmail) return res.status(400).json({ message: "Email client requis." });
    if (!puppeteer) return res.status(500).json({ message: "Erreur PDF." });
    
    try {
        const settings = await readSettingsJson();
        const devisJsonPath = path.join(devisDir, `${devisNumber}.json`);
        const devisData = JSON.parse(await fs.readFile(devisJsonPath, 'utf8'));
        const documentHtmlForEmailBody = generateDocumentHtmlForEmail(devisData);
        const pdfBuffer = await generatePdfFromHtml(documentHtmlForEmailBody);
        const mailOptions = {
            from: `"${settings.manager.name || 'Votre Cabinet'}" <${activeGoogleAuthTokens.userEmail}>`,
            to: clientEmail, 
            cc: activeGoogleAuthTokens.userEmail,
            subject: `Devis ${devisNumber} - ${settings.manager.name || 'Votre Cabinet'}`,
            html: documentHtmlForEmailBody,
            attachments: [{ filename: `Devis-${devisNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
        };
        await sendEmailWithNodemailer(mailOptions);
        res.status(200).json({ message: `Devis ${devisNumber} envoyé à ${clientEmail}.` });
    } catch (error) {
        console.error(`Erreur envoi email devis ${devisNumber}:`, error);
        res.status(500).json({ message: `Échec envoi email: ${error.message}` });
    }
});

// --- Points d'API pour la Configuration ---
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await readSettingsJson();
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
                userEmail: (settings.googleOAuth && settings.googleOAuth.userEmail) ? settings.googleOAuth.userEmail : null,
                scopes: (settings.googleOAuth && settings.googleOAuth.scopes) ? settings.googleOAuth.scopes : []
            },
            tva: settings.tva,
            legal: settings.legal,
            googleCalendar: settings.googleCalendar
        };
        res.json(clientSafeSettings);
    } catch (error) {
        console.error('Erreur API GET /api/settings :', error.message);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des paramètres' });
    }
});


app.post('/api/settings', async (req, res) => {
    try {
        const newSettingsFromClient = req.body;
        let currentSettings = await readSettingsJson(); 

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

        await writeSettingsJson(settingsToSave);

        const clientSafeResponse = { ...settingsToSave };
         if (clientSafeResponse.manager) {
            delete clientSafeResponse.manager.encodedGmailAppPassword; 
        }
        if (clientSafeResponse.googleOAuth) { 
            delete clientSafeResponse.googleOAuth.refreshToken;
        }

        res.status(200).json(clientSafeResponse); 
    } catch (error) {
        console.error('Erreur API POST /api/settings :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde des paramètres' });
    }
});

// Démarrer le serveur
async function startServer() {
    await loadAndInitializeOAuthClient(); 
    // L'initialisation de calendarHelper se fait via setAuth dans loadAndInitializeOAuthClient ou le callback OAuth

    app.listen(PORT, () => {
        console.log(`Serveur Node.js en cours d'exécution sur http://localhost:${PORT}`);
        if (!oauth2Client) {
            console.error("ERREUR CRITIQUE: Client OAuth2 non initialisé. Vérifiez OAuth2.0.json.");
        } else if (!activeGoogleAuthTokens.refreshToken) {
            console.warn("ATTENTION: Aucun compte Google n'est actuellement connecté via OAuth2. Les fonctionnalités Gmail et Calendar nécessitent une connexion.");
        } else {
            console.log(`Connecté à Google en tant que: ${activeGoogleAuthTokens.userEmail}`);
        }
        if (!puppeteer) console.warn("ATTENTION: Puppeteer non chargé. Génération PDF désactivée.");
        
        if (calendarHelper.isCalendarConfigured()) { 
             console.log("L'intégration Google Calendar est prête à utiliser l'authentification OAuth.");
        } else {
             console.warn("ATTENTION: L'intégration Google Calendar n'est pas pleinement opérationnelle (problème d'authentification OAuth ou configuration).");
        }
    });
}

startServer().catch(error => {
    console.error("Impossible de démarrer le serveur:", error);
});


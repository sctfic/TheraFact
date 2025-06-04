// server.js
const express = require('express');
const fs = require('fs').promises;
const fssync = require('fs'); 
const path =require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');
let puppeteer; 

// Tentative d'import de puppeteer
try {
  puppeteer = require('puppeteer');
} catch (error) {
  console.warn("ATTENTION : Le module 'puppeteer' n'est pas installé. La génération de PDF ne fonctionnera pas.");
  console.warn("Pour l'installer, exécutez : npm install puppeteer");
  puppeteer = null;
}

// Import pour Google Calendar
const { google } = require('googleapis');
const calendarHelper = require('./google-calendar-helper'); // Fichier auxiliaire pour Google Calendar

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Répertoire des données
const dataDir = path.join(__dirname, 'data');
const clientsFilePath = path.join(dataDir, 'clients.tsv');
const tarifsFilePath = path.join(dataDir, 'tarifs.tsv');
const seancesFilePath = path.join(dataDir, 'seances.tsv');
const settingsFilePath = path.join(dataDir, 'settings.json');
const factsDir = path.join(__dirname, 'public', 'Facts');
const devisDir = path.join(__dirname, 'public', 'Devis');

fs.mkdir(dataDir, { recursive: true }).catch(err => console.error("Erreur création dataDir:", err.message));
fs.mkdir(factsDir, { recursive: true }).catch(err => console.error("Erreur création factsDir:", err.message));
fs.mkdir(devisDir, { recursive: true }).catch(err => console.error("Erreur création devisDir:", err.message));

// --- Fonctions utilitaires pour la lecture/écriture TSV ---
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
            if (value === '' || value === 'null' || value === undefined || value === 'undefined') { // Ajout de 'undefined' string
                value = null;
            }
            // Conversion numérique pour les champs spécifiques
            if (header === 'montant' || header === 'montant_facture' || header === 'tva') {
                entry[header] = value !== null ? parseFloat(value) : 0;
            } else if (header === 'duree') { // Conversion pour duree
                entry[header] = value !== null ? parseInt(value, 10) : null;
            }
             else {
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
            if (value === null || value === undefined) {
                return ''; // Retourner une chaîne vide pour null ou undefined
            }
            // Formatage spécifique pour les nombres
            if (typeof value === 'number' && (header === 'montant' || header === 'montant_facture' || header === 'tva')) {
                return value.toFixed(2);
            }
            if (typeof value === 'number' && header === 'duree') {
                 return String(value);
            }
            return String(value).replace(/\t|\n|\r/g, ' '); // Échapper les caractères spéciaux
        }).join('\t');
    });
    return [headerString, ...rows].join('\r\n') + '\r\n';
}

// Lecture et écriture spécifiques pour les Clients (TSV)
const clientsHeaders = ['id', 'nom', 'prenom', 'telephone', 'email', 'adresse', 'ville', 'notes', 'defaultTarifId', 'statut', 'dateCreation'];
async function readClientsTsv() {
    try {
        await fs.access(dataDir); 
        const data = await fs.readFile(clientsFilePath, 'utf8');
        return parseTSV(data, clientsHeaders);
    } catch (error) {
        if (error.code === 'ENOENT') { 
            console.log(`Fichier ${clientsFilePath} non trouvé. Tentative de création...`);
            try {
                await fs.writeFile(clientsFilePath, clientsHeaders.join('\t') + '\r\n', 'utf8');
                console.log(`Fichier ${clientsFilePath} créé avec succès.`);
                return []; 
            } catch (writeError) {
                console.error(`Échec de la création du fichier ${clientsFilePath}:`, writeError.message);
                return []; 
            }
        }
        console.error(`Erreur lors de la lecture de ${clientsFilePath}:`, error.message);
        return []; 
    }
}
async function writeClientsTsv(clients) {
    try {
        await fs.mkdir(dataDir, { recursive: true }); 
        await fs.writeFile(clientsFilePath, formatTSV(clients, clientsHeaders), 'utf8');
    } catch (error) {
        console.error(`Erreur lors de l'écriture dans ${clientsFilePath}:`, error.message);
    }
}

// Lecture et écriture spécifiques pour les Tarifs (TSV)
const tarifsHeaders = ['id', 'libelle', 'montant', 'duree']; // Ajout de 'duree'
async function readTarifsTsv() {
    try {
        await fs.access(dataDir);
        const data = await fs.readFile(tarifsFilePath, 'utf8');
        return parseTSV(data, tarifsHeaders);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Fichier ${tarifsFilePath} non trouvé. Tentative de création...`);
            try {
                await fs.writeFile(tarifsFilePath, tarifsHeaders.join('\t') + '\r\n', 'utf8');
                console.log(`Fichier ${tarifsFilePath} créé avec succès.`);
                return [];
            } catch (writeError) {
                console.error(`Échec de la création du fichier ${tarifsFilePath}:`, writeError.message);
                return [];
            }
        }
        console.error(`Erreur lors de la lecture de ${tarifsFilePath}:`, error.message);
        return [];
    }
}
async function writeTarifsTsv(tarifs) {
     try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(tarifsFilePath, formatTSV(tarifs, tarifsHeaders), 'utf8');
    } catch (error) {
        console.error(`Erreur lors de l'écriture dans ${tarifsFilePath}:`, error.message);
    }
}

// Lecture et écriture spécifiques pour les Séances (TSV)
// Ajout de 'googleCalendarEventId' et 'previous_statut_seance' (ce dernier est transitoire, pas besoin de le stocker dans le TSV à long terme mais utile pour la logique de MAJ)
const seancesHeaders = ['id_seance', 'id_client', 'date_heure_seance', 'id_tarif', 'montant_facture', 'statut_seance', 'mode_paiement', 'date_paiement', 'invoice_number', 'devis_number', 'googleCalendarEventId'];
async function readSeancesTsv() {
    try {
        await fs.access(dataDir);
        const data = await fs.readFile(seancesFilePath, 'utf8');
        return parseTSV(data, seancesHeaders);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Fichier ${seancesFilePath} non trouvé. Tentative de création...`);
            try {
                await fs.writeFile(seancesFilePath, seancesHeaders.join('\t') + '\r\n', 'utf8');
                console.log(`Fichier ${seancesFilePath} créé avec succès.`);
                return [];
            } catch (writeError) {
                console.error(`Échec de la création du fichier ${seancesFilePath}:`, writeError.message);
                return [];
            }
        }
        console.error(`Erreur lors de la lecture de ${seancesFilePath}:`, error.message);
        return [];
    }
}
async function writeSeancesTsv(seances) {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(seancesFilePath, formatTSV(seances, seancesHeaders), 'utf8');
    } catch (error) {
        console.error(`Erreur lors de l'écriture dans ${seancesFilePath}:`, error.message);
    }
}

// --- Fonctions pour la configuration (settings.json) ---
// Variable globale pour stocker temporairement le mot de passe d'application après un test réussi.
// NE PAS STOCKER EN CLAIR DANS settings.json. Utiliser des variables d'environnement pour la production.
let temporaryGmailAppPassword = null; 
let gmailUserForTransport = null;

const defaultSettings = {
  manager: {
    name: "",
    title: "",
    description: "",
    address: "",
    city: "",
    phone: "",
    email: "", // Sera GMAIL_USER
    // GMAIL_APP_PASSWORD n'est pas stocké ici, mais son statut de test oui.
    gmailAppPasswordStatus: "not_set" // 'not_set', 'success', 'failed'
  },
  tva: 0,
  legal: {
    siret: "",
    ape: "",
    adeli: "",
    iban: "",
    bic: "",
    tvaMention: "TVA non applicable selon l'article 293B du Code Général des Impôts",
    paymentTerms: "Paiement à réception de facture",
    insurance: "AXA Assurances - Police n° 123456789 - Garantie territoriale : France/Europe"
  },
  googleCalendar: {
    calendarId: "primary", // ID du calendrier à utiliser (par défaut 'primary')
    // Les credentials pour le service account ou OAuth2 doivent être gérés séparément (ex: fichier JSON pointé par une variable d'env)
    // serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || null 
  }
};

async function readSettingsJson() {
    try {
        await fs.access(dataDir);
        const data = await fs.readFile(settingsFilePath, 'utf8');
        const loadedSettings = JSON.parse(data);
        // Assurer que la structure par défaut est présente si des champs manquent
        const mergedSettings = {
            ...defaultSettings,
            ...loadedSettings,
            manager: { ...defaultSettings.manager, ...(loadedSettings.manager || {}) },
            legal: { ...defaultSettings.legal, ...(loadedSettings.legal || {}) },
            googleCalendar: { ...defaultSettings.googleCalendar, ...(loadedSettings.googleCalendar || {}) }
        };
        // Initialiser le transporteur Nodemailer si les identifiants sont valides via les variables globales
        if (mergedSettings.manager.email && temporaryGmailAppPassword && mergedSettings.manager.gmailAppPasswordStatus === 'success') {
            gmailUserForTransport = mergedSettings.manager.email;
            // Le transporteur sera créé à la volée lors de l'envoi d'email
        }
        return mergedSettings;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Fichier ${settingsFilePath} non trouvé. Création avec les valeurs par défaut...`);
            try {
                await fs.writeFile(settingsFilePath, JSON.stringify(defaultSettings, null, 2), 'utf8');
                console.log(`Fichier ${settingsFilePath} créé avec succès.`);
                return defaultSettings;
            } catch (writeError) {
                console.error(`Échec de la création du fichier ${settingsFilePath}:`, writeError.message);
                return defaultSettings; 
            }
        }
        console.error(`Erreur lors de la lecture ou du parsing de ${settingsFilePath}:`, error.message);
        return defaultSettings; 
    }
}

async function writeSettingsJson(settingsToSave) {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        // Ne jamais écrire GMAIL_APP_PASSWORD dans le fichier settings.json
        const { gmailAppPassword, ...managerWithoutPassword } = settingsToSave.manager || {};
        const settingsForFile = {
            ...settingsToSave,
            manager: managerWithoutPassword
        };
        await fs.writeFile(settingsFilePath, JSON.stringify(settingsForFile, null, 2), 'utf8');
    } catch (error) {
        console.error(`Erreur lors de l'écriture dans ${settingsFilePath}:`, error.message);
    }
}

// Fonction pour générer un ID client lisible
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

// Fonction pour générer un ID tarif lisible
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

// Fonction pour formater la date en DD/MM/YYYY
function formatDateDDMMYYYY(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return '';
    }
}

function calculateValidityOrDueDate(baseDateStr, days = 30) {
    if (!baseDateStr) return '';
    try {
        const date = new Date(baseDateStr);
        if (isNaN(date.getTime())) return '';
        date.setDate(date.getDate() + days);
        return formatDateDDMMYYYY(date);
    } catch (e) {
        return '';
    }
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
                if (!isNaN(numPart) && numPart > maxCounter) {
                    maxCounter = numPart;
                }
            }
        });
    } catch (err) {
        console.warn("Attention: Impossible de lire les numéros de facture existants:", err.message);
    }
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
                if (!isNaN(numPart) && numPart > maxCounter) {
                    maxCounter = numPart;
                }
            }
        });
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.warn("Attention: Impossible de lire les numéros de devis existants:", err.message);
        }
    }
    return `${prefix}${(maxCounter + 1).toString().padStart(4, '0')}`;
}


// --- Points d'API pour les Clients ---
app.get('/api/clients', async (req, res) => {
    try {
        const clients = await readClientsTsv();
        res.json(clients);
    } catch (error) {
        console.error('Erreur API /api/clients :', error.message);
        res.status(500).json({ message: 'Erreur serveur (clients)' });
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
        if (index > -1) {
            clients[index] = { ...clients[index], ...newClient };
        } else {
            clients.push(newClient);
        }
        await writeClientsTsv(clients);
        res.status(200).json(newClient);
    } catch (error) {
        console.error('Erreur sauvegarde client :', error.message);
        res.status(500).json({ message: 'Erreur sauvegarde client' });
    }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let clients = await readClientsTsv();
        let seances = await readSeancesTsv(); 
        const clientHasSeances = seances.some(s => s.id_client === id);
        if (clientHasSeances) {
            return res.status(400).json({ message: "Ce client a des séances. Supprimez/réassignez ses séances d'abord." });
        }
        const initialLength = clients.length;
        clients = clients.filter(c => c.id !== id);
        if (clients.length === initialLength) {
            return res.status(404).json({ message: 'Client non trouvé' });
        }
        await writeClientsTsv(clients);
        res.status(200).json({ message: 'Client supprimé' });
    } catch (error) {
        console.error('Erreur suppression client :', error.message);
        res.status(500).json({ message: 'Erreur suppression client' });
    }
});


// --- Points d'API pour les Tarifs ---
app.get('/api/tarifs', async (req, res) => {
    try {
        const tarifs = await readTarifsTsv();
        res.json(tarifs);
    } catch (error) {
        console.error('Erreur API /api/tarifs :', error.message);
        res.status(500).json({ message: 'Erreur serveur (tarifs)' });
    }
});

app.post('/api/tarifs', async (req, res) => {
    try {
        const newTarif = req.body;
        let tarifs = await readTarifsTsv();
        if (!newTarif.id) {
            newTarif.id = await generateTarifId(newTarif.libelle, newTarif.montant, tarifs);
        }
        // Assurer que la durée est un nombre ou null
        newTarif.duree = newTarif.duree ? parseInt(newTarif.duree, 10) : null;
        if (newTarif.duree !== null && isNaN(newTarif.duree)) {
            return res.status(400).json({ message: 'La durée doit être un nombre valide.' });
        }

        const index = tarifs.findIndex(t => t.id === newTarif.id);
        if (index > -1) {
            tarifs[index] = newTarif;
        } else {
            tarifs.push(newTarif);
        }
        await writeTarifsTsv(tarifs);
        res.status(200).json(newTarif);
    } catch (error) {
        console.error('Erreur sauvegarde tarif :', error.message);
        res.status(500).json({ message: 'Erreur sauvegarde tarif' });
    }
});

app.delete('/api/tarifs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let tarifs = await readTarifsTsv();
        let clients = await readClientsTsv(); 
        let seances = await readSeancesTsv(); 
        const tarifIsDefault = clients.some(c => c.defaultTarifId === id);
        const tarifInSeance = seances.some(s => s.id_tarif === id);
        if (tarifIsDefault || tarifInSeance) {
            return res.status(400).json({ message: "Tarif utilisé (client/séance). Modifiez-le d'abord." });
        }
        const initialLength = tarifs.length;
        tarifs = tarifs.filter(t => t.id !== id);
        if (tarifs.length === initialLength) {
            return res.status(404).json({ message: 'Tarif non trouvé' });
        }
        await writeTarifsTsv(tarifs);
        res.status(200).json({ message: 'Tarif supprimé' });
    } catch (error) {
        console.error('Erreur suppression tarif :', error.message);
        res.status(500).json({ message: 'Erreur suppression tarif' });
    }
});


// --- Points d'API pour les Séances ---
app.get('/api/seances', async (req, res) => {
    try {
        let seances = await readSeancesTsv();
        let tsvModified = false;

        let existingInvoiceFiles = [];
        try {
            const files = await fs.readdir(factsDir);
            existingInvoiceFiles = files.filter(file => file.endsWith('.json')).map(file => file.slice(0, -5));
        } catch (err) {
            if (err.code !== 'ENOENT') console.warn(`Err lecture ${factsDir}: ${err.message}`);
        }
        
        for (let i = 0; i < seances.length; i++) {
            const seance = seances[i];
            if (seance.invoice_number && seance.invoice_number.trim() !== '') {
                if (!existingInvoiceFiles.includes(seance.invoice_number)) {
                    seances[i].invoice_number = null; tsvModified = true;
                }
            }
        }

        let existingDevisFiles = [];
        try {
            const files = await fs.readdir(devisDir);
            existingDevisFiles = files.filter(file => file.endsWith('.json')).map(file => file.slice(0, -5));
        } catch (err) {
            if (err.code !== 'ENOENT') console.warn(`Err lecture ${devisDir}: ${err.message}`);
        }

        for (let i = 0; i < seances.length; i++) {
            const seance = seances[i];
            if (seance.devis_number && seance.devis_number.trim() !== '') {
                if (!existingDevisFiles.includes(seance.devis_number)) {
                    seances[i].devis_number = null; tsvModified = true;
                }
            }
        }

        if (tsvModified) await writeSeancesTsv(seances);
        res.json(seances);
    } catch (error) {
        console.error('Erreur API /api/seances :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur (séances)' });
    }
});

app.get('/api/invoice/:invoiceNumber/status', async (req, res) => {
    const { invoiceNumber } = req.params;
    try {
        const allSeances = await readSeancesTsv();
        const isDevisRequest = invoiceNumber.startsWith('DEV-');
        
        const seance = allSeances.find(s =>
            isDevisRequest ? s.devis_number === invoiceNumber : s.invoice_number === invoiceNumber
        );

        if (!seance) return res.status(404).json({ message: `Doc ${invoiceNumber} non lié à une séance.` });

        if (isDevisRequest) {
            const isFutureSeance = new Date(seance.date_heure_seance) > new Date();
            res.json({ documentType: 'devis', statusText: 'DEVIS', seanceId: seance.id_seance, isFuture: isFutureSeance });
        } else {
            let statusTextForWatermark = seance.statut_seance;
            if (seance.statut_seance === 'APAYER') statusTextForWatermark = 'À PAYER';
            else if (seance.statut_seance === 'PAYEE') statusTextForWatermark = 'PAYÉE';
            else if (seance.statut_seance === 'ANNULEE') statusTextForWatermark = 'ANNULÉE';
            else if (seance.statut_seance === 'PLANIFIEE') statusTextForWatermark = 'PLANIFIÉE';


            res.json({ documentType: 'invoice', statut_seance: seance.statut_seance, statusText: statusTextForWatermark, seanceId: seance.id_seance });
        }
    } catch (error) {
        console.error(`Erreur statut doc ${invoiceNumber}:`, error.message);
        res.status(500).json({ message: 'Erreur serveur (statut doc).' });
    }
});


app.post('/api/seances', async (req, res) => {
    try {
        const seanceData = req.body;
        let allSeances = await readSeancesTsv();
        const settings = await readSettingsJson(); // Pour GMAIL_USER et ID calendrier
        const client = (await readClientsTsv()).find(c => c.id === seanceData.id_client);
        const tarif = (await readTarifsTsv()).find(t => t.id === seanceData.id_tarif);

        const index = allSeances.findIndex(s => s.id_seance === seanceData.id_seance);
        let isNewSeance = false;
        let oldStatus = null;
        let seanceForCalendar = { ...seanceData }; // Copie pour le calendrier

        if (index > -1) { // Mise à jour
            oldStatus = allSeances[index].statut_seance;
            seanceForCalendar.googleCalendarEventId = allSeances[index].googleCalendarEventId; // Récupérer l'ID existant
            allSeances[index] = { ...allSeances[index], ...seanceData };
        } else { // Nouvelle séance
            isNewSeance = true;
            allSeances.push(seanceData);
        }
        
        // Logique Google Calendar
        if (settings.manager.email && calendarHelper.isCalendarConfigured()) {
            const seanceDateTime = new Date(seanceData.date_heure_seance);
            let dureeMinutes = tarif && tarif.duree ? parseInt(tarif.duree) : 60; // Durée par défaut 60 min
            if (isNaN(dureeMinutes) || dureeMinutes <=0) dureeMinutes = 60;

            const eventSummary = `Séance ${client ? client.prenom + ' ' + client.nom : 'Client'} (${tarif ? tarif.libelle : 'Tarif'})`;
            const eventDescription = `Séance avec ${client ? client.prenom + ' ' + client.nom : 'un client'}.\nTarif: ${tarif ? tarif.libelle : 'N/A'}\nStatut: ${seanceData.statut_seance}`;

            if (isNewSeance && seanceData.statut_seance !== 'ANNULEE') {
                try {
                    const eventId = await calendarHelper.createEvent(
                        settings.googleCalendar.calendarId || 'primary',
                        eventSummary,
                        eventDescription,
                        seanceDateTime,
                        dureeMinutes,
                        settings.manager.email // Attendee (manager)
                    );
                    if (eventId) {
                        if (index > -1) allSeances[index].googleCalendarEventId = eventId;
                        else allSeances[allSeances.length - 1].googleCalendarEventId = eventId;
                        seanceData.googleCalendarEventId = eventId; // Pour la réponse
                        console.log(`Événement calendrier ${eventId} créé pour séance ${seanceData.id_seance}`);
                    }
                } catch (calError) {
                    console.error("Erreur création événement Google Calendar:", calError.message);
                    // Ne pas bloquer la sauvegarde de la séance pour une erreur calendrier
                }
            } else if (!isNewSeance && seanceForCalendar.googleCalendarEventId) {
                if (seanceData.statut_seance === 'ANNULEE' && oldStatus !== 'ANNULEE') {
                    try {
                        await calendarHelper.deleteEvent(settings.googleCalendar.calendarId || 'primary', seanceForCalendar.googleCalendarEventId);
                        console.log(`Événement calendrier ${seanceForCalendar.googleCalendarEventId} supprimé pour séance ${seanceData.id_seance}`);
                        if (index > -1) allSeances[index].googleCalendarEventId = null; // Retirer l'ID
                        seanceData.googleCalendarEventId = null;
                    } catch (calError) {
                        console.error("Erreur suppression événement Google Calendar:", calError.message);
                    }
                } else if (seanceData.statut_seance !== 'ANNULEE' && oldStatus === 'ANNULEE') { // Réactivation
                     try {
                        const eventId = await calendarHelper.createEvent(
                            settings.googleCalendar.calendarId || 'primary',
                            eventSummary,
                            eventDescription,
                            seanceDateTime,
                            dureeMinutes,
                            settings.manager.email
                        );
                        if (eventId) {
                             if (index > -1) allSeances[index].googleCalendarEventId = eventId;
                             seanceData.googleCalendarEventId = eventId;
                             console.log(`Événement calendrier ${eventId} re-créé pour séance ${seanceData.id_seance}`);
                        }
                    } catch (calError) {
                        console.error("Erreur re-création événement Google Calendar:", calError.message);
                    }
                } else if (seanceData.statut_seance !== 'ANNULEE') { // Mise à jour d'un événement existant non annulé
                    try {
                        await calendarHelper.updateEvent(
                            settings.googleCalendar.calendarId || 'primary',
                            seanceForCalendar.googleCalendarEventId,
                            eventSummary,
                            eventDescription,
                            seanceDateTime,
                            dureeMinutes,
                            settings.manager.email
                        );
                        console.log(`Événement calendrier ${seanceForCalendar.googleCalendarEventId} mis à jour pour séance ${seanceData.id_seance}`);
                    } catch (calError) {
                        console.error("Erreur MAJ événement Google Calendar:", calError.message);
                    }
                }
            }
        }

        await writeSeancesTsv(allSeances);
        // Renvoyer la séance avec potentiellement l'ID de l'événement calendrier
        const finalSeanceData = index > -1 ? allSeances[index] : allSeances[allSeances.length -1];
        res.status(200).json({ message: 'Séance enregistrée avec succès.', updatedSeance: finalSeanceData });

    } catch (error) {
        console.error('Erreur sauvegarde séance :', error.message, error.stack);
        res.status(500).json({ message: `Erreur sauvegarde séance: ${error.message}` });
    }
});

app.delete('/api/seances/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let seances = await readSeancesTsv();
        const settings = await readSettingsJson();
        const seanceToDelete = seances.find(s => s.id_seance === id);

        if (!seanceToDelete) return res.status(404).json({ message: 'Séance non trouvée' });
        if (seanceToDelete.invoice_number) return res.status(400).json({ message: "Séance facturée, suppression impossible." });
        
        if (seanceToDelete.googleCalendarEventId && settings.manager.email && calendarHelper.isCalendarConfigured()) {
            try {
                await calendarHelper.deleteEvent(settings.googleCalendar.calendarId || 'primary', seanceToDelete.googleCalendarEventId);
                console.log(`Événement calendrier ${seanceToDelete.googleCalendarEventId} supprimé (suppression séance).`);
            } catch (calError) {
                console.warn(`Avertissement: Erreur suppression événement calendrier ${seanceToDelete.googleCalendarEventId}: ${calError.message}`);
            }
        }
        
        if (seanceToDelete.devis_number) {
            const devisJsonPath = path.join(devisDir, `${seanceToDelete.devis_number}.json`);
            try { await fs.unlink(devisJsonPath); } 
            catch (unlinkError) { if (unlinkError.code !== 'ENOENT') console.warn(`Avertissement: Erreur suppression devis ${seanceToDelete.devis_number}.json : ${unlinkError.message}`);}
        }

        seances = seances.filter(s => s.id_seance !== id);
        await writeSeancesTsv(seances);
        res.status(200).json({ message: 'Séance supprimée' });
    } catch (error) {
        console.error('Erreur suppression séance :', error.message);
        res.status(500).json({ message: 'Erreur suppression séance' });
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
                console.warn(`Le numéro de facture ${seance.invoice_number} existe pour la séance ${seanceId} mais le fichier JSON est manquant.`);
            }
        }

        const clientsData = await readClientsTsv();
        const client = clientsData.find(c => c.id === seance.id_client);
        if (!client) return res.status(404).json({ message: "Client non trouvé." });
        const tarifsData = await readTarifsTsv();
        const tarif = tarifsData.find(t => t.id === seance.id_tarif);
        if (!tarif) return res.status(404).json({ message: "Tarif non trouvé."});
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
        res.status(200).json({ message: 'Facture générée', invoiceNumber: invoiceNumber, newSeanceStatus: allSeances[seanceIndex].statut_seance });
    } catch (error) {
        console.error('Erreur génération facture :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur (génération facture).' });
    }
});

app.post('/api/seances/:seanceId/generate-devis', async (req, res) => {
    const { seanceId } = req.params;
    try {
        let allSeances = await readSeancesTsv();
        const seanceIndex = allSeances.findIndex(s => s.id_seance === seanceId);
        if (seanceIndex === -1) return res.status(404).json({ message: "Séance non trouvée." });
        const seance = allSeances[seanceIndex];
        if (new Date(seance.date_heure_seance) <= new Date()) return res.status(400).json({ message: "Devis pour séances futures uniquement." });
        if (seance.devis_number) {
            const devisJsonPathCheck = path.join(devisDir, `${seance.devis_number}.json`);
            try {
                await fs.access(devisJsonPathCheck);
                return res.status(400).json({ message: `Cette séance a déjà un devis (${seance.devis_number}).` });
            } catch (e) {
                console.warn(`Le numéro de devis ${seance.devis_number} existe pour la séance ${seanceId} mais le fichier JSON est manquant. Un nouveau devis sera généré.`);
            }
        }
        if (seance.invoice_number) return res.status(400).json({ message: `Séance facturée (${seance.invoice_number}), pas de nouveau devis.` });

        const clientsData = await readClientsTsv();
        const client = clientsData.find(c => c.id === seance.id_client);
        if (!client) return res.status(404).json({ message: "Client non trouvé." });
        const tarifsData = await readTarifsTsv();
        const tarif = tarifsData.find(t => t.id === seance.id_tarif);
        if (!tarif) return res.status(404).json({ message: "Tarif non trouvé."});
        const settings = await readSettingsJson();
        const devisNumber = await getNextDevisNumber();
        const devisGenerationDate = new Date().toISOString();
        const devisData = {
            devisNumber: devisNumber, // Clé spécifique au devis
            devisDate: formatDateDDMMYYYY(devisGenerationDate), // Date de génération du devis
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
                Date: formatDateDDMMYYYY(seance.date_heure_seance) // Date of the planned service
            }],
            validityDate: calculateValidityOrDueDate(devisGenerationDate, 30), // Devis valide 30 jours
            tva: settings.tva || 0,
            manager: settings.manager || {},
            legal: settings.legal || {}
        };
        await fs.mkdir(devisDir, { recursive: true }); 
        const devisJsonPath = path.join(devisDir, `${devisNumber}.json`);
        await fs.writeFile(devisJsonPath, JSON.stringify(devisData, null, 2), 'utf8');
        allSeances[seanceIndex].devis_number = devisNumber;
        await writeSeancesTsv(allSeances);
        res.status(200).json({ message: 'Devis généré', devisNumber: devisNumber });
    } catch (error) {
        console.error('Erreur génération devis :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur (génération devis).' });
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
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr; // Already formatted DD/MM/YYYY
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

app.post('/api/invoice/:invoiceNumber/send-by-email', async (req, res) => {
    const { invoiceNumber } = req.params;
    const { clientEmail } = req.body; 
    if (!clientEmail) return res.status(400).json({ message: "Email client requis." });
    if (!puppeteer) return res.status(500).json({ message: "Erreur serveur : module PDF manquant." });
    
    const settings = await readSettingsJson();
    if (!settings.manager || !settings.manager.email || settings.manager.gmailAppPasswordStatus !== 'success' || !gmailUserForTransport || !temporaryGmailAppPassword) {
        return res.status(500).json({ message: "Configuration SMTP (Gmail) incomplète ou test non réussi sur le serveur." });
    }

    try {
        const invoiceJsonPath = path.join(factsDir, `${invoiceNumber}.json`);
        let invoiceData;
        try { invoiceData = JSON.parse(await fs.readFile(invoiceJsonPath, 'utf8')); } 
        catch (fileError) { return res.status(404).json({ message: `Facture ${invoiceNumber}.json non trouvée.` }); }
        
        const documentHtmlForEmailBody = generateDocumentHtmlForEmail(invoiceData);
        const pdfBuffer = await generatePdfFromHtml(documentHtmlForEmailBody);

        const transporter = nodemailer.createTransport({
            service: 'gmail', // Utiliser 'service' pour Gmail simplifie la config
            auth: { user: gmailUserForTransport, pass: temporaryGmailAppPassword, },
        });
        const mailOptions = {
            from: `"${settings.manager.name || 'Votre Cabinet'}" <${process.env.GMAIL_USER}>`,
            to: clientEmail, cc: settings.manager.email,
            subject: `Facture ${invoiceNumber} - ${settings.manager.name || 'Votre Cabinet'}`,
            html: documentHtmlForEmailBody,
            attachments: [{ filename: `Facture-${invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
        };
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: `Facture ${invoiceNumber} envoyée à ${clientEmail}.` });
    } catch (error) {
        console.error(`Erreur envoi email facture ${invoiceNumber}:`, error);
        if (error.message.includes("Puppeteer")) return res.status(500).json({ message: `Erreur PDF: ${error.message}` });
        if (error.code === 'EAUTH' || (error.responseCode === 535 || error.responseCode === 534)) return res.status(500).json({ message: "Échec authentification SMTP." });
        res.status(500).json({ message: `Échec envoi email: ${error.message}` });
    }
});

app.post('/api/devis/:devisNumber/send-by-email', async (req, res) => {
    const { devisNumber } = req.params;
    const { clientEmail } = req.body; 
    if (!clientEmail) return res.status(400).json({ message: "Email client requis." });
    if (!puppeteer) return res.status(500).json({ message: "Erreur serveur : module PDF manquant." });
    
    const settings = await readSettingsJson();
     if (!settings.manager || !settings.manager.email || settings.manager.gmailAppPasswordStatus !== 'success' || !gmailUserForTransport || !temporaryGmailAppPassword) {
        return res.status(500).json({ message: "Configuration SMTP (Gmail) incomplète ou test non réussi sur le serveur." });
    }

    try {
        const devisJsonPath = path.join(devisDir, `${devisNumber}.json`);
        let devisData;
        try { devisData = JSON.parse(await fs.readFile(devisJsonPath, 'utf8'));} 
        catch (fileError) { return res.status(404).json({ message: `Devis ${devisNumber}.json non trouvé.` });}
        
        const documentHtmlForEmailBody = generateDocumentHtmlForEmail(devisData);
        const pdfBuffer = await generatePdfFromHtml(documentHtmlForEmailBody);
        const transporter = nodemailer.createTransport({
            service: 'gmail', auth: { user: gmailUserForTransport, pass: temporaryGmailAppPassword, },
        });
        const mailOptions = {
            from: `"${settings.manager.name || 'Votre Cabinet'}" <${process.env.GMAIL_USER}>`,
            to: clientEmail, cc: settings.manager.email,
            subject: `Devis ${devisNumber} - ${settings.manager.name || 'Votre Cabinet'}`,
            html: documentHtmlForEmailBody,
            attachments: [{ filename: `Devis-${devisNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
        };
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: `Devis ${devisNumber} envoyé à ${clientEmail}.` });
    } catch (error) {
        console.error(`Erreur envoi email devis ${devisNumber}:`, error);
        if (error.message.includes("Puppeteer")) return res.status(500).json({ message: `Erreur PDF: ${error.message}` });
        if (error.code === 'EAUTH' || (error.responseCode === 535 || error.responseCode === 534)) return res.status(500).json({ message: "Échec authentification SMTP." });
        res.status(500).json({ message: `Échec envoi email: ${error.message}` });
    }
});


// --- Points d'API pour la Configuration ---
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await readSettingsJson();
        // Ne jamais renvoyer GMAIL_APP_PASSWORD au client, même s'il était stocké temporairement
        if (settings.manager) delete settings.manager.gmailAppPassword;
        res.json(settings);
    } catch (error) {
        console.error('Erreur API /api/settings :', error.message);
        res.status(500).json({ message: 'Erreur serveur (paramètres)' });
    }
});

// Point d'API pour tester la connexion Gmail
app.post('/api/settings/test-gmail', async (req, res) => {
    const { email, appPassword } = req.body;
    if (!email || !appPassword) {
        return res.status(400).json({ success: false, message: "Email et mot de passe d'application requis." });
    }
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: email, pass: appPassword },
        });
        await transporter.verify();
        // Si la vérification réussit, stocker temporairement pour l'envoi d'email
        temporaryGmailAppPassword = appPassword;
        gmailUserForTransport = email;
        res.json({ success: true, message: "Connexion Gmail réussie." });
    } catch (error) {
        console.error("Erreur test Gmail:", error);
        temporaryGmailAppPassword = null; // Réinitialiser en cas d'échec
        gmailUserForTransport = null;
        res.status(500).json({ success: false, message: `Échec de la connexion Gmail: ${error.message}` });
    }
});


app.post('/api/settings', async (req, res) => {
    try {
        const newSettings = req.body;
        let currentSettings = await readSettingsJson(); // Lire les paramètres actuels pour fusionner

        // Gérer GMAIL_APP_PASSWORD:
        // Si un nouveau mot de passe est fourni dans la requête (newSettings.manager.gmailAppPassword),
        // cela signifie qu'un test a été fait (ou tenté) côté client.
        // On utilise temporaryGmailAppPassword qui a été mis à jour par /test-gmail.
        if (newSettings.manager && newSettings.manager.gmailAppPassword) {
            // Le mot de passe a été testé, temporaryGmailAppPassword devrait être à jour.
            // On ne stocke pas le mot de passe dans settings.json.
            // On met à jour le statut du mot de passe.
            if (newSettings.manager.email === gmailUserForTransport && temporaryGmailAppPassword) {
                 currentSettings.manager.gmailAppPasswordStatus = 'success';
                 currentSettings.manager.email = newSettings.manager.email; // Mettre à jour l'email GMAIL_USER
            } else {
                // Si l'email a changé ou que temporaryGmailAppPassword n'est pas là, le test a échoué ou n'a pas été fait correctement.
                currentSettings.manager.gmailAppPasswordStatus = 'failed_or_not_set';
            }
        } else if (newSettings.manager && !newSettings.manager.gmailAppPassword) {
            // Si aucun mot de passe n'est fourni dans la requête, on conserve le statut précédent
            // sauf si l'email change, auquel cas le statut doit être réévalué (devient not_set)
            if (newSettings.manager.email !== currentSettings.manager.email) {
                currentSettings.manager.gmailAppPasswordStatus = 'not_set';
                temporaryGmailAppPassword = null; // L'ancien mdp n'est plus valide pour le nouvel email
                gmailUserForTransport = null;
            }
             // Si l'email ne change pas et pas de nouveau mdp, on garde le statut actuel
        }


        // Fusionner les nouveaux paramètres avec les anciens, en s'assurant que la structure est conservée
        const updatedSettings = {
            ...currentSettings, // Base avec la structure complète et les valeurs existantes
            ...newSettings,     // Écraser avec les nouvelles valeurs fournies
            manager: {
                ...currentSettings.manager,
                ...(newSettings.manager || {}),
                gmailAppPasswordStatus: currentSettings.manager.gmailAppPasswordStatus // Assurer que le statut est bien celui calculé ci-dessus
            },
            legal: { ...currentSettings.legal, ...(newSettings.legal || {}) },
            googleCalendar: { ...currentSettings.googleCalendar, ...(newSettings.googleCalendar || {}) }
        };
        
        // Retirer explicitement gmailAppPassword avant d'écrire dans le fichier
        if (updatedSettings.manager) delete updatedSettings.manager.gmailAppPassword;

        await writeSettingsJson(updatedSettings);

        // Renvoyer les paramètres mis à jour (sans le mot de passe)
        res.status(200).json(updatedSettings); 
    } catch (error) {
        console.error('Erreur sauvegarde paramètres :', error.message);
        res.status(500).json({ message: 'Erreur serveur (sauvegarde paramètres)' });
    }
});

// Démarrer le serveur
async function startServer() {
    // Initialiser la configuration du calendrier Google
    try {
        const settings = await readSettingsJson();
        if (settings.googleCalendar && settings.googleCalendar.serviceAccountKeyPath) {
            calendarHelper.init(settings.googleCalendar.serviceAccountKeyPath);
        } else {
            // Essayer d'initialiser avec le chemin par défaut ou variable d'environnement si défini dans calendarHelper
            calendarHelper.init(); 
        }
    } catch (e) {
        console.warn("Avertissement: Impossible de lire settings.json pour la configuration initiale du calendrier Google.", e.message);
        calendarHelper.init(); // Tenter init sans chemin spécifique
    }


    app.listen(PORT, () => {
        console.log(`Serveur Node.js en cours d'exécution sur http://localhost:${PORT}`);
        console.log(`Les fichiers de données sont dans: ${dataDir}`);
        console.log(`Les factures JSON seront stockées dans: ${factsDir}`);
        console.log(`Les devis JSON seront stockés dans: ${devisDir}`);
        console.log(`Assurez-vous que votre page invoice.html est accessible via ${process.env.INVOICE_PREVIEW_BASE_URL || 'http://fact.lpz.ovh'}/invoice.html`);
        
        const currentSettingsForLog = fssync.existsSync(settingsFilePath) ? JSON.parse(fssync.readFileSync(settingsFilePath, 'utf8')) : defaultSettings;
        if (!currentSettingsForLog.manager.email || currentSettingsForLog.manager.gmailAppPasswordStatus !== 'success') {
            console.warn("ATTENTION: GMAIL_USER (email du manager) et/ou GMAIL_APP_PASSWORD (via test de connexion) ne sont pas configurés correctement. L'envoi d'e-mails pourrait ne pas fonctionner.");
        }
         if (!puppeteer) {
            console.warn("ATTENTION: Puppeteer n'a pas pu être chargé. La génération de PDF est désactivée.");
        }
        if (!calendarHelper.isCalendarConfigured()) {
            console.warn("ATTENTION: Google Calendar n'est pas configuré (clé de compte de service manquante ou invalide). L'intégration calendrier est désactivée.");
            console.warn("  Pour l'activer, placez votre fichier de clé de compte de service (credentials.json) à la racine du projet ou configurez son chemin via la variable d'environnement GOOGLE_APPLICATION_CREDENTIALS ou dans settings.json (googleCalendar.serviceAccountKeyPath).");

        } else {
            console.log("Google Calendar est configuré.");
        }
    });
}

startServer().catch(error => {
    console.error("Impossible de démarrer le serveur:", error);
});


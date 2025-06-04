// server.js
const express = require('express');
const fs = require('fs').promises;
const fssync = require('fs'); 
const path =require('path');
const cors = require('cors');
const nodemailer = require('nodemailer'); // Décommenté pour l'utilisation

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

fs.mkdir(dataDir, { recursive: true }).catch(err => console.error("Erreur création dataDir:", err.message));
fs.mkdir(factsDir, { recursive: true }).catch(err => console.error("Erreur création factsDir:", err.message));

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
            if (value === '' || value === 'null' || value === undefined) {
                value = null;
            }
            if (header === 'montant' || header === 'montant_facture') {
                entry[header] = value !== null ? parseFloat(value) : 0;
            } else if (header === 'tva') {
                 entry[header] = value !== null ? parseFloat(value) : 0;
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
            if (value === null || value === undefined) {
                return '';
            }
            if (typeof value === 'number' && (header === 'montant' || header === 'montant_facture' || header === 'tva')) {
                return value.toFixed(2);
            }
            return String(value).replace(/\t|\n|\r/g, ' ');
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
const tarifsHeaders = ['id', 'libelle', 'montant'];
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
const seancesHeaders = ['id_seance', 'id_client', 'date_heure_seance', 'id_tarif', 'montant_facture', 'statut_seance', 'mode_paiement', 'date_paiement', 'invoice_number'];
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
const defaultSettings = {
  manager: {
    name: "",
    title: "",
    description: "",
    address: "",
    city: "",
    phone: "",
    email: ""
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
  }
};

async function readSettingsJson() {
    try {
        await fs.access(dataDir);
        const data = await fs.readFile(settingsFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Fichier ${settingsFilePath} non trouvé. Tentative de création avec les valeurs par défaut...`);
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

async function writeSettingsJson(settings) {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');
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

// Fonction pour calculer la date d'échéance (Date de la facture + 30 jours)
function calculateDueDate(invoiceDateStr) {
    if (!invoiceDateStr) return '';
    try {
        const date = new Date(invoiceDateStr);
        if (isNaN(date.getTime())) return '';
        date.setDate(date.getDate() + 30);
        return formatDateDDMMYYYY(date);
    } catch (e) {
        return '';
    }
}

// Fonction pour générer le prochain numéro de facture
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
        console.warn("Attention: Impossible de lire les numéros de facture existants pour le comptage:", err.message);
    }
    return `${prefix}${(maxCounter + 1).toString().padStart(4, '0')}`;
}


// --- Points d'API pour les Clients ---
app.get('/api/clients', async (req, res) => {
    try {
        const clients = await readClientsTsv();
        res.json(clients);
    } catch (error) {
        console.error('Erreur inattendue dans /api/clients :', error.message);
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
        if (index > -1) {
            clients[index] = { ...clients[index], ...newClient };
        } else {
            clients.push(newClient);
        }
        await writeClientsTsv(clients);
        res.status(200).json(newClient);
    } catch (error) {
        console.error('Erreur lors de la sauvegarde du client :', error.message);
        res.status(500).json({ message: 'Erreur lors de la sauvegarde du client' });
    }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let clients = await readClientsTsv();
        let seances = await readSeancesTsv(); 
        const clientHasSeances = seances.some(s => s.id_client === id);
        if (clientHasSeances) {
            return res.status(400).json({ message: "Ce client a des séances enregistrées. Veuillez d'abord supprimer ou réassigner ses séances." });
        }
        const initialLength = clients.length;
        clients = clients.filter(c => c.id !== id);
        if (clients.length === initialLength) {
            return res.status(404).json({ message: 'Client non trouvé' });
        }
        await writeClientsTsv(clients);
        res.status(200).json({ message: 'Client supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression du client :', error.message);
        res.status(500).json({ message: 'Erreur lors de la suppression du client' });
    }
});


// --- Points d'API pour les Tarifs ---
app.get('/api/tarifs', async (req, res) => {
    try {
        const tarifs = await readTarifsTsv();
        res.json(tarifs);
    } catch (error) {
        console.error('Erreur inattendue dans /api/tarifs :', error.message);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des tarifs' });
    }
});

app.post('/api/tarifs', async (req, res) => {
    try {
        const newTarif = req.body;
        let tarifs = await readTarifsTsv();
        if (!newTarif.id) {
            newTarif.id = await generateTarifId(newTarif.libelle, newTarif.montant, tarifs);
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
        console.error('Erreur lors de la sauvegarde du tarif :', error.message);
        res.status(500).json({ message: 'Erreur lors de la sauvegarde du tarif' });
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
            return res.status(400).json({ message: "Ce tarif est utilisé comme tarif par défaut pour un client ou dans des séances. Veuillez d'abord le modifier." });
        }
        const initialLength = tarifs.length;
        tarifs = tarifs.filter(t => t.id !== id);
        if (tarifs.length === initialLength) {
            return res.status(404).json({ message: 'Tarif non trouvé' });
        }
        await writeTarifsTsv(tarifs);
        res.status(200).json({ message: 'Tarif supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression du tarif :', error.message);
        res.status(500).json({ message: 'Erreur lors de la suppression du tarif' });
    }
});


// --- Points d'API pour les Séances ---
app.get('/api/seances', async (req, res) => {
    try {
        let seances = await readSeancesTsv();
        let existingInvoiceFiles = [];
        try {
            const files = await fs.readdir(factsDir);
            existingInvoiceFiles = files.filter(file => file.endsWith('.json')).map(file => file.slice(0, -5));
        } catch (err) {
            console.warn(`Impossible de lire le répertoire des factures ${factsDir}: ${err.message}`);
        }

        const seancesWithInvoiceNumberInTsv = seances.filter(s => s.invoice_number && s.invoice_number.trim() !== '').length;
        
        let tsvModified = false;
        if (seancesWithInvoiceNumberInTsv !== existingInvoiceFiles.length) {
            console.log(`Décalage détecté: ${seancesWithInvoiceNumberInTsv} factures dans TSV vs ${existingInvoiceFiles.length} fichiers JSON.`);
            
            for (let i = 0; i < seances.length; i++) {
                const seance = seances[i];
                if (seance.invoice_number && seance.invoice_number.trim() !== '') {
                    const invoiceFilePath = path.join(factsDir, `${seance.invoice_number}.json`);
                    try {
                        await fs.access(invoiceFilePath); 
                    } catch (fileError) {
                        console.log(`Le fichier facture ${seance.invoice_number}.json pour la séance ${seance.id_seance} est manquant. Suppression du numéro de facture dans le TSV.`);
                        seances[i].invoice_number = null; 
                        tsvModified = true;
                    }
                }
            }

            if (tsvModified) {
                console.log("Mise à jour de seances.tsv suite à la suppression de numéros de facture orphelins.");
                await writeSeancesTsv(seances);
            }
        }

        res.json(seances);
    } catch (error) {
        console.error('Erreur inattendue dans /api/seances :', error.message);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des séances' });
    }
});

app.get('/api/invoice/:invoiceNumber/status', async (req, res) => {
    const { invoiceNumber } = req.params;
    try {
        const allSeances = await readSeancesTsv();
        const seance = allSeances.find(s => s.invoice_number === invoiceNumber);
        if (!seance) {
            return res.status(404).json({ message: `Séance avec le numéro de facture ${invoiceNumber} non trouvée.` });
        }
        res.json({ statut_seance: seance.statut_seance, seanceId: seance.id_seance });
    } catch (error) {
        console.error(`Erreur lors de la récupération du statut pour la facture ${invoiceNumber}:`, error.message);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération du statut de la séance.' });
    }
});


app.post('/api/seances', async (req, res) => {
    try {
        const newSeance = req.body;
        let seances = await readSeancesTsv();
        const index = seances.findIndex(s => s.id_seance === newSeance.id_seance);
        if (index > -1) {
            newSeance.invoice_number = newSeance.invoice_number || seances[index].invoice_number;
            seances[index] = newSeance;
        } else {
            seances.push(newSeance);
        }
        await writeSeancesTsv(seances);
        res.status(200).json(newSeance);
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la séance :', error.message);
        res.status(500).json({ message: 'Erreur lors de la sauvegarde de la séance' });
    }
});

app.delete('/api/seances/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let seances = await readSeancesTsv();
        const seanceToDelete = seances.find(s => s.id_seance === id);

        if (!seanceToDelete) {
            return res.status(404).json({ message: 'Séance non trouvée' });
        }
        if (seanceToDelete.invoice_number) {
             return res.status(400).json({ message: "Cette séance a été facturée et ne peut pas être supprimée directement." });
        }
        
        seances = seances.filter(s => s.id_seance !== id);
        await writeSeancesTsv(seances);
        res.status(200).json({ message: 'Séance supprimée avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression de la séance :', error.message);
        res.status(500).json({ message: 'Erreur lors de la suppression de la séance' });
    }
});

// --- Point d'API pour générer une facture pour une séance ---
app.post('/api/seances/:seanceId/generate-invoice', async (req, res) => {
    const { seanceId } = req.params;
    try {
        let allSeances = await readSeancesTsv();
        const seanceIndex = allSeances.findIndex(s => s.id_seance === seanceId);

        if (seanceIndex === -1) {
            return res.status(404).json({ message: "Séance non trouvée." });
        }
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
        if (!client) {
            return res.status(404).json({ message: "Client associé à la séance non trouvé." });
        }

        const tarifsData = await readTarifsTsv();
        const tarif = tarifsData.find(t => t.id === seance.id_tarif);
        if (!tarif) {
            return res.status(404).json({ message: "Tarif associé à la séance non trouvé."});
        }

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
            dueDate: calculateDueDate(invoiceDate),
            tva: settings.tva || 0,
            manager: {
                name: settings.manager.name || '',
                title: settings.manager.title || '',
                description: settings.manager.description || '',
                address: settings.manager.address || '',
                city: settings.manager.city || '',
                phone: settings.manager.phone || '',
                email: settings.manager.email || ''
            },
            legal: settings.legal || {}
        };

        await fs.mkdir(factsDir, { recursive: true }); 
        const invoiceJsonPath = path.join(factsDir, `${invoiceNumber}.json`);
        await fs.writeFile(invoiceJsonPath, JSON.stringify(invoiceData, null, 2), 'utf8');

        allSeances[seanceIndex].invoice_number = invoiceNumber;
        if (allSeances[seanceIndex].statut_seance !== 'PAYEE' && allSeances[seanceIndex].statut_seance !== 'ANNULEE') {
            allSeances[seanceIndex].statut_seance = 'APAYER';
        }
        await writeSeancesTsv(allSeances);
        
        res.status(200).json({ 
            message: 'Facture générée avec succès', 
            invoiceNumber: invoiceNumber,
            newSeanceStatus: allSeances[seanceIndex].statut_seance 
        });

    } catch (error) {
        console.error('Erreur lors de la génération de la facture :', error.message);
        res.status(500).json({ message: 'Erreur serveur lors de la génération de la facture.' });
    }
});

// --- ENDPOINT POUR L'ENVOI D'EMAIL (AVEC GMAIL ET VARIABLES D'ENVIRONNEMENT) ---
function generateInvoiceHtmlForEmail(data) {
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
                    <td>${item.Date || formatDateForHtml(data.invoiceDate)}</td>
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
        <title>Facture ${data.invoiceNumber}</title>
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
                <strong>Facture N° : ${data.invoiceNumber || 'FAC-YYYY-XXXX'}</strong><br>
                Date d'émission : ${data.invoiceDate || formatDateForHtml(new Date().toISOString())}<br>
                Date d'échéance : ${data.dueDate || formatDateForHtml(new Date(new Date().setDate(new Date().getDate() + 30)).toISOString())}
            </div>
        </div>

        <div class="invoice-title">FACTURE</div>

        <div class="client-info">
            <strong>Facturé à :</strong><br>
            ${client.name || 'Nom Client'}<br>
            ${client.address || 'Adresse Client'}<br>
            ${client.city || 'Ville Client'}
        </div>

        <table>
            <thead>
                <tr><th>Date</th><th>Description</th><th class="right">Qté</th><th class="right">P.U. (€)</th><th class="right">Total HT (€)</th></tr>
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
            <h3 class="right" style="color: #0056b3;">MONTANT À RÉGLER : ${formatCurrency(total_ttc)}</h3>
        </div>

        <div class="legal-mentions">
            <h4>Mentions Légales</h4>
            <p>SIRET : ${legal.siret || 'N/A'}<br>
            Code APE : ${legal.ape || 'N/A'}<br>
            N° ADELI : ${legal.adeli || 'N/A'}</p>
            <p>IBAN : ${legal.iban || 'N/A'}<br>
            BIC : ${legal.bic || 'N/A'}</p>
            <p>TVA : ${legal.tvaMention || (tvaPercentage === 0 ? "TVA non applicable - Art. 293B du CGI" : `TVA au taux de ${tvaPercentage.toFixed(2).replace('.', ',')}%`)}</p>
            <p>Conditions de règlement : ${legal.paymentTerms || 'Paiement à réception.'}</p>
            <p>Assurance RCP : ${legal.insurance || 'N/A'}</p>
        </div>
    </body>
    </html>
    `;
}

app.post('/api/invoice/:invoiceNumber/send-by-email', async (req, res) => {
    const { invoiceNumber } = req.params;
    const { clientEmail } = req.body; 

    if (!clientEmail) {
        return res.status(400).json({ message: "L'adresse e-mail du client est requise." });
    }
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.error("Variables d'environnement GMAIL_USER ou GMAIL_APP_PASSWORD non définies.");
        return res.status(500).json({ message: "Configuration SMTP du serveur incomplète (variables d'environnement manquantes)." });
    }

    try {
        const invoiceJsonPath = path.join(factsDir, `${invoiceNumber}.json`);
        let invoiceData;
        try {
            invoiceData = JSON.parse(await fs.readFile(invoiceJsonPath, 'utf8'));
        } catch (fileError) {
            console.error(`Erreur lecture fichier facture ${invoiceNumber}.json:`, fileError);
            return res.status(404).json({ message: `Fichier de données de la facture ${invoiceNumber}.json non trouvé.` });
        }
        
        const settings = await readSettingsJson();
        if (!settings.manager || !settings.manager.email) {
            return res.status(400).json({ message: "L'e-mail de l'expéditeur (manager) n'est pas configuré dans les paramètres." });
        }

        const invoiceHtmlContent = generateInvoiceHtmlForEmail(invoiceData);

        // Configuration du transporteur Nodemailer pour Gmail
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // true for 465, false for other ports (STARTTLS)
            auth: {
                user: process.env.GMAIL_USER, // Votre adresse e-mail Gmail
                pass: process.env.GMAIL_APP_PASSWORD, // Votre mot de passe d'application Gmail
            },
        });

        const mailOptions = {
            from: `"${settings.manager.name || 'Votre Cabinet'}" <${process.env.GMAIL_USER}>`, // L'expéditeur doit être votre adresse Gmail
            to: clientEmail,
            cc: settings.manager.email,
            subject: `Facture ${invoiceNumber} - ${settings.manager.name || 'Votre Cabinet'}`,
            text: `Bonjour,\n\nVeuillez trouver ci-joint votre facture ${invoiceNumber}.\n\nCordialement,\n${settings.manager.name || ''}\n${settings.manager.title || ''}`,
            html: `<p>Bonjour,</p><p>Veuillez trouver ci-joint votre facture ${invoiceNumber}.</p><p>Cordialement,<br/>${settings.manager.name || ''}<br/>${settings.manager.title || ''}</p>`,
            attachments: [
                {
                    filename: `Facture-${invoiceNumber}.html`,
                    content: invoiceHtmlContent,
                    contentType: 'text/html'
                }
            ]
        };
        
        try {
            await transporter.sendMail(mailOptions);
            console.log(`Email pour la facture ${invoiceNumber} envoyé à ${clientEmail}.`);
            res.status(200).json({ message: `Facture ${invoiceNumber} envoyée à ${clientEmail}.` });
        } catch (emailError) {
            console.error(`Erreur Nodemailer lors de l'envoi de l'email pour ${invoiceNumber}:`, emailError);
            // Vérifier si l'erreur est due à une authentification
            if (emailError.code === 'EAUTH' || (emailError.responseCode === 535 || emailError.responseCode === 534)) {
                 return res.status(500).json({ message: "Échec de l'authentification SMTP. Vérifiez vos identifiants Gmail et la configuration du mot de passe d'application." });
            }
            return res.status(500).json({ message: `Échec de l'envoi de l'email: ${emailError.message}` });
        }

    } catch (error) {
        console.error(`Erreur générale lors de la préparation de l'email pour la facture ${invoiceNumber}:`, error);
        res.status(500).json({ message: `Erreur serveur lors de la préparation de l'email: ${error.message}` });
    }
});


// --- Points d'API pour la Configuration ---
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await readSettingsJson();
        res.json(settings);
    } catch (error) {
        console.error('Erreur inattendue dans /api/settings :', error.message);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des paramètres' });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const newSettings = req.body;
        await writeSettingsJson(newSettings);
        res.status(200).json(newSettings); 
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des paramètres :', error.message);
        res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde des paramètres' });
    }
});

// Démarrer le serveur
async function startServer() {
    app.listen(PORT, () => {
        console.log(`Serveur Node.js en cours d'exécution sur http://localhost:${PORT}`);
        console.log(`Les fichiers de données sont dans: ${dataDir}`);
        console.log(`Les factures JSON seront stockées dans: ${factsDir}`);
        console.log(`Assurez-vous que votre page invoice.html est accessible via ${process.env.INVOICE_PREVIEW_BASE_URL || 'http://fact.lpz.ovh'}/invoice.html`);
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            console.warn("ATTENTION: Les variables d'environnement GMAIL_USER et/ou GMAIL_APP_PASSWORD ne sont pas définies. L'envoi d'e-mails ne fonctionnera pas.");
        }
    });
}

startServer().catch(error => {
    console.error("Impossible de démarrer le serveur:", error);
});
// src/controllers/seanceController.js
const Seance = require('../models/Seance');
const Client = require('../models/Client');
const Tarif = require('../models/Tarif');
const { readSettingsJson, getDataPath } = require('../helpers/fileHelper');
const calendarHelper = require('../helpers/calendarHelper');
const fs = require('fs').promises;
const path = require('path');
const { PATHS } = require('../config/constants');

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

async function getNextInvoiceNumber(dataPath) { // in seances.tsv
    const currentYear = new Date().getFullYear();
    const prefix = `FAC-${currentYear}-`;
    let maxCounter = 0;
    
    try {
        const allSeances = await Seance.findAll(dataPath); // liste seances.tsv
        allSeances.forEach(seance => {
            if (seance.invoice_number && seance.invoice_number.startsWith(prefix)) {
            console.log(seance);
                const numPart = parseInt(seance.invoice_number.substring(prefix.length), 10);
                if (!isNaN(numPart) && numPart > maxCounter) maxCounter = numPart;
            }
        });
    } catch (err) { 
        console.warn("Avertissement: Impossible de lire les numéros de facture existants:", err.message); 
    }
    
    return `${prefix}${(maxCounter + 1).toString().padStart(4, '0')}`;
}

async function getNextDevisNumber(dataPath) {
    const currentYear = new Date().getFullYear();
    const prefix = `DEV-${currentYear}-`;
    let maxCounter = 0;
    const devisDir = path.join(dataPath, PATHS.DEVIS_DIR);
    
    try {
        const files = await fs.readdir(devisDir);
        files.forEach(file => {
            if (file.startsWith(prefix) && file.endsWith('.json')) {
                const numPart = parseInt(file.substring(prefix.length, file.length - 5), 10);
                if (!isNaN(numPart) && numPart > maxCounter) maxCounter = numPart;
            }
        });
    } catch (err) { 
        if (err.code !== 'ENOENT') {
            console.warn("Avertissement: Impossible de lire les numéros de devis existants:", err.message);
        }
    }
    
    return `${prefix}${(maxCounter + 1).toString().padStart(4, '0')}`;
}

async function getAllSeances(req, res) { 
    try {
        const { userEmail } = req;
        const dataPath = getDataPath(userEmail);
        let seances = await Seance.findAll(dataPath);
        let tsvModified = false;

        const factsDir = path.join(dataPath, PATHS.FACTS_DIR);
        let existingInvoiceFiles = [];
        try {
            const files = await fs.readdir(factsDir);
            existingInvoiceFiles = files.filter(file => file.endsWith('.json')).map(file => file.slice(0, -5));
        } catch (err) {
            if (err.code !== 'ENOENT') console.warn(`Impossible de lire le répertoire des factures ${factsDir}: ${err.message}`);
        }
        
        seances.forEach((seance, i) => {
            if (seance.invoice_number && seance.invoice_number.trim() !== '' && !existingInvoiceFiles.includes(seance.invoice_number)) {
                seances[i].invoice_number = null;
                tsvModified = true;
            }
        });

        const devisDir = path.join(dataPath, PATHS.DEVIS_DIR);
        let existingDevisFiles = [];
        try {
            const files = await fs.readdir(devisDir);
            existingDevisFiles = files.filter(file => file.endsWith('.json')).map(file => file.slice(0, -5));
        } catch (err) {
            if (err.code !== 'ENOENT') console.warn(`Impossible de lire le répertoire des devis ${devisDir}: ${err.message}`);
        }

        seances.forEach((seance, i) => {
            if (seance.devis_number && seance.devis_number.trim() !== '' && !existingDevisFiles.includes(seance.devis_number)) {
                seances[i].devis_number = null;
                tsvModified = true;
            }
        });

        if (tsvModified) {
            await Seance.saveAll(seances, dataPath);
        }
        
        res.json(seances);
    } catch (error) { 
        console.error('Erreur API GET /api/seances :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des séances' }); 
    }
}

async function getInvoiceStatus(req, res) { 
    const { invoiceNumber } = req.params;
    const { userEmail } = req;
    console.log('userEmail', userEmail);
    const dataPath = getDataPath(userEmail);
    try {
        // MODIFIÉ : Recherche dans les deux types de documents
        let seance = await Seance.findByInvoiceNumber(invoiceNumber, dataPath);
        if (!seance) {
            seance = await Seance.findByDevisNumber(invoiceNumber, dataPath);
        }

        if (!seance) {
            return res.status(404).json({ message: `Document ${invoiceNumber} non lié à une séance.` });
        }

        if (invoiceNumber.startsWith('DEV-')) {
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
}


async function createOrUpdateSeance(req, res) {
    const { userEmail, oauth2Client, isDemo } = req;
    const dataPath = getDataPath(userEmail);
    try {
        const seanceData = req.body;
        const client = await Client.findById(seanceData.id_client, dataPath);
        const tarif = await Tarif.findById(seanceData.id_tarif, dataPath);
        let seance = await Seance.findById(seanceData.id_seance, dataPath);
        const isNewSeance = !seance;

        if (isNewSeance) {
            seance = new Seance(seanceData);
        } else {
            Object.assign(seance, seanceData);
        }

        if (!isDemo && oauth2Client && calendarHelper.isCalendarConfigured()) {
            try {
                calendarHelper.setAuth(oauth2Client);
                const seanceDateTime = new Date(seance.date_heure_seance);
                
                let dureeMinutes = 60;
                if (seanceData.duree_seance) {
                    dureeMinutes = parseInt(seanceData.duree_seance, 10);
                } else if (tarif && tarif.duree) {
                    dureeMinutes = parseInt(tarif.duree, 10);
                }
                if (isNaN(dureeMinutes) || dureeMinutes <= 0) {
                    dureeMinutes = 60;
                }

                const eventSummary = `Séance ${client ? client.prenom + ' ' + client.nom : 'Client'} (${tarif ? tarif.libelle : 'Tarif'})`;
                const eventDescription = `Séance avec ${client ? client.prenom + ' ' + client.nom : 'un client'}.\nTarif: ${tarif ? tarif.libelle : 'N/A'}\nStatut: ${seance.statut_seance}`;
                const settings = await readSettingsJson(userEmail);
                const calendarIdToUse = settings.googleCalendar.calendarId || 'primary';

                if (isNewSeance && seance.statut_seance !== 'ANNULEE') {
                    const eventId = await calendarHelper.createEvent(calendarIdToUse, eventSummary, eventDescription, seanceDateTime, dureeMinutes, userEmail);
                    seance.googleCalendarEventId = eventId;
                } else if (!isNewSeance) {
                    const existingEventId = seance.googleCalendarEventId;
                    if (seance.statut_seance === 'ANNULEE' && existingEventId) {
                        await calendarHelper.deleteEvent(calendarIdToUse, existingEventId);
                        seance.googleCalendarEventId = null;
                    } else if (seance.statut_seance !== 'ANNULEE' && !existingEventId) {
                        const eventId = await calendarHelper.createEvent(calendarIdToUse, eventSummary, eventDescription, seanceDateTime, dureeMinutes, userEmail);
                        seance.googleCalendarEventId = eventId;
                    } else if (seance.statut_seance !== 'ANNULEE' && existingEventId) {
                        await calendarHelper.updateEvent(calendarIdToUse, existingEventId, eventSummary, eventDescription, seanceDateTime, dureeMinutes, userEmail);
                    }
                }
            } catch (calError) {
                console.error("Erreur interaction Google Calendar lors de la sauvegarde de séance:", calError.message);
            }
        }
        await Seance.create(seance, dataPath);
        res.status(200).json({ message: 'Séance enregistrée avec succès.', updatedSeance: seance });
    } catch (error) {
        console.error('Erreur API POST /api/seances :', error.message, error.stack);
        res.status(500).json({ message: `Erreur lors de la sauvegarde de la séance: ${error.message}` });
    }
}

async function deleteSeance(req, res) {
    const { userEmail, oauth2Client, isDemo } = req;
    const dataPath = getDataPath(userEmail);
    try {
        const { id } = req.params;
        const seance = await Seance.findById(id, dataPath);
        if (!seance) return res.status(404).json({ message: 'Séance non trouvée' });
        if (seance.invoice_number) return res.status(400).json({ message: "Cette séance a été facturée et ne peut pas être supprimée directement." });

        if (seance.googleCalendarEventId && oauth2Client && calendarHelper.isCalendarConfigured() && !isDemo) {
            try {
                calendarHelper.setAuth(oauth2Client);
                const settings = await readSettingsJson(userEmail);
                const calendarIdToUse = settings.googleCalendar.calendarId || 'primary';
                await calendarHelper.deleteEvent(calendarIdToUse, seance.googleCalendarEventId);
                console.log(`Événement calendrier ${seance.googleCalendarEventId} supprimé.`);
            } catch (calError) {
                console.warn(`Avertissement: Erreur suppression événement calendrier ${seance.googleCalendarEventId}: ${calError.message}`);
            }
        }
        if (seance.devis_number) {
            const devisJsonPath = path.join(dataPath, PATHS.DEVIS_DIR, `${seance.devis_number}.json`);
            try {
                await fs.unlink(devisJsonPath);
                console.log(`Fichier devis ${seance.devis_number}.json supprimé.`);
            } catch (unlinkError) {
                if (unlinkError.code !== 'ENOENT') console.warn(`Avertissement: Impossible de supprimer le fichier devis ${seance.devis_number}.json : ${unlinkError.message}`);
            }
        }
        await Seance.delete(id, dataPath);
        res.status(200).json({ message: 'Séance supprimée avec succès' });
    } catch (error) {
        console.error('Erreur API DELETE /api/seances/:id :', error.message);
        res.status(500).json({ message: 'Erreur lors de la suppression de la séance' });
    }
}

async function generateInvoice(req, res) {
    const { seanceId } = req.params;
    const { userEmail } = req;
    console.log('userEmail', userEmail);
    const dataPath = getDataPath(userEmail);
    try {
        const seance = await Seance.findById(seanceId, dataPath);
        if (!seance) {
            return res.status(404).json({ message: "Séance non trouvée." });
        }

        if (seance.invoice_number) { 
            const invoiceJsonPathCheck = path.join(dataPath, PATHS.FACTS_DIR, `${seance.invoice_number}.json`);
            try {
                await fs.access(invoiceJsonPathCheck);
                return res.status(400).json({ 
                    message: `Cette séance a déjà été facturée avec le numéro ${seance.invoice_number}.` 
                });
            } catch (e) {
                console.warn(`Le numéro de facture ${seance.invoice_number} existe pour la séance ${seanceId} mais le fichier JSON est manquant. Une nouvelle facture sera générée.`);
            }
        }

        const client = await Client.findById(seance.id_client, dataPath);
        if (!client) {
            return res.status(404).json({ message: "Client associé à la séance non trouvé." });
        }

        const tarif = await Tarif.findById(seance.id_tarif, dataPath);
        if (!tarif) {
            return res.status(404).json({ message: "Tarif associé à la séance non trouvé."});
        }

        const settings = await readSettingsJson(userEmail);
        const invoiceNumber = await getNextInvoiceNumber(dataPath);
        const invoiceDate = new Date().toISOString(); 
        
        const invoiceData = {
            seanceId: seance.id_seance, 
            invoiceNumber: invoiceNumber,
            invoiceDate: formatDateDDMMYYYY(invoiceDate),
            originalInvoiceDate: invoiceDate,
            dueDate: calculateValidityOrDueDate(invoiceDate, 30),
            client: {
                name: `${client.prenom} ${client.nom}`,
                address: client.adresse || '',
                city: client.ville || '',
                email: client.email || '',
                phone: client.telephone || ''
            },
            service: [{
                Date: formatDateDDMMYYYY(seance.date_heure_seance.split('T')[0]),
                description: tarif.libelle + (tarif.duree ? ` (${tarif.duree} min)` : ''),
                quantity: 1,
                unitPrice: parseFloat(tarif.montant)
            }],
            payment:{
                statut: seance.statut_seance,
                mode: seance.mode_paiement,
                date: seance.date_paiement,
            },
            subTotal: parseFloat(tarif.montant),
            tva: parseFloat(settings.tva) || 0,
            manager: settings.manager || {},
            legal: settings.legal || {},
        };        
        
        await fs.mkdir(path.join(dataPath, PATHS.FACTS_DIR), { recursive: true }); 
        const invoiceJsonPath = path.join(dataPath, PATHS.FACTS_DIR, `${invoiceNumber}.json`);
        await fs.writeFile(invoiceJsonPath, JSON.stringify(invoiceData, null, 2), 'utf8');
        
        seance.invoice_number = invoiceNumber;
        seance.devis_number = null; 
        
        if (seance.statut_seance !== 'PAYEE' && seance.statut_seance !== 'ANNULEE') {
            seance.statut_seance = 'APAYER';
        }
        
        await Seance.create(seance, dataPath);
        res.status(200).json({ 
            message: 'Facture générée avec succès', 
            invoiceNumber: invoiceNumber, 
            newSeanceStatus: seance.statut_seance 
        });
    } catch (error) {
        console.error('Erreur API POST /api/seances/:seanceId/generate-invoice :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur lors de la génération de la facture.' });
    }
}

async function generateDevis(req, res) {
    const { seanceId } = req.params;
    const { userEmail } = req;
    console.log('userEmail', userEmail);
    const dataPath = getDataPath(userEmail);
    try {
        const seance = await Seance.findById(seanceId, dataPath);
        if (!seance) {
            return res.status(404).json({ message: "Séance non trouvée." });
        }

        if (new Date(seance.date_heure_seance) <= new Date()) {
            return res.status(400).json({ 
                message: `Un devis ne peut être généré que pour une séance future. ${seance.date_heure_seance}` 
            });
        }

        if (seance.devis_number) { 
            const devisJsonPathCheck = path.join(dataPath, PATHS.DEVIS_DIR, `${seance.devis_number}.json`);
            try {
                await fs.access(devisJsonPathCheck);
                return res.status(400).json({ 
                    message: `Cette séance a déjà un devis (${seance.devis_number}).` 
                });
            } catch (e) {
                console.warn(`Le numéro de devis ${seance.devis_number} existe pour la séance ${seanceId} mais le fichier JSON est manquant. Un nouveau devis sera généré.`);
            }
        }

        if (seance.invoice_number) {
            return res.status(400).json({ 
                message: `Cette séance a déjà été facturée (${seance.invoice_number}) et ne peut pas faire l'objet d'un nouveau devis.` 
            });
        }

        const client = await Client.findById(seance.id_client, dataPath);
        if (!client) {
            return res.status(404).json({ message: "Client associé à la séance non trouvé." });
        }

        const tarif = await Tarif.findById(seance.id_tarif, dataPath);
        if (!tarif) {
            return res.status(404).json({ message: "Tarif associé à la séance non trouvé."});
        }

        const settings = await readSettingsJson(userEmail);
        const devisNumber = await getNextDevisNumber(dataPath);
        const devisGenerationDate = new Date().toISOString();
        
        const devisData = {
            seanceId: seance.id_seance, 
            devisNumber: devisNumber, 
            devisDate: formatDateDDMMYYYY(devisGenerationDate), 
            originalDevisDate: devisGenerationDate,
            validityDate: calculateValidityOrDueDate(devisGenerationDate, 30),
            client: {
                name: `${client.prenom} ${client.nom}`,
                address: client.adresse || '',
                city: client.ville || '',
                email: client.email || '',
                phone: client.telephone || ''
            },
            service: [{
                Date: formatDateDDMMYYYY(seance.date_heure_seance.split('T')[0]),
                description: tarif.libelle + (tarif.duree ? ` (${tarif.duree} min)` : ''),
                quantity: 1,
                unitPrice: parseFloat(tarif.montant)
            }],
            subTotal: parseFloat(tarif.montant),
            tva: parseFloat(settings.tva) || 0,
            manager: settings.manager || {},
            legal: settings.legal || {}
        };        
        
        await fs.mkdir(path.join(dataPath, PATHS.DEVIS_DIR), { recursive: true }); 
        const devisJsonPath = path.join(dataPath, PATHS.DEVIS_DIR, `${devisNumber}.json`);
        await fs.writeFile(devisJsonPath, JSON.stringify(devisData, null, 2), 'utf8');
        
        seance.devis_number = devisNumber;
        await Seance.create(seance, dataPath);
        
        res.status(200).json({ 
            message: 'Devis généré avec succès', 
            devisNumber: devisNumber 
        });
    } catch (error) {
        console.error('Erreur API POST /api/seances/:seanceId/generate-devis :', error.message, error.stack);
        res.status(500).json({ message: 'Erreur serveur lors de la génération du devis.' });
    }
}

module.exports = {
    getAllSeances,
    getInvoiceStatus,
    createOrUpdateSeance,
    deleteSeance,
    generateInvoice,
    generateDevis
};
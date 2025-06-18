// src/controllers/spreadsheetController.js
const { google } = require('googleapis');
const { getDataPath } = require('../helpers/fileHelper');
const { PATHS } = require('../config/constants');
const Client = require('../models/Client');
const Seance = require('../models/Seance');
const Tarif = require('../models/Tarif');

async function updateSpreadsheet(req, res) {
    const { oauth2Client, userEmail } = req;
    
    try {
        const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // 1. Trouver ou créer la feuille de calcul
        let spreadsheetId;
        const fileResponse = await drive.files.list({
            q: "name='TheraFact' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
            fields: 'files(id, name)',
        });

        if (fileResponse.data.files.length > 0) {
            spreadsheetId = fileResponse.data.files[0].id;
            console.log(`Spreadsheet 'TheraFact' trouvé avec l'ID: ${spreadsheetId}`);
        } else {
            const spreadsheet = await sheets.spreadsheets.create({
                resource: {
                    properties: { title: 'TheraFact' }
                }
            });
            spreadsheetId = spreadsheet.data.spreadsheetId;
            console.log(`Spreadsheet 'TheraFact' créé avec l'ID: ${spreadsheetId}`);
        }

        // 2. Obtenir le chemin des données
        const dataPath = getDataPath(userEmail);
        
        // 3. Lire les données en utilisant les modèles
        const [seancesData, clientsData, tarifsData] = await Promise.all([
            Seance.findAll(dataPath),
            Client.findAll(dataPath),
            Tarif.findAll(dataPath)
        ]);
        console.log(`Données chargées: ${seancesData.length} séances, ${clientsData.length} clients, ${tarifsData.length} tarifs.`);

        // 4. Mettre à jour les feuilles
        await updateSheet(sheets, spreadsheetId, 'Séances', seancesData);
        await updateSheet(sheets, spreadsheetId, 'Clients', clientsData);
        await updateSheet(sheets, spreadsheetId, 'Tarifs', tarifsData);

        // 5. Nettoyer la feuille par défaut ("Sheet1") si elle existe
        const defaultSheetId = await getSheetId(sheets, spreadsheetId, 'Sheet1');
        if(defaultSheetId !== null) {
            console.log("Suppression de la feuille par défaut 'Sheet1'.");
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{ deleteSheet: { sheetId: defaultSheetId } }]
                }
            });
        }
        
        // 6. Déplacer la feuille "Séances" en première position
        const seancesSheetId = await getSheetId(sheets, spreadsheetId, 'Séances');
        if (seancesSheetId !== null) {
            console.log("Déplacement de la feuille 'Séances' en première position.");
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{ moveSheet: { sheetId: seancesSheetId, destinationIndex: 0 } }]
                }
            });
        }

        // 7. Renvoyer l'URL au frontend
        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
        res.json({ success: true, spreadsheetUrl });

    } catch (error) {
        console.error('Erreur lors de la mise à jour du spreadsheet:', error);
        res.status(500).json({ 
            success: false,
            message: `Erreur lors de la mise à jour du spreadsheet: ${error.message}`
        });
    }
}

async function updateSheet(sheets, spreadsheetId, sheetName, data) {
    console.log(`Mise à jour de la feuille: '${sheetName}'...`);
    if (!data || data.length === 0) {
        console.log(`Aucune donnée pour '${sheetName}', la feuille sera vidée si elle existe.`);
        try {
            const sheetId = await getSheetId(sheets, spreadsheetId, sheetName);
            if(sheetId !== null) {
                await sheets.spreadsheets.values.clear({
                    spreadsheetId,
                    range: sheetName,
                });
            }
        } catch (error) {
            // Pas une erreur si la feuille n'existe pas et qu'il n'y a pas de données
        }
        return;
    }

    const headers = Object.keys(data[0]);
    const values = [
        headers,
        ...data.map(item => headers.map(header => item[header] === null || item[header] === undefined ? '' : String(item[header])))
    ];

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });
    } catch (error) {
        if (error.code === 400 && error.message && error.message.includes('Unable to parse range')) {
            console.log(`La feuille '${sheetName}' n'existe pas, création...`);
             await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] }
            });
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: { values }
            });
        } else {
            throw error;
        }
    }

    const sheetId = await getSheetId(sheets, spreadsheetId, sheetName);
    if (sheetId !== null) {
        console.log(`Formatage de l'en-tête pour '${sheetName}'.`);
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [{
                    repeatCell: {
                        range: { sheetId: sheetId, startRowIndex: 0, endRowIndex: 1 },
                        cell: { userEnteredFormat: { backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }, textFormat: { bold: true } } },
                        fields: "userEnteredFormat(backgroundColor,textFormat)"
                    }
                }]
            }
        });
    }
}

async function getSheetId(sheets, spreadsheetId, sheetName) {
    try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        return sheet ? sheet.properties.sheetId : null;
    } catch(e) {
        console.error(`Impossible de trouver l'ID pour la feuille '${sheetName}':`, e.message);
        return null;
    }
}

module.exports = { updateSpreadsheet };
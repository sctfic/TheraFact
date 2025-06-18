// src/controllers/spreadsheetController.js
const { google } = require('googleapis');
const { getDataPath } = require('../helpers/fileHelper');
const { PATHS } = require('../config/constants');
// MODIFIÉ : Import des modèles pour lire les données correctement
const Client = require('../models/Client');
const Seance = require('../models/Seance');
const Tarif = require('../models/Tarif');

async function updateSpreadsheet(req, res) {
    const { oauth2Client, userEmail } = req;
    
    try {
        const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // 1. Find or create the spreadsheet
        let spreadsheetId;
        const fileResponse = await drive.files.list({
            q: "name='TheraFact' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
            fields: 'files(id, name)',
        });

        if (fileResponse.data.files.length > 0) {
            spreadsheetId = fileResponse.data.files[0].id;
        } else {
            const spreadsheet = await sheets.spreadsheets.create({
                resource: {
                    properties: { title: 'TheraFact' }
                }
            });
            spreadsheetId = spreadsheet.data.spreadsheetId;
        }

        // 2. Get data path
        const dataPath = getDataPath(userEmail);
        
        // 3. MODIFIÉ : Lire les données en utilisant les modèles au lieu de fs.readFile et JSON.parse
        const [clientsData, seancesData, tarifsData] = await Promise.all([
            Client.findAll(dataPath),
            Seance.findAll(dataPath),
            Tarif.findAll(dataPath)
        ]);

        // 4. Update sheets
        await updateSheet(sheets, spreadsheetId, 'Clients', clientsData);
        await updateSheet(sheets, spreadsheetId, 'Séances', seancesData);
        await updateSheet(sheets, spreadsheetId, 'Tarifs', tarifsData);

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
    if (!data || data.length === 0) {
        // Si pas de données, on s'assure que la feuille existe et on la vide.
        try {
            const sheetId = await getSheetId(sheets, spreadsheetId, sheetName);
            if(sheetId !== null) {
                await sheets.spreadsheets.values.clear({
                    spreadsheetId,
                    range: sheetName,
                });
            }
        } catch (error) {
            // La feuille n'existe probablement pas, ce qui n'est pas une erreur ici.
        }
        return;
    }

    const headers = Object.keys(data[0]);
    const values = [
        headers,
        ...data.map(item => headers.map(header => item[header] === null || item[header] === undefined ? '' : item[header]))
    ];

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });
    } catch (error) {
        // Si la feuille n'existe pas, on la crée puis on réessaie d'écrire
        if (error.code === 400 && error.errors[0].message.includes('Unable to parse range')) {
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

    // Format header row
    const sheetId = await getSheetId(sheets, spreadsheetId, sheetName);
    if (sheetId !== null) {
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
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        return sheet ? sheet.properties.sheetId : null;
    } catch(e) {
        return null;
    }
}

module.exports = { updateSpreadsheet };
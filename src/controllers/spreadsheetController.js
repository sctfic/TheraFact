const { google } = require('googleapis');
const { readSettingsJson, getDataPath } = require('../helpers/fileHelper');
const { PATHS } = require('../config/constants');
const fs = require('fs').promises;
const path = require('path');

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

        // 2. Get data paths
        const dataPath = getDataPath(userEmail);
        const clientsPath = path.join(dataPath, PATHS.CLIENTS_FILE);
        const seancesPath = path.join(dataPath, PATHS.SEANCES_FILE);
        const tarifsPath = path.join(dataPath, PATHS.TARIFS_FILE);

        // 3. Read data files
        const [clientsData, seancesData, tarifsData] = await Promise.all([
            fs.readFile(clientsPath, 'utf8').then(JSON.parse),
            fs.readFile(seancesPath, 'utf8').then(JSON.parse),
            fs.readFile(tarifsPath, 'utf8').then(JSON.parse)
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
    if (!data || data.length === 0) return;

    // Clear existing sheet or create new one
    try {
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: sheetName,
        });
    } catch (error) {
        // If sheet doesn't exist, create it
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [{
                    addSheet: {
                        properties: {
                            title: sheetName
                        }
                    }
                }]
            }
        });
    }

    // Prepare headers and values
    const headers = Object.keys(data[0]);
    const values = [
        headers,
        ...data.map(item => headers.map(header => item[header] || ''))
    ];

    // Write data
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values }
    });

    // Format header row
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
            requests: [{
                repeatCell: {
                    range: {
                        sheetId: await getSheetId(sheets, spreadsheetId, sheetName),
                        startRowIndex: 0,
                        endRowIndex: 1
                    },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                            textFormat: { bold: true }
                        }
                    },
                    fields: "userEnteredFormat(backgroundColor,textFormat)"
                }
            }]
        }
    });
}

async function getSheetId(sheets, spreadsheetId, sheetName) {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    return sheet.properties.sheetId;
}

module.exports = { updateSpreadsheet };
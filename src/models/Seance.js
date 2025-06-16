// models/Seance.js
const { 
    SEANCES_HEADERS,
    SEANCE_STATUS,
    PATHS 
} = require('../config/constants');
const { parseTSV, formatTSV } = require('../helpers/fileHelper');
const fs = require('fs').promises;
const path = require('path');

class Seance {
    constructor(data) {
        SEANCES_HEADERS.forEach(header => {
            this[header] = data[header] !== undefined ? data[header] : null;
        });
    }

    static async findAll(dataPath) {
        try {
            await fs.access(dataPath);
            const data = await fs.readFile(path.join(dataPath, PATHS.SEANCES_FILE), 'utf8');
            return parseTSV(data, SEANCES_HEADERS).map(seance => new Seance(seance));
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.writeFile(
                    path.join(dataPath, PATHS.SEANCES_FILE), 
                    SEANCES_HEADERS.join('\t') + '\r\n', 
                    'utf8'
                );
                return [];
            }
            console.error(`Error reading seances file in ${dataPath}:`, error.message);
            return [];
        }
    }

    static async findById(id, dataPath) {
        const seances = await this.findAll(dataPath);
        return seances.find(s => s.id_seance === id);
    }

    static async create(data, dataPath) {
        const seances = await this.findAll(dataPath);
        const newSeance = new Seance(data);
        
        const existingIndex = seances.findIndex(s => s.id_seance === newSeance.id_seance);
        if (existingIndex > -1) {
            seances[existingIndex] = newSeance;
        } else {
            seances.push(newSeance);
        }

        await this.saveAll(seances, dataPath);
        return newSeance;
    }

    static async delete(id, dataPath) {
        let seances = await this.findAll(dataPath);
        const initialLength = seances.length;
        seances = seances.filter(s => s.id_seance !== id);
        
        if (seances.length !== initialLength) {
            await this.saveAll(seances, dataPath);
            return true;
        }
        return false;
    }

    static async saveAll(seances, dataPath) {
        try {
            await fs.mkdir(dataPath, { recursive: true });
            await fs.writeFile(
                path.join(dataPath, PATHS.SEANCES_FILE),
                formatTSV(seances, SEANCES_HEADERS),
                'utf8'
            );
        } catch (error) {
            console.error(`Error saving seances to ${dataPath}:`, error.message);
            throw error;
        }
    }

    static async findByClientId(clientId, dataPath) {
        const seances = await this.findAll(dataPath);
        return seances.filter(s => s.id_client === clientId);
    }

    static async findByInvoiceNumber(invoiceNumber, dataPath) {
        const seances = await this.findAll(dataPath);
        return seances.find(s => s.invoice_number === invoiceNumber);
    }

    static async findByDevisNumber(devisNumber, dataPath) {
        const seances = await this.findAll(dataPath);
        return seances.find(s => s.devis_number === devisNumber);
    }
}

module.exports = Seance;
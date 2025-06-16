// models/Tarif.js
const { 
    TARIFS_HEADERS,
    PATHS 
} = require('../config/constants');
const { parseTSV, formatTSV } = require('../helpers/fileHelper');
const fs = require('fs').promises;
const path = require('path');

class Tarif {
    constructor(data) {
        TARIFS_HEADERS.forEach(header => {
            this[header] = data[header] !== undefined ? data[header] : null;
        });
    }

    static async findAll(dataPath) {
        try {
            await fs.access(dataPath);
            const data = await fs.readFile(path.join(dataPath, PATHS.TARIFS_FILE), 'utf8');
            return parseTSV(data, TARIFS_HEADERS).map(tarif => new Tarif(tarif));
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.writeFile(
                    path.join(dataPath, PATHS.TARIFS_FILE), 
                    TARIFS_HEADERS.join('\t') + '\r\n', 
                    'utf8'
                );
                return [];
            }
            console.error(`Error reading tarifs file in ${dataPath}:`, error.message);
            return [];
        }
    }

    static async findById(id, dataPath) {
        const tarifs = await this.findAll(dataPath);
        return tarifs.find(t => t.id === id);
    }

    static async create(data, dataPath) {
        const tarifs = await this.findAll(dataPath);
        const newTarif = new Tarif(data);
        
        if (!newTarif.id) {
            newTarif.id = await this.generateId(newTarif.libelle, newTarif.montant, tarifs);
        }

        const existingIndex = tarifs.findIndex(t => t.id === newTarif.id);
        if (existingIndex > -1) {
            tarifs[existingIndex] = newTarif;
        } else {
            tarifs.push(newTarif);
        }

        await this.saveAll(tarifs, dataPath);
        return newTarif;
    }

    static async delete(id, dataPath) {
        let tarifs = await this.findAll(dataPath);
        const initialLength = tarifs.length;
        tarifs = tarifs.filter(t => t.id !== id);
        
        if (tarifs.length !== initialLength) {
            await this.saveAll(tarifs, dataPath);
            return true;
        }
        return false;
    }

    static async saveAll(tarifs, dataPath) {
        try {
            await fs.mkdir(dataPath, { recursive: true });
            await fs.writeFile(
                path.join(dataPath, PATHS.TARIFS_FILE),
                formatTSV(tarifs, TARIFS_HEADERS),
                'utf8'
            );
        } catch (error) {
            console.error(`Error saving tarifs to ${dataPath}:`, error.message);
            throw error;
        }
    }

    static async generateId(libelle, montant, existingTarifs) {
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
}

module.exports = Tarif;
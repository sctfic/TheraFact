// models/Client.js
const { 
    CLIENTS_HEADERS,
    CLIENT_STATUS,
    PATHS 
} = require('../config/constants');
const { parseTSV, formatTSV } = require('../helpers/fileHelper');
const fs = require('fs').promises;
const path = require('path');

class Client {
    constructor(data) {
        CLIENTS_HEADERS.forEach(header => {
            this[header] = data[header] !== undefined ? data[header] : null;
        });
    }

    static async findAll(dataPath) {
        try {
            await fs.access(dataPath);
            const data = await fs.readFile(path.join(dataPath, PATHS.CLIENTS_FILE), 'utf8');
            return parseTSV(data, CLIENTS_HEADERS).map(client => new Client(client));
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.writeFile(
                    path.join(dataPath, PATHS.CLIENTS_FILE), 
                    CLIENTS_HEADERS.join('\t') + '\r\n', 
                    'utf8'
                );
                return [];
            }
            console.error(`Error reading clients file in ${dataPath}:`, error.message);
            return [];
        }
    }

    static async findById(id, dataPath) {
        const clients = await this.findAll(dataPath);
        return clients.find(c => c.id === id);
    }

    static async create(data, dataPath) {
        const clients = await this.findAll(dataPath);
        const newClient = new Client(data);
        
        if (!newClient.id) {
            newClient.id = await this.generateId(newClient.nom, newClient.prenom, clients);
            newClient.dateCreation = new Date().toISOString();
            newClient.statut = newClient.statut || CLIENT_STATUS.ACTIVE;
        }

        const existingIndex = clients.findIndex(c => c.id === newClient.id);
        if (existingIndex > -1) {
            clients[existingIndex] = newClient;
        } else {
            clients.push(newClient);
        }

        await this.saveAll(clients, dataPath);
        return newClient;
    }

    static async delete(id, dataPath) {
        let clients = await this.findAll(dataPath);
        const initialLength = clients.length;
        clients = clients.filter(c => c.id !== id);
        
        if (clients.length !== initialLength) {
            await this.saveAll(clients, dataPath);
            return true;
        }
        return false;
    }

    static async saveAll(clients, dataPath) {
        try {
            await fs.mkdir(dataPath, { recursive: true });
            await fs.writeFile(
                path.join(dataPath, PATHS.CLIENTS_FILE),
                formatTSV(clients, CLIENTS_HEADERS),
                'utf8'
            );
        } catch (error) {
            console.error(`Error saving clients to ${dataPath}:`, error.message);
            throw error;
        }
    }

    static async generateId(nom, prenom, existingClients) {
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
}

module.exports = Client;
// controllers/clientController.js
const Client = require('../models/Client');
const Seance = require('../models/Seance');
const { getDataPath } = require('../helpers/fileHelper');
// L'import de authState n'est plus nécessaire ici

async function getAllClients(req, res) {
    try {
        // On lit userEmail depuis l'objet req, préparé par le middleware
        const { userEmail } = req;
        const dataPath = getDataPath(userEmail);
        const clients = await Client.findAll(dataPath);
        res.json(clients);
    } catch (error) {
        console.error('Erreur API GET /api/clients :', error.message);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des clients' });
    }
}

async function createOrUpdateClient(req, res) {
    try {
        const { userEmail } = req;
        const dataPath = getDataPath(userEmail);
        const newClient = req.body;
        const savedClient = await Client.create(newClient, dataPath);
        res.status(200).json(savedClient);
    } catch (error) {
        console.error('Erreur API POST /api/clients :', error.message);
        res.status(500).json({ message: 'Erreur lors de la sauvegarde du client' });
    }
}

async function deleteClient(req, res) {
    try {
        const { userEmail } = req;
        const dataPath = getDataPath(userEmail);
        const { id } = req.params;
        const seances = await Seance.findByClientId(id, dataPath);

        if (seances.length > 0) {
            return res.status(400).json({
                message: "Ce client a des séances. Supprimez ou réassignez ses séances d'abord."
            });
        }

        const deleted = await Client.delete(id, dataPath);
        if (!deleted) {
            return res.status(404).json({ message: 'Client non trouvé' });
        }

        res.status(200).json({ message: 'Client supprimé avec succès' });
    } catch (error) {
        console.error('Erreur API DELETE /api/clients/:id :', error.message);
        res.status(500).json({ message: 'Erreur lors de la suppression du client' });
    }
}

module.exports = {
    getAllClients,
    createOrUpdateClient,
    deleteClient
};
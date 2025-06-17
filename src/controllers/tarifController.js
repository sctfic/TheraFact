// controllers/tarifController.js
const Tarif = require('../models/Tarif');
const Client = require('../models/Client');
const Seance = require('../models/Seance');
const { getDataPath } = require('../helpers/fileHelper');
// L'import de authState n'est plus nécessaire ici

async function getAllTarifs(req, res) {
    try {
        const { userEmail } = req;
        const dataPath = getDataPath(userEmail);
        const tarifs = await Tarif.findAll(dataPath);
        res.json(tarifs);
    } catch (error) {
        console.error('Erreur API GET /api/tarifs :', error.message);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des tarifs' });
    }
}

async function createOrUpdateTarif(req, res) {
    try {
        const { userEmail } = req;
        const dataPath = getDataPath(userEmail);
        const newTarif = req.body;

        if (newTarif.duree !== null && newTarif.duree !== undefined && isNaN(parseInt(newTarif.duree, 10))) {
            return res.status(400).json({ message: 'La durée doit être un nombre valide.' });
        }

        const savedTarif = await Tarif.create(newTarif, dataPath);
        res.status(200).json(savedTarif);
    } catch (error) {
        console.error('Erreur API POST /api/tarifs :', error.message);
        res.status(500).json({ message: 'Erreur lors de la sauvegarde du tarif' });
    }
}

async function deleteTarif(req, res) {
    try {
        const { userEmail } = req;
        const dataPath = getDataPath(userEmail);
        const { id } = req.params;
        const clients = await Client.findAll(dataPath);
        const seances = await Seance.findAll(dataPath);

        if (clients.some(c => c.defaultTarifId === id) || seances.some(s => s.id_tarif === id)) {
            return res.status(400).json({
                message: "Ce tarif est utilisé comme tarif par défaut pour un client ou dans des séances."
            });
        }

        const deleted = await Tarif.delete(id, dataPath);
        if (!deleted) {
            return res.status(404).json({ message: 'Tarif non trouvé' });
        }

        res.status(200).json({ message: 'Tarif supprimé avec succès' });
    } catch (error) {
        console.error('Erreur API DELETE /api/tarifs/:id :', error.message);
        res.status(500).json({ message: 'Erreur lors de la suppression du tarif' });
    }
}

module.exports = {
    getAllTarifs,
    createOrUpdateTarif,
    deleteTarif
};
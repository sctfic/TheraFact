const { 
    getAllClients, 
    createOrUpdateClient, 
    deleteClient 
} = require('../controllers/clientController');

module.exports = (app) => {
    app.get('/api/clients', getAllClients);
    app.post('/api/clients', createOrUpdateClient);
    app.delete('/api/clients/:id', deleteClient);
};
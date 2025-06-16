const { 
    getAllTarifs, 
    createOrUpdateTarif, 
    deleteTarif 
} = require('../controllers/tarifController');

module.exports = (app) => {
    app.get('/api/tarifs', getAllTarifs);
    app.post('/api/tarifs', createOrUpdateTarif);
    app.delete('/api/tarifs/:id', deleteTarif);
};
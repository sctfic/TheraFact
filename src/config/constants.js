// constants.js
module.exports = {
    // Headers pour les fichiers TSV
    CLIENTS_HEADERS: ['id', 'nom', 'prenom', 'telephone', 'email', 'adresse', 'ville', 'notes', 'defaultTarifId', 'statut', 'dateCreation'],
    TARIFS_HEADERS: ['id', 'libelle', 'montant', 'duree'],
    SEANCES_HEADERS: ['id_seance', 'id_client', 'date_heure_seance', 'id_tarif', 'montant_facture', 'statut_seance', 'mode_paiement', 'date_paiement', 'invoice_number', 'devis_number', 'googleCalendarEventId'],

    // Statuts des séances
    SEANCE_STATUS: {
        PLANNED: 'PLANIFIEE',
        DONE: 'EFFECTUEE',
        CANCELLED: 'ANNULEE',
        TO_PAY: 'APAYER',
        PAID: 'PAYEE'
    },

    // Statuts des clients
    CLIENT_STATUS: {
        ACTIVE: 'actif',
        INACTIVE: 'inactif'
    },

    // Formats de dates
    DATE_FORMATS: {
        DDMMYYYY: 'DD/MM/YYYY',
        ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
    },

    // Chemins des fichiers
    PATHS: {
        BASE_DATA_DIR: 'data',
        DEMO_DIR_NAME: 'demo',
        CLIENTS_FILE: 'clients.tsv',
        TARIFS_FILE: 'tarifs.tsv',
        SEANCES_FILE: 'seances.tsv',
        SETTINGS_FILE: 'settings.json',
        DEVIS_DIR: 'Devis',
        FACTS_DIR: 'Factures'
    }
};
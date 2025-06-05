// js/main.js
import * as api from './api.js';
import * as state from './state.js'; // Pour accéder à l'état si nécessaire directement
import { initializeNavigation, switchView } from './navigation.js';
import { initializeModal } from './modal.js';
import { initializeClientManagement } from './clients.js';
import { initializeTarifManagement } from './tarifs.js';
import { initializeSeanceManagement } from './seances.js';
import { initializeDashboard }  from './dashboard.js';
import { initializeConfigManagement, populateConfigForm, handleOAuthCallback as handleConfigOAuthCallback } from './config.js';


async function initializeApp() {
    // 1. Initialiser les écouteurs d'événements de base (navigation, modale)
    initializeNavigation();
    initializeModal();

    // 2. Charger les données initiales
    await api.fetchSettings(); // Met à jour state.appSettings
    await api.fetchTarifs();   // Met à jour state.tarifs et appelle renderTarifsTable, populateTarifDropdowns
    await api.fetchClients();  // Met à jour state.clients et appelle renderClientsTable, populateTarifDropdowns
    await api.fetchSeances();  // Met à jour state.seances et appelle renderSeancesTable

    // 3. Initialiser les modules de gestion spécifiques (qui attachent leurs propres écouteurs)
    initializeClientManagement();
    initializeTarifManagement();
    initializeSeanceManagement();
    initializeDashboard();
    initializeConfigManagement();


    // 4. Gérer la vue initiale basée sur le hash ou les paramètres OAuth
    // (Similaire à la logique de handleHashChange dans navigation.js, mais pour le chargement initial)
    
    handleConfigOAuthCallback(); // Traiter un éventuel retour OAuth avant de choisir la vue

    const currentHash = window.location.hash.substring(1);
    let viewToDisplay = 'viewSeances'; // Vue par défaut

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('oauth_success') || urlParams.has('oauth_error')) {
        viewToDisplay = 'viewConfig';
    } else if (currentHash && document.getElementById(currentHash) && currentHash.startsWith('view')) {
        viewToDisplay = currentHash;
    }
    
    switchView(viewToDisplay); // Afficher la vue déterminée

    // Si la vue dashboard est la vue initiale, s'assurer que le graphique est dessiné
    if (viewToDisplay === 'viewDashboard' && document.getElementById('viewDashboard').classList.contains('active')) {
        // updateDashboardStats est déjà appelé dans switchView, qui appelle displaySessionsTrendChart
    }
     // Si la vue config est la vue initiale (hors callback OAuth), s'assurer qu'elle est peuplée
    if (viewToDisplay === 'viewConfig' && document.getElementById('viewConfig').classList.contains('active')) {
        populateConfigForm(state.appSettings);
    }
}

// Lancer l'application
document.addEventListener('DOMContentLoaded', initializeApp);